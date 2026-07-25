/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import * as echarts from 'echarts';

/**
 * echarts theme definitions 与注册入口。
 *
 * 2026-07-21 用户拍板迁移到数据库后的模型:
 *   - 主题定义(色板/背景/字体)存到 @nocobase/plugin-theme-editor 的 themeConfig
 *     collection,每行一个主题,uid 形如 'echarts-vintage' / 'echarts-macarons',
 *     config 字段直接是 echarts.registerTheme() 接受的对象;
 *   - **本文件不再硬编码主题色板**。模块级只提供 `registerEChartsTheme(theme)`
 *     单条注册函数,真正的色板/行种子在 src/server/plugin.ts 的 seedEChartsThemes()。
 *   - ECHARTS_THEME_OPTIONS 仍保留,**仅作为 fallback label** —— DB 拉到主题后,
 *     真正的下拉项从 useEChartsGlobalConfig().themes 来;首屏还没拉到 DB 之前
 *     这份静态表保证 EChartsUserCenterItemModel / admin settings 不会空着。
 *
 * 注:Light / Dark 不在本插件管理 —— 它们由 NocoBase 全局 Theme 设置处理。
 */

export interface EChartsTheme {
  /** DB 主键,update/delete URL 用 */
  id?: number;
  uid: string;
  name?: string;
  isBuiltIn: boolean;
  isDefault: boolean;
  config: {
    color?: string[];
    backgroundColor?: string;
    textStyle?: { color?: string };
    [key: string]: unknown;
  };
}

const registered = new Set<string>();

/**
 * 把一行 themeConfig(uid='echarts-*')注册为 echarts 具名主题。
 * 重复 uid 的注册会被忽略 —— echarts 内部 registerTheme 不会覆盖,
 * 但我们的 Set 跳过重复请求,避免 log 噪音。
 */
export function registerEChartsTheme(theme: EChartsTheme): void {
  if (registered.has(theme.uid)) return;
  registered.add(theme.uid);
  echarts.registerTheme(theme.uid, theme.config);
}

/**
 * 把所有缓存的注册清空,用于 plugin dev hot-reload 等场景。
 * 一般不调用。
 */
export function __resetEChartsThemeRegistryForTests(): void {
  registered.clear();
}

/**
 * Fallback label / uid 列表 —— DB 拉失败或还没拉完时,下拉 UI 不会空。
 * 真正的下拉值在 useEChartsGlobalConfig().themes 拿到后,优先用 DB 数据。
 */
export interface EChartsThemeOption {
  uid: string;
  label: string;
}

export const ECHARTS_THEME_OPTIONS: EChartsThemeOption[] = [
  { uid: 'echarts-vintage', label: 'Vintage' },
  { uid: 'echarts-macarons', label: 'Macarons' },
];
