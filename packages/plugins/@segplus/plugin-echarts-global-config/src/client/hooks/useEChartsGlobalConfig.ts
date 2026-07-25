/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useAPIClient, useCurrentUserContext } from '@nocobase/client';
import { useRequest } from 'ahooks';
import isPlainObject from 'lodash/isPlainObject';
import mergeWith from 'lodash/mergeWith';
import type { EChartsOption } from 'echarts';
import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { registerEChartsTheme, type EChartsTheme } from '../echarts/echartsThemes';
import { loadEChartsThemes, updateUserEChartsTheme } from '../echarts/echartsConfigStorage';

export type { EChartsTheme } from '../echarts/echartsThemes';
export { ECHARTS_THEME_OPTIONS } from '../echarts/echartsThemes';

export const ECHARTS_CONFIG_CHANGE_EVENT = 'echarts-global-config-change';

function dispatchConfigChange(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ECHARTS_CONFIG_CHANGE_EVENT));
  }
}

interface EChartsConfigContextValue {
  themes: EChartsTheme[];
  loading: boolean;
  refresh: () => Promise<void>;
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
 * 仿 @nocobase/plugin-theme-editor 的 ThemeListProvider:用 useAPIClient 拿 api,
 * 用 ahooks useRequest 拉 themes,register 进 echarts,context 暴露给消费者。
 */
export const EChartsConfigProvider: React.FC<EChartsConfigProviderProps> = ({ children }) => {
  const api = useAPIClient();
  const currentUser = useCurrentUserContext();
  const userThemeUid = currentUser?.data?.data?.systemSettings?.echartsThemeUid ?? null;

  const { data: themes = [], loading, refresh } = useRequest(() => loadEChartsThemes(api), { refreshDeps: [api] });

  useEffect(() => {
    themes.forEach(registerEChartsTheme);
    dispatchConfigChange();
  }, [themes]);

  const updateUserTheme = useCallback(
    async (uid: string | null) => {
      await updateUserEChartsTheme(api, uid);
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
    },
    [api, currentUser],
  );

  const value = useMemo<EChartsConfigContextValue>(
    () => ({ themes, loading, refresh, updateUserTheme }),
    [themes, loading, refresh, updateUserTheme],
  );

  return React.createElement(EChartsConfigContext.Provider, { value }, children);
};

/** 读取完整配置(无 Provider 时返回空对象 + null,向后兼容)。 */
export function useEChartsGlobalConfig(): EChartsConfigContextValue {
  const ctx = useContext(EChartsConfigContext);
  const currentUser = useCurrentUserContext();
  const userThemeUid = currentUser?.data?.data?.systemSettings?.echartsThemeUid ?? null;
  if (ctx) return ctx;
  // 无 Provider 时 fallback —— <ECharts> 等不挂 Provider 的内部组件走 useEChartsTheme,
  // 但 fallback 让"老 import 还能跑"。
  return {
    themes: [],
    loading: false,
    refresh: async () => undefined,
    updateUserTheme: async () => undefined,
  };
}

/**
 * 给 <ECharts> 用 —— 推导最终 echarts 主题名,优先级:
 *   1. 本地 themeProp 显式传入 → 最高
 *   2. 当前用户 systemSettings.echartsThemeUid(Personal Center 选的) → 其次
 *   3. DB 中 isDefault=true 的那一行(新用户 / 未选用户) → 最后
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
  if (ctx?.themes) {
    const def = ctx.themes.find((t) => t.isDefault);
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
