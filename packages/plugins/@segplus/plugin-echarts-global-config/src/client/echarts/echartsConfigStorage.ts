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
 * ECharts 持久化层（v1 / client）。
 *
 * 2026-07-21 用户第三次反馈,主题设置是**用户级**不是平台级:
 *   - 主题定义(色板 / backgroundColor / textStyle)在服务端 `themeConfig` collection
 *     里,每行一个主题,uid 形如 'echarts-vintage' / 'echarts-macarons'。本插件
 *     server/plugin.ts seedEChartsThemes() 幂等种入;
 *   - **用户的主题选择**存在 user 记录的 `systemSettings.echartsThemeUid` 字段,
 *     通过新 action `users:updateEChartsTheme` 写入(仿 theme-editor 的
 *     users:updateTheme)。client 不再走 localStorage;
 *   - 用户级 option 覆盖(per-instance ECharts option 合并)只在 localStorage
 *     —— 与"主题"语义不同,theme-editor 也没存服务端,follow 同样策略。
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
    url: `themeConfig:update/${id}`,
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

/**
 * 删除一条 ECharts 主题(只允许删 !isBuiltIn,内置主题是 plugin seed 出来的)。
 */
export async function deleteRemoteEChartsTheme(api: ApiLike, id: number): Promise<void> {
  await api.request({
    url: `themeConfig:destroy/${id}`,
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
