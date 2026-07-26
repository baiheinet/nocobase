/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { EChartsTheme } from '../echarts/echartsThemes';

export async function listEChartsThemes(api: any): Promise<EChartsTheme[]> {
  const response = await api.request({
    url: 'echartConfig:list',
    params: { filter: {}, pageSize: 1000 },
  });
  const rows = response?.data?.data ?? response?.data ?? [];
  return (rows as any[])
    .filter((r) => r && typeof r.uid === 'string' && r.config && typeof r.config === 'object')
    .map((r) => ({
      id: r.id,
      uid: r.uid,
      name: typeof r.name === 'string' ? r.name : undefined,
      isBuiltIn: !!r.isBuiltIn,
      isDefault: !!r.isDefault,
      config: r.config,
    }));
}

export async function updateEChartsThemeConfig(api: any, id: number, config: Record<string, unknown>) {
  await api.request({
    url: `echartConfig:update/${id}`,
    method: 'post',
    data: { config },
  });
}

export async function setEChartsThemeAsDefault(api: any, id: number, themes: EChartsTheme[]) {
  // 先把其它 default 行清掉,再 set 本行
  for (const t of themes) {
    if (t.isDefault && t.id != null && t.id !== id) {
      await api.request({
        url: `echartConfig:update/${t.id}`,
        method: 'post',
        data: { isDefault: false },
      });
    }
  }
  await api.request({
    url: `echartConfig:update/${id}`,
    method: 'post',
    data: { isDefault: true },
  });
}

export async function createEChartsTheme(
  api: any,
  values: { uid: string; name: string; config: Record<string, unknown> },
) {
  await api.request({
    url: 'echartConfig:create',
    method: 'post',
    data: { ...values, isBuiltIn: false, isDefault: false },
  });
}

export async function deleteEChartsTheme(api: any, id: number) {
  await api.request({
    url: `echartConfig:destroy/${id}`,
    method: 'post',
  });
}

export async function updateUserEChartsTheme(api: any, themeUid: string | null) {
  await api.resource('users').updateEChartsTheme({
    values: { themeUid },
  });
}

export function getCurrentUserThemeUid(user: any): string | null {
  return user?.systemSettings?.echartsThemeUid ?? null;
}

export function getDefaultEChartsTheme(themes?: EChartsTheme[]) {
  return themes?.find((t) => t.isDefault);
}

export function getEffectiveThemeUid(
  themes: EChartsTheme[] | undefined,
  themeUid: string | null | undefined,
): string | undefined {
  if (themeUid) {
    const hit = themes?.find((t) => t.uid === themeUid);
    if (hit) return hit.uid;
  }
  return getDefaultEChartsTheme(themes)?.uid;
}
