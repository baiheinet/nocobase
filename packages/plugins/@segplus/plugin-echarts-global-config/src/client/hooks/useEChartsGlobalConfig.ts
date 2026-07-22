/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useCurrentUserContext } from '@nocobase/client';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import mergeWith from 'lodash/mergeWith';
import isPlainObject from 'lodash/isPlainObject';
import type { EChartsOption } from 'echarts';
import { registerEChartsTheme, type EChartsTheme } from '../echarts/echartsThemes';
import {
  loadRemoteEChartsThemes,
  updateUserEChartsTheme,
} from '../echarts/echartsConfigStorage';

export type { EChartsTheme } from '../echarts/echartsThemes';
export { ECHARTS_THEME_OPTIONS } from '../echarts/echartsThemes';

/**
 * ECharts 全局配置(仅 onRefReady 回调;option 覆盖已移除,用户拍板 BAI-43)。
 */
export interface EChartsGlobalConfig {
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
export function getEChartsConfigApi(): unknown {
  return _app?.api;
}

interface EChartsConfigContextValue {
  themes: EChartsTheme[];
  /** 用户当前选的主题 uid(从 currentUser.systemSettings.echartsThemeUid 读) */
  userThemeUid: string | null;
  /** 拉一次 DB 主题(同时 register echarts) */
  reload: () => Promise<void>;
  /** 更新用户主题(写 currentUser.systemSettings.echartsThemeUid) */
  updateUserTheme: (uid: string | null) => Promise<void>;
}

const EChartsConfigContext = createContext<EChartsConfigContextValue | undefined>(undefined);
EChartsConfigContext.displayName = 'EChartsConfigContext';

export interface EChartsConfigProviderProps {
  children: React.ReactNode;
}

/**
 * v1 运行时 ECharts 配置 Provider。
 *
 * 状态:
 *   - themes: 从 DB 拉到的 echarts-* 主题行,同时 register 进 echarts;
 *   - userThemeUid: **直接读 currentUser.systemSettings.echartsThemeUid**,
 *     不放 state —— 跟 theme-editor 的 InitializeTheme.tsx 同款做法,避免初始 null 闪;
 */
export const EChartsConfigProvider: React.FC<EChartsConfigProviderProps> = ({ children }) => {
  const currentUser = useCurrentUserContext();
  const userThemeUid = currentUser?.data?.data?.systemSettings?.echartsThemeUid ?? null;
  const [themes, setThemes] = useState<EChartsTheme[]>([]);

  const reload = useCallback(async () => {
    if (!_app?.api) return;
    const remote = await loadRemoteEChartsThemes(_app.api as never);
    remote.forEach(registerEChartsTheme);
    setThemes(remote);
    dispatchConfigChange();
  }, []);

  useEffect(() => {
    reload().catch(() => undefined);
  }, [reload]);

  const updateUserTheme = useCallback(async (uid: string | null) => {
    if (!_app?.api) return;
    await updateUserEChartsTheme(_app.api as never, uid);
    if (currentUser?.mutate) {
      currentUser.mutate({
        data: {
          ...currentUser.data.data,
          systemSettings: {
            ...(currentUser.data.data?.systemSettings || {}),
            echartsThemeUid: uid,
          },
        },
      });
    }
    dispatchConfigChange();
  }, [currentUser]);

  const value = useMemo<EChartsConfigContextValue>(
    () => ({
      themes,
      userThemeUid,
      reload,
      updateUserTheme,
    }),
    [themes, userThemeUid, reload, updateUserTheme],
  );

  return React.createElement(EChartsConfigContext.Provider, { value }, children);
};

/** 读取完整配置(无 Provider 时返回空对象 + null,向后兼容)。 */
export function useEChartsGlobalConfig(): EChartsConfigContextValue {
  const ctx = useContext(EChartsConfigContext);
  if (ctx) return ctx;
  // 无 Provider 时,直接从 useCurrentUserContext 拿 userThemeUid(向下兼容)
  // —— 这一支不挂 Provider 的场景(比如 <ECharts> 内部组件)要走 useEChartsTheme
  // 而不是 useEChartsGlobalConfig,但 fallback 让"老 import 还能跑"。
  const currentUser = useCurrentUserContext();
  return {
    themes: [],
    userThemeUid: currentUser?.data?.data?.systemSettings?.echartsThemeUid ?? null,
    reload: async () => undefined,
    updateUserTheme: async () => undefined,
  };
}

/**
 * 给 <ECharts> 用 —— 推导最终 echarts 主题名,优先级:
 *   1. 本地 themeProp 显式传入 → 最高
 *   2. 当前用户 systemSettings.echartsThemeUid(Personal Center 选的) → 其次
 *   3. DB 中 default=true 的那一行(新用户 / 未选用户) → 最后
 *   4. undefined(用 echarts 默认浅色)
 *
 * 通过 ECHARTS_CONFIG_CHANGE_EVENT 订阅,personal center 选完 reload 后会
 * 重新拉 currentUser,这里自动反映。
 */
export function useEChartsTheme(themeProp?: string): string | undefined {
  const ctx = useContext(EChartsConfigContext);
  const currentUser = useCurrentUserContext();
  const stored = currentUser?.data?.data?.systemSettings?.echartsThemeUid;
  if (themeProp) return themeProp;
  if (stored) return stored;
  // fallback: Provider state 里的 userThemeUid(可能更新慢一拍,currentUser 是 source of truth)
  if (ctx?.userThemeUid) return ctx.userThemeUid;
  // 再 fallback: themes 列表里 default=true 的那一行
  if (ctx?.themes) {
    const def = ctx.themes.find((t) => t.default);
    if (def) return def.uid;
  }
  return undefined;
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
