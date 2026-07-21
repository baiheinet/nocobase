/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import mergeWith from 'lodash/mergeWith';
import isPlainObject from 'lodash/isPlainObject';
import type { EChartsOption } from 'echarts';
import { registerEChartsTheme, type EChartsTheme } from '../echarts/echartsThemes';
import {
  loadRemoteEChartsThemes,
  loadStoredOption,
  loadStoredUserTheme,
  saveRemoteEChartsDefaultTheme,
  saveStoredOption,
  saveStoredUserTheme,
} from '../echarts/echartsConfigStorage';

export type { EChartsTheme } from '../echarts/echartsThemes';
export { ECHARTS_THEME_OPTIONS } from '../echarts/echartsThemes';

/**
 * ECharts theme 的运行时引用(给 <ECharts> 读 useEChartsTheme() 用)。
 * 不是 EChartsOption 的一部分 —— 见 onRefReady 字段(原本是给运行时回调用,
 * 现在保留字段名以减小下游 import 改动)。
 */
export interface EChartsGlobalConfig {
  /**
   * 用户级 option 覆盖:与每个 <ECharts> 的本地 option 做深度合并,全局作为底,
   * 本地覆盖。合并规则(见 mergeOption):
   *   - 纯对象:递归深合并
   *   - 数组:整组替换(color / series / dataset.source 等不被拼接)
   *   - 原始值:本地覆盖全局
   */
  option?: EChartsOption;
  /**
   * 全局 onRefReady 回调。在每个 ECharts 实例初始化后调用,先于本地 onRefReady。
   * 不落盘。
   */
  onRefReady?: (chart: unknown) => void;
}

// 主题变更 / 主题列表拉取 / option 变更统一走这个事件,
// 让跨 context 实例也能即时响应(参见 v2 同款 hook 文件头注释)。
export const ECHARTS_CONFIG_CHANGE_EVENT = 'echarts-global-config-change';

function dispatchConfigChange(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ECHARTS_CONFIG_CHANGE_EVENT));
  }
}

/**
 * 模块级 app 引用,由 plugin load() 时注入。storage 与 hooks 都不该反向依赖
 * @nocobase/client / client-v2,所以通过单例传 api。
 */
let _app: { api: unknown } | undefined;
export function setEChartsConfigApp(app: { api: unknown }): void {
  _app = app;
}

interface EChartsConfigContextValue {
  /** 主题列表(从 DB 拉到的 echarts-* 行,DB 失败时为空) */
  themes: EChartsTheme[];
  /** DB 标记的全局默认主题 uid(可能为 null) */
  defaultThemeUid: string | null;
  /** 用户当前选的主题(用户没选时 = defaultThemeUid) */
  currentThemeUid: string | null;
  /** 用户级 option 覆盖(localStorage) */
  option: EChartsOption | undefined;
  /** 拉一次 DB(同时 register echarts) */
  reload: () => Promise<void>;
  /** 把指定 theme 设为 DB default(其他清 default) */
  setDefaultTheme: (uid: string) => Promise<void>;
  /** 设置用户选的主题(localStorage;undefined 表示清空,fallback 到 DB default) */
  setUserTheme: (uid: string | undefined) => void;
  /** 设置用户级 option(localStorage) */
  setOption: (opt: EChartsOption | undefined) => void;
}

const EChartsConfigContext = createContext<EChartsConfigContextValue | undefined>(undefined);
EChartsConfigContext.displayName = 'EChartsConfigContext';

export interface EChartsConfigProviderProps {
  children: React.ReactNode;
}

function deriveCurrentTheme(userTheme: string | undefined, defaultThemeUid: string | null): string | null {
  if (userTheme) return userTheme;
  return defaultThemeUid;
}

/**
 * v1 运行时 ECharts 配置 Provider。
 *
 * 状态:
 *   - themes: 从 DB 拉到的 echarts-* 主题行(同时 register 进 echarts);
 *   - defaultThemeUid: DB 标记的 default 主题 uid;
 *   - userTheme(localStorage): 用户个人选的主题,override default;
 *   - option(localStorage): 用户级 option 覆盖;
 *
 * 事件:所有 setter 派发 ECHARTS_CONFIG_CHANGE_EVENT,跨 context / 跨 lazy chunk
 * 也能即时同步。
 */
export const EChartsConfigProvider: React.FC<EChartsConfigProviderProps> = ({ children }) => {
  const [themes, setThemes] = useState<EChartsTheme[]>([]);
  const [userTheme, setUserThemeState] = useState<string | undefined>(() => loadStoredUserTheme());
  const [option, setOptionState] = useState<EChartsOption | undefined>(() => loadStoredOption());

  const reload = useCallback(async () => {
    if (!_app?.api) return;
    const remote = await loadRemoteEChartsThemes(_app.api as never);
    // 注册到 echarts(vintage / macarons 行被消费后,任何 echarts.init(el, uid) 都用得上)
    remote.forEach(registerEChartsTheme);
    setThemes(remote);
    dispatchConfigChange();
  }, []);

  // 首次 mount 拉一次 DB
  useEffect(() => {
    let cancelled = false;
    reload()
      .then(() => {
        if (cancelled) return;
      })
      .catch(() => {
        // 静默降级 —— render 拿到空 themes 即可
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const defaultThemeUid = useMemo(
    () => themes.find((t) => t.default)?.uid ?? null,
    [themes],
  );

  const setDefaultTheme = useCallback(async (uid: string) => {
    if (!_app?.api) return;
    await setRemoteEChartsDefaultTheme(_app.api as never, uid);
    await reload();
  }, [reload]);

  const setUserTheme = useCallback((uid: string | undefined) => {
    setUserThemeState(uid);
    saveStoredUserTheme(uid);
    dispatchConfigChange();
  }, []);

  const setOption = useCallback((opt: EChartsOption | undefined) => {
    setOptionState(opt);
    saveStoredOption(opt);
    dispatchConfigChange();
  }, []);

  const currentThemeUid = deriveCurrentTheme(userTheme, defaultThemeUid);

  const value = useMemo<EChartsConfigContextValue>(
    () => ({
      themes,
      defaultThemeUid,
      currentThemeUid,
      option,
      reload,
      setDefaultTheme,
      setUserTheme,
      setOption,
    }),
    [themes, defaultThemeUid, currentThemeUid, option, reload, setDefaultTheme, setUserTheme, setOption],
  );

  return React.createElement(EChartsConfigContext.Provider, { value }, children);
};

/** 读取完整配置(无 Provider 时返回空对象 + null,向后兼容)。 */
export function useEChartsGlobalConfig(): EChartsConfigContextValue {
  const ctx = useContext(EChartsConfigContext);
  return (
    ctx ?? {
      themes: [],
      defaultThemeUid: null,
      currentThemeUid: null,
      option: undefined,
      reload: async () => undefined,
      setDefaultTheme: async () => undefined,
      setUserTheme: () => undefined,
      setOption: () => undefined,
    }
  );
}

/**
 * 给 <ECharts> 用 —— 推导最终 echarts 主题名,优先级:
 *   1. 本地 themeProp 显式传入 → 最高
 *   2. 用户在 personal center 选的主题(localStorage) → 其次
 *   3. admin 设的 DB default → 最后
 *   4. undefined(用 echarts 默认浅色)
 *
 * 直接读 localStorage + 当前 Provider state(无 Provider 时仅 localStorage + 静态
 * fallback),保证 <ECharts> 永远拿到最新值,不依赖 context 边界。
 */
export function useEChartsTheme(themeProp?: string): string | undefined {
  const ctx = useContext(EChartsConfigContext);
  const stored = loadStoredUserTheme();
  if (themeProp) return themeProp;
  if (stored) return stored;
  if (ctx?.defaultThemeUid) return ctx.defaultThemeUid;
  return undefined;
}

/**
 * 深度合并 ECharts option。
 *
 * 合并规则:
 *   - 纯对象:递归深合并
 *   - 数组:srcValue(local)整组替换(不拼接)
 *   - 其他原始值:srcValue 覆盖
 *
 * @param base     全局 option(底)
 * @param override 本地 option(覆盖层)
 */
export function mergeOption(base: EChartsOption | undefined, override: EChartsOption): EChartsOption {
  if (!base) {
    return override;
  }
  return mergeWith({}, base, override, (objValue: unknown, srcValue: unknown) => {
    if (Array.isArray(srcValue)) {
      return srcValue;
    }
    if (!isPlainObject(srcValue)) {
      return srcValue;
    }
    return undefined;
  });
}
