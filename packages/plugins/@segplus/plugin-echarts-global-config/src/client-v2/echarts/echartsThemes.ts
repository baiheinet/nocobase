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

export interface EChartsTheme {
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

/**
 * 关键约束: NocoBase plugin 各自 bundle 独立的 echarts 实例
 * (e.g. plugin-data-visualization 一个,我们 plugin 一个,版本可能都不一样),
 * 跨 plugin 用 echarts.registerTheme(uid, config) 是**不共享的**:
 * A 实例的 registry 在 B 实例里完全看不到。
 *
 * 解决方案: 把 config 写到 window 全局,data-visualization 的 ECharts 从
 * window 读 config 对象,直接 echarts.init(dom, config) 绕过 registerTheme 机制。
 * window 是浏览器全局,所有 plugin 同一份。
 */
const GLOBAL_THEMES_KEY = '__echartsGlobalThemes';

function getGlobalRegistry(): Record<string, Record<string, unknown>> {
  if (typeof window === 'undefined') return {};
  return ((window as any)[GLOBAL_THEMES_KEY] ||= {}) as Record<string, Record<string, unknown>>;
}

export function registerEChartsTheme(theme: EChartsTheme): void {
  getGlobalRegistry()[theme.uid] = theme.config;
}

export function getEChartsThemeConfig(uid: string): Record<string, unknown> | undefined {
  return getGlobalRegistry()[uid];
}

const previewRegistered = new Set<string>();

/**
 * preview 用的临时 theme。registerPreviewTheme 和 preview chart 的 echarts.init
 * 在同一个 echarts 实例(plugin admin page 内部),所以可以继续用
 * echarts.registerTheme。走 window 全局反而会被 data-visualization 的另一个实例
 * 误读,反而错。
 */
export function registerPreviewTheme(uid: string, config: Record<string, unknown>): void {
  const previewUid = `preview-${uid}`;
  echarts.registerTheme(previewUid, config);
  previewRegistered.add(previewUid);
}

export function unregisterPreviewTheme(uid: string): void {
  previewRegistered.delete(`preview-${uid}`);
}

export function getPreviewThemeUid(uid: string): string {
  return `preview-${uid}`;
}
