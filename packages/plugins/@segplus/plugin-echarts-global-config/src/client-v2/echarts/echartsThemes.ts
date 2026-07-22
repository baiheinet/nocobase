/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import * as echarts from 'echarts';
import { ECHARTS_THEME_OPTIONS as OPTIONS } from './echartsThemeOptions';

export { OPTIONS as ECHARTS_THEME_OPTIONS };

/**
 * echarts theme definitions 与注册入口(v2 / client-v2 副本)。
 *
 * 2026-07-21 用户拍板迁移到数据库后,本文件与 src/client/echarts/echartsThemes.ts
 * 行为一致 —— 仅作为单条注册入口 + fallback label,真实色板从 DB 拉。
 * 详见 src/client/echarts/echartsThemes.ts 头注释。
 */

export interface EChartsTheme {
  /** DB 主键,setRemoteEChartsDefaultTheme 用它做 update URL */
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

export function registerEChartsTheme(theme: EChartsTheme): void {
  if (registered.has(theme.uid)) return;
  registered.add(theme.uid);
  echarts.registerTheme(theme.uid, theme.config);
}

export function __resetEChartsThemeRegistryForTests(): void {
  registered.clear();
}
