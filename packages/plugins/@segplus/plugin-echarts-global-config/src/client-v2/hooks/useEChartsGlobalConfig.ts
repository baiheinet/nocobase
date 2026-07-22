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
  updateUserEChartsTheme,
} from '../echarts/echartsConfigStorage';

export type { EChartsTheme } from '../echarts/echartsThemes';

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
      _defaultThemeUid = remote.find((t) => t.isDefault)?.uid ?? null;
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
}

const EMPTY_SNAPSHOT: EChartsConfigSnapshot = {
  themes: [],
  userThemeUid: null,
};

/**
 * 读取当前完整运行时配置(主题列表 + 当前用户主题)。
 *
 * v2 没有 Provider。userThemeUid 从 useCurrentUserContext() 读
 * (currentUser.data.data.systemSettings.echartsThemeUid)。
 */
export function useEChartsGlobalConfig(): EChartsConfigSnapshot & {
  reload: () => Promise<void>;
  updateUserTheme: (uid: string | null) => Promise<void>;
} {
  const currentUser = useCurrentUserContext();
  const [snapshot, setSnapshot] = useState<EChartsConfigSnapshot>(() => ({
    themes: EMPTY_SNAPSHOT.themes,
    userThemeUid: currentUser?.data?.data?.systemSettings?.echartsThemeUid ?? null,
  }));

  useEffect(() => {
    const uid = currentUser?.data?.data?.systemSettings?.echartsThemeUid ?? null;
    setSnapshot((prev) => ({ ...prev, userThemeUid: uid }));
  }, [currentUser?.data?.data?.systemSettings?.echartsThemeUid]);

  const reload = async () => {
    if (!_app?.api) return;
    const remote = await loadRemoteEChartsThemes(_app.api as never);
    remote.forEach(registerEChartsTheme);
    _defaultThemeUid = remote.find((t) => t.isDefault)?.uid ?? null;
    setSnapshot((prev) => ({ ...prev, themes: remote }));
    dispatchConfigChange();
  };

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

  return { ...snapshot, reload, updateUserTheme };
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

/**
 * Preview namespace utilities for admin settings page.
 * Uses `preview-${uid}` namespace to avoid polluting seed-registered themes.
 */
const previewRegistered = new Set<string>();

export function registerPreviewTheme(uid: string, config: Record<string, unknown>): void {
  const previewUid = `preview-${uid}`;
  // Unregister old preview if exists
  if (previewRegistered.has(previewUid)) {
    unregisterPreviewTheme(uid);
  }
  // Register new preview theme
  const echarts = require('echarts');
  echarts.registerTheme(previewUid, config);
  previewRegistered.add(previewUid);
}

export function unregisterPreviewTheme(uid: string): void {
  const previewUid = `preview-${uid}`;
  if (previewRegistered.has(previewUid)) {
    // echarts doesn't have unregisterTheme, but we can overwrite with empty
    // This is a workaround - in practice, the preview theme will be garbage collected
    previewRegistered.delete(previewUid);
  }
}

export function getPreviewThemeUid(uid: string): string {
  return `preview-${uid}`;
}
