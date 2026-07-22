/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useCurrentUserContext } from '@nocobase/client-v2';
import { useEffect, useState } from 'react';
import mergeWith from 'lodash/mergeWith';
import isPlainObject from 'lodash/isPlainObject';
import type { EChartsOption } from 'echarts';
import { registerEChartsTheme, type EChartsTheme } from '../echarts/echartsThemes';
import {
  loadRemoteEChartsThemes,
  loadStoredOption,
  saveStoredOption,
  updateUserEChartsTheme,
} from '../echarts/echartsConfigStorage';

export type { EChartsTheme } from '../echarts/echartsThemes';

export interface EChartsGlobalConfig {
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
export function getEChartsConfigApi(): unknown {
  return _app?.api;
}

let initStarted = false;
let initPromise: Promise<void> | undefined;
/**
 * 一次性 init:plugin load() 时调,模块级 promise 去重。
 * 拉 DB 上的 echarts-* 主题 → register → 派发 change event。
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
  userThemeUid: string | null;
  option: EChartsOption | undefined;
}

const EMPTY_SNAPSHOT: EChartsConfigSnapshot = {
  themes: [],
  userThemeUid: null,
  option: undefined,
};

/**
 * 读取当前完整运行时配置(主题列表 + 当前用户主题 + option)。
 *
 * v2 没有 Provider。userThemeUid 从 useCurrentUserContext() 读
 * (currentUser.data.data.systemSettings.echartsThemeUid)。
 */
export function useEChartsGlobalConfig(): EChartsConfigSnapshot & {
  reload: () => Promise<void>;
  updateUserTheme: (uid: string | null) => Promise<void>;
  setOption: (opt: EChartsOption | undefined) => void;
} {
  const currentUser = useCurrentUserContext();
  const [snapshot, setSnapshot] = useState<EChartsConfigSnapshot>(() => ({
    themes: EMPTY_SNAPSHOT.themes,
    userThemeUid: currentUser?.data?.data?.systemSettings?.echartsThemeUid ?? null,
    option: loadStoredOption(),
  }));

  useEffect(() => {
    const uid = currentUser?.data?.data?.systemSettings?.echartsThemeUid ?? null;
    setSnapshot((prev) => ({ ...prev, userThemeUid: uid }));
  }, [currentUser?.data?.data?.systemSettings?.echartsThemeUid]);

  const reload = async () => {
    if (!_app?.api) return;
    const remote = await loadRemoteEChartsThemes(_app.api as never);
    remote.forEach(registerEChartsTheme);
    _defaultThemeUid = remote.find((t) => t.default)?.uid ?? null;
    setSnapshot((prev) => ({ ...prev, themes: remote }));
    dispatchConfigChange();
  };

  useEffect(() => {
    const handler = () => {
      setSnapshot((prev) => ({
        ...prev,
        option: loadStoredOption(),
      }));
    };
    window.addEventListener(ECHARTS_CONFIG_CHANGE_EVENT, handler);
    return () => window.removeEventListener(ECHARTS_CONFIG_CHANGE_EVENT, handler);
  }, []);

  const updateUserTheme = async (uid: string | null) => {
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
  };

  const setOption = (opt: EChartsOption | undefined) => {
    saveStoredOption(opt);
    setSnapshot((prev) => ({ ...prev, option: opt }));
    dispatchConfigChange();
  };

  return { ...snapshot, reload, updateUserTheme, setOption };
}

let _defaultThemeUid: string | null = null;

/**
 * 推导最终 echarts 主题名,优先级同 v1:
 *   1. 本地 themeProp 显式传入 → 最高
 *   2. currentUser.systemSettings.echartsThemeUid → 其次
 *   3. DB default 主题(init 时拉的 cache) → 最后
 *   4. undefined
 */
export function useEChartsTheme(themeProp?: string): string | undefined {
  const currentUser = useCurrentUserContext();
  const stored = currentUser?.data?.data?.systemSettings?.echartsThemeUid;
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
