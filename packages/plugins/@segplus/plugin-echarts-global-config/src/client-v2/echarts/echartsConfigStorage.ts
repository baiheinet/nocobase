/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { EChartsOption } from 'echarts';

/**
 * v2 / client-v2 副本。与 src/client/echarts/echartsConfigStorage.ts 行为一致
 * —— v1/v2 分别维护以避免互相 import(v2 不可 import v1 @nocobase/client)。
 * 字段 / 策略完全相同,详见那份文件头注释。
 */

import type { EChartsTheme } from './echartsThemes';

const STORAGE_OPTION_KEY = 'nocobase:plugin-echarts-global-config:option';

type PersistedOption = EChartsOption | undefined;

export function loadStoredOption(): PersistedOption {
  if (typeof window === 'undefined' || !window.localStorage) return undefined;
  try {
    const raw = window.localStorage.getItem(STORAGE_OPTION_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as EChartsOption;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function saveStoredOption(option: EChartsOption | undefined): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    throw new Error('localStorage is not available');
  }
  if (option === undefined) {
    window.localStorage.removeItem(STORAGE_OPTION_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_OPTION_KEY, JSON.stringify(option));
}

interface ApiLike {
  request: (options: {
    url: string;
    method?: string;
    params?: Record<string, unknown>;
    data?: unknown;
  }) => Promise<{ data?: any[] }>;
}

export async function loadRemoteEChartsThemes(api: ApiLike): Promise<EChartsTheme[]> {
  try {
    const res = await api.request({
      url: 'themeConfig:list',
      params: { filter: { uid: { $startsWith: 'echarts-' } }, pageSize: 100 },
    });
    const rows = res?.data ?? [];
    return rows
      .filter((r) => r && typeof r.uid === 'string' && r.config && typeof r.config === 'object')
      .map((r) => ({
        id: r.id,
        uid: r.uid,
        isBuiltIn: !!r.isBuiltIn,
        optional: !!r.optional,
        default: !!r.default,
        config: r.config,
      }));
  } catch {
    return [];
  }
}

export async function updateRemoteEChartsTheme(
  api: ApiLike,
  id: number,
  patch: { config?: Record<string, unknown> },
): Promise<void> {
  await api.request({
    url: `themeConfig:update/${id}`,
    method: 'post',
    data: patch,
  });
}

export async function createRemoteEChartsTheme(
  api: ApiLike,
  uid: string,
  config: Record<string, unknown>,
): Promise<void> {
  await api.request({
    url: 'themeConfig:create',
    method: 'post',
    data: {
      uid,
      isBuiltIn: false,
      optional: true,
      default: false,
      config,
    },
  });
}

export async function deleteRemoteEChartsTheme(api: ApiLike, id: number): Promise<void> {
  await api.request({
    url: `themeConfig:destroy/${id}`,
    method: 'post',
  });
}

export async function updateUserEChartsTheme(api: ApiLike, themeUid: string | null): Promise<void> {
  await api.request({
    url: 'users:updateEChartsTheme',
    method: 'post',
    data: { themeUid },
  });
}
