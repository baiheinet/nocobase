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
 * 2026-07-21 用户拍板,第二次修正:
 *   - 主题定义在服务端 `themeConfig` collection 里,**每个主题一行**,uid 形如
 *     'echarts-vintage' / 'echarts-macarons',config 字段就是 echarts.registerTheme()
 *     接受的对象。原来 `uid='echarts-global-config'` 单行存 {theme, option} 的策略
 *     弃用,见 issue BAI-43 评论。
 *   - **全局默认主题**靠行上的 `default` 标志位标记(只一个为 true),
 *     由 admin 在 /admin/settings/ → ECharts configuration 页面里改。
 *   - **用户级 option 覆盖**(per-instance ECharts option 合并)只在 localStorage,
 *     不上服务端 —— 跟"平台级主题"语义不同,平台级是「我设的默认值」,option 是
 *     「我给所有 chart 套的样式覆盖」,后者跟个人偏好更近。
 *
 * localStorage key 只剩一个:用户级 option 覆盖。theme 的"用户选了哪个"也只在
 * localStorage(另一个 key),它与 DB default 的关系是:有用户选就用用户的,否则用
 * DB default。
 */

import type { EChartsTheme } from './echartsThemes';

const STORAGE_OPTION_KEY = 'nocobase:plugin-echarts-global-config:option';
const STORAGE_THEME_KEY = 'nocobase:plugin-echarts-global-config:user-theme';

type PersistedOption = EChartsOption | undefined;
type PersistedUserTheme = string | undefined;

export function loadStoredUserTheme(): PersistedUserTheme {
  if (typeof window === 'undefined' || !window.localStorage) return undefined;
  try {
    const raw = window.localStorage.getItem(STORAGE_THEME_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    return typeof parsed === 'string' ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function saveStoredUserTheme(themeUid: string | undefined): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    throw new Error('localStorage is not available');
  }
  if (themeUid === undefined) {
    window.localStorage.removeItem(STORAGE_THEME_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_THEME_KEY, JSON.stringify(themeUid));
}

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
 *
 * 失败一律静默降级 —— 让上层 render 拿到空数组 + fallback ECHARTS_THEME_OPTIONS 即可。
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
 * 把指定 theme 标记为 default(其他 echarts-* 行清掉 default)。
 *
 * 行为:
 *   - 拉所有 echarts-* 行(用 loadRemoteEChartsThemes 同款 query,小数据量够用);
 *   - 对每一行:target=true,其余=false,逐行 update(只发必要字段);
 *   - update URL 走 `themeConfig:update/<id>`(用 DB 主键,不用 uid)。
 *   - 失败抛回上层,让 admin settings 页 surface。
 */
export async function setRemoteEChartsDefaultTheme(api: ApiLike, targetUid: string): Promise<void> {
  const themes = await loadRemoteEChartsThemes(api);
  for (const t of themes) {
    const nextDefault = t.uid === targetUid;
    if (t.default === nextDefault) continue;
    if (t.id == null) continue;
    await api.request({
      url: `themeConfig:update/${t.id}`,
      method: 'post',
      data: { default: nextDefault },
    });
  }
}

/**
 * 创建一条新 ECharts 主题(uid 形如 'echarts-<name>')。
 *
 * 行为:
 *   - POST themeConfig:create,isBuiltIn=false / optional=true / default=false
 *     (新建的非内置主题不应自动成为默认);
 *   - 失败抛回上层,UI surface。
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
 * 更新一条已有 ECharts 主题的 config JSON(以及可选 default 标志位)。
 *
 * 行为:
 *   - PATCH themeConfig:update/<id>,只发必要字段;
 *   - 失败抛回上层,UI surface。
 */
export async function updateRemoteEChartsTheme(
  api: ApiLike,
  id: number,
  patch: { config?: Record<string, unknown>; default?: boolean },
): Promise<void> {
  await api.request({
    url: `themeConfig:update/${id}`,
    method: 'post',
    data: patch,
  });
}

/**
 * 删除一条 ECharts 主题(只允许删 !isBuiltIn,内置主题是 plugin seed 出来的,
 * 删了 server load() 时会重新种上,容易让 admin 困惑)。
 *
 * 失败抛回上层,UI surface。
 */
export async function deleteRemoteEChartsTheme(api: ApiLike, id: number): Promise<void> {
  await api.request({
    url: `themeConfig:destroy/${id}`,
    method: 'post',
  });
}
