/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

/**
 * v2 / client-v2 副本。与 src/client/echarts/echartsConfigStorage.ts 行为一致
 * —— v1/v2 分别维护以避免互相 import(v2 不可 import v1 @nocobase/client)。
 * option 覆盖已移除(死代码,用户拍板 BAI-43)。
 */

import type { EChartsTheme } from './echartsThemes';

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
