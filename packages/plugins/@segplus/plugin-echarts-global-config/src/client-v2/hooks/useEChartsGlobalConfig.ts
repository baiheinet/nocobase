/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useEffect, useState } from 'react';
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

export interface EChartsGlobalConfig {
  /** 用户级 option 覆盖(同 v1) */
  option?: EChartsOption;
  onRefReady?: (chart: unknown) => void;
}

export const ECHARTS_CONFIG_CHANGE_EVENT = 'echarts-global-config-change';

function dispatchConfigChange(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ECHARTS_CONFIG_CHANGE_EVENT));
  }
}

let _app: { api: unknown } | undefined;
export function setEChartsConfigApp(app: { api: unknown }): void {
  _app = app;
}

let initStarted = false;
let initPromise: Promise<void> | undefined;
/**
 * 一次性 init:plugin load() 时调,模块级 promise 去重。
 * 拉 DB 上的 echarts-* 主题 → register → 派发 change event。
 * 网络/ACL 错误静默降级 —— render 拿到空 themes 即可。
 */
export function initEChartsGlobalConfigFromServer(): Promise<void> | undefined {
  if (initStarted) return initPromise;
  if (!_app?.api) return undefined;
  initStarted = true;
  initPromise = (async () => {
    try {
      const remote = await loadRemoteEChartsThemes(_app!.api as never);
      remote.forEach(registerEChartsTheme);
      _defaultThemeUid = remote.find((t) => t.default)?.uid ?? null;
      dispatchConfigChange();
    } catch {
      // 静默降级
    }
  })();
  return initPromise;
}

interface EChartsConfigSnapshot {
  themes: EChartsTheme[];
  defaultThemeUid: string | null;
  userTheme: string | undefined;
  option: EChartsOption | undefined;
}

const EMPTY_SNAPSHOT: EChartsConfigSnapshot = {
  themes: [],
  defaultThemeUid: null,
  userTheme: undefined,
  option: undefined,
};

/**
 * 读取当前完整运行时配置(主题列表 + default + 用户选 + option)。
 *
 * v2 没有 Provider(v1/v2 context 分裂 + 懒加载 chunk 让 Provider 边界与组件
 * 边界不一致),改成在 hook 内部 useState + useEffect 订阅 ECHARTS_CONFIG_CHANGE_EVENT,
 * 所有 setter 路径都会派发该事件,hook 自动 re-render。
 */
export function useEChartsGlobalConfig(): EChartsConfigSnapshot & {
  reload: () => Promise<void>;
  setDefaultTheme: (uid: string) => Promise<void>;
  setUserTheme: (uid: string | undefined) => void;
  setOption: (opt: EChartsOption | undefined) => void;
} {
  const [snapshot, setSnapshot] = useState<EChartsConfigSnapshot>(() => ({
    themes: EMPTY_SNAPSHOT.themes,
    defaultThemeUid: null,
    userTheme: loadStoredUserTheme(),
    option: loadStoredOption(),
  }));

  const reload = async () => {
    if (!_app?.api) return;
    const remote = await loadRemoteEChartsThemes(_app.api as never);
    remote.forEach(registerEChartsTheme);
    const newDefault = remote.find((t) => t.default)?.uid ?? null;
    _defaultThemeUid = newDefault;
    setSnapshot((prev) => ({
      ...prev,
      themes: remote,
      defaultThemeUid: newDefault,
    }));
    dispatchConfigChange();
  };

  useEffect(() => {
    const handler = () => {
      setSnapshot((prev) => ({
        ...prev,
        userTheme: loadStoredUserTheme(),
        option: loadStoredOption(),
        // themes / defaultThemeUid 走 reload,不在事件 handler 里 set(避免循环)
      }));
    };
    window.addEventListener(ECHARTS_CONFIG_CHANGE_EVENT, handler);
    return () => window.removeEventListener(ECHARTS_CONFIG_CHANGE_EVENT, handler);
  }, []);

  const setDefaultTheme = async (uid: string) => {
    if (!_app?.api) return;
    await setRemoteEChartsDefaultTheme(_app.api as never, uid);
    await reload();
  };

  const setUserTheme = (uid: string | undefined) => {
    saveStoredUserTheme(uid);
    setSnapshot((prev) => ({ ...prev, userTheme: uid }));
    dispatchConfigChange();
  };

  const setOption = (opt: EChartsOption | undefined) => {
    saveStoredOption(opt);
    setSnapshot((prev) => ({ ...prev, option: opt }));
    dispatchConfigChange();
  };

  return { ...snapshot, reload, setDefaultTheme, setUserTheme, setOption };
}

/**
 * 模块级 cache,由 initEChartsGlobalConfigFromServer() / reload() 写入。
 * useEChartsTheme 直接读它(同步,无 API 调用),change event 触发 re-render。
 */
let _defaultThemeUid: string | null = null;

export function _setDefaultThemeUidForTest(uid: string | null): void {
  _defaultThemeUid = uid;
}

/**
 * 推导最终 echarts 主题名,优先级同 v1:
 *   1. 本地 themeProp 显式传入 → 最高
 *   2. localStorage userTheme → 其次
 *   3. DB defaultThemeUid(init 时拉一次) → 最后
 *   4. undefined
 *
 * 通过 ECHARTS_CONFIG_CHANGE_EVENT 订阅 cache 更新(不直接 fetch,避免每个
 * <ECharts> 实例都打一次 API)。
 */
export function useEChartsTheme(themeProp?: string): string | undefined {
  const stored = loadStoredUserTheme();
  // 用一个 tick state 在 cache 更新时触发 re-render
  const [, setTick] = useState(0);
  useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    window.addEventListener(ECHARTS_CONFIG_CHANGE_EVENT, handler);
    return () => window.removeEventListener(ECHARTS_CONFIG_CHANGE_EVENT, handler);
  }, []);
  if (themeProp) return themeProp;
  if (stored) return stored;
  return _defaultThemeUid ?? undefined;
}

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
