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

const previewRegistered = new Set<string>();

/**
 * preview chart 用的临时 theme。registerPreviewTheme 和 preview chart 的
 * echarts.init 在同一个 echarts 实例(plugin admin page 内部),所以可以
 * 走 echarts.registerTheme;window 全局反而会被 data-visualization 的另一个
 * echarts 实例误读。
 *
 * 跨 plugin 共享用 engine context 上的 __echartsGlobalThemes
 * (see src/client-v2/index.tsx load()),不要走这里。
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
