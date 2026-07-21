/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { EChartsGlobalConfig } from '../hooks/useEChartsGlobalConfig';

/**
 * v2 客户端的 ECharts global config 持久化层。
 *
 * 与 src/client/echarts/echartsConfigStorage.ts 行为一致 —— v1/v2 客户端分别
 * 维护一份以避免互相 import（v2 不可 import v1 @nocobase/client）。
 * 字段 / 策略完全相同，详见那份文件头注释。
 */

const STORAGE_KEY = 'nocobase:plugin-echarts-global-config:echarts-global-config';

export const ECHARTS_GLOBAL_CONFIG_UID = 'echarts-global-config';

type PersistedConfig = Pick<EChartsGlobalConfig, 'theme' | 'option'>;

export function loadStoredEChartsConfig(): PersistedConfig | undefined {
  if (typeof window === 'undefined' || !window.localStorage) {
    return undefined;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return undefined;
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as PersistedConfig;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function saveStoredEChartsConfig(config: EChartsGlobalConfig): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    throw new Error('localStorage is not available');
  }
  const persisted: PersistedConfig = { theme: config.theme, option: config.option };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
}

interface ApiLike {
  request: (options: {
    url: string;
    method?: string;
    params?: Record<string, unknown>;
    data?: unknown;
  }) => Promise<{ data?: any[] }>;
}

export async function loadRemoteEChartsConfig(api: ApiLike): Promise<PersistedConfig | undefined> {
  try {
    const res = await api.request({
      url: 'themeConfig:list',
      params: { filter: { uid: ECHARTS_GLOBAL_CONFIG_UID }, pageSize: 1 },
    });
    const row = res?.data?.[0];
    if (!row) return undefined;
    const cfg = row.config;
    if (cfg && typeof cfg === 'object') {
      return cfg as PersistedConfig;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export async function saveRemoteEChartsConfig(api: ApiLike, config: EChartsGlobalConfig): Promise<void> {
  const persisted: PersistedConfig = { theme: config.theme, option: config.option };
  const payload = {
    uid: ECHARTS_GLOBAL_CONFIG_UID,
    isBuiltIn: false,
    optional: true,
    default: false,
    config: persisted,
  };

  const list = await api.request({
    url: 'themeConfig:list',
    params: { filter: { uid: ECHARTS_GLOBAL_CONFIG_UID }, pageSize: 1 },
  });
  const existing = list?.data?.[0];
  if (existing?.id != null) {
    await api.request({
      url: `themeConfig:update/${existing.id}`,
      method: 'post',
      data: payload,
    });
    return;
  }
  await api.request({
    url: 'themeConfig:create',
    method: 'post',
    data: payload,
  });
}
