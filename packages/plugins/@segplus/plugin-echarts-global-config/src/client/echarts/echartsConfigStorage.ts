/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

/**
 * ECharts 持久化层（v1 / client）。
 *
 * 主题定义在服务端 `echartConfig` collection,每行一个主题(uid 形如
 * 'echarts-vintage' / 'echarts-macarons')。用户的主题选择存在
 * `user.systemSettings.echartsThemeUid`,通过 `users:updateEChartsTheme` 写入。
 * option 覆盖已移除(死代码,用户拍板 BAI-43)。
 */

import type { EChartsTheme } from './echartsThemes';

/**
 * 极简的 api 客户端类型(只取我们用到的几个方法)。完整类型在 @nocobase/client /
 * client-v2 里,但 storage 不该反向依赖任何一个 client 包。
 */
interface ApiLike {
  request: (options: {
    url: string;
    method?: string;
    params?: Record<string, unknown>;
    data?: unknown;
  }) => Promise<{ data?: any[] }>;
}

/**
 * 从服务端拉所有 ECharts 主题(uid 前缀 'echarts-')。
 */
export async function loadEChartsThemes(api: ApiLike): Promise<EChartsTheme[]> {
  try {
    const res = await api.request({
      url: 'echartConfig:list',
      params: { filter: { uid: { $startsWith: 'echarts-' } }, pageSize: 100 },
    });
    const rows: any[] = (res?.data as any)?.data ?? res?.data ?? [];
    return rows
      .filter((r) => r && typeof r.uid === 'string' && r.config && typeof r.config === 'object')
      .map((r) => ({
        id: r.id,
        uid: r.uid,
        name: typeof r.name === 'string' ? r.name : undefined,
        isBuiltIn: !!r.isBuiltIn,
        isDefault: !!r.isDefault,
        config: r.config,
      }));
  } catch (err) {
    console.error('[echarts-global-config] loadEChartsThemes failed', err);
    return [];
  }
}

/** 兼容旧名,内部走 loadEChartsThemes。 */
export const loadRemoteEChartsThemes = loadEChartsThemes;

/**
 * 更新一条已有 ECharts 主题的 config JSON(只发必要字段)。
 * admin 在 /admin/settings/ 里改主题色板用。
 */
export async function updateRemoteEChartsTheme(
  api: ApiLike,
  id: number,
  patch: { config?: Record<string, unknown> },
): Promise<void> {
  await api.request({
    url: `echartConfig:update/${id}`,
    method: 'post',
    data: patch,
  });
}

/**
 * 创建一条新 ECharts 主题(uid 形如 'echarts-<name>')。
 */
export async function createRemoteEChartsTheme(
  api: ApiLike,
  uid: string,
  name: string,
  config: Record<string, unknown>,
): Promise<void> {
  await api.request({
    url: 'echartConfig:create',
    method: 'post',
    data: {
      uid,
      name,
      isBuiltIn: false,
      isDefault: false,
      config,
    },
  });
}

/**
 * 删除一条 ECharts 主题(只允许删 !isBuiltIn,内置主题是 plugin seed 出来的)。
 */
export async function deleteRemoteEChartsTheme(api: ApiLike, id: number): Promise<void> {
  await api.request({
    url: `echartConfig:destroy/${id}`,
    method: 'post',
  });
}

/**
 * 更新当前用户的主题选择(per-user,服务端 user.systemSettings.echartsThemeUid)。
 *
 * 仿 theme-editor 的 useUpdateThemeSettings 模式:
 *   - POST users:updateEChartsTheme;
 *   - 失败抛回上层让 personal center surface。
 */
export async function updateUserEChartsTheme(api: ApiLike, themeUid: string | null): Promise<void> {
  await api.request({
    url: 'users:updateEChartsTheme',
    method: 'post',
    data: { themeUid },
  });
}
