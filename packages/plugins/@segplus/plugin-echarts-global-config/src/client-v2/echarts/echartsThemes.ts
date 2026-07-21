/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import * as echarts from 'echarts';

export { ECHARTS_THEME_OPTIONS } from './echartsThemeOptions';

/**
 * echarts 没有内建具名主题（'vintage' / 'macarons' 都不是内建名）。
 * 想用 `echarts.init(el, name)` 就必须先 `echarts.registerTheme(name, {...})`，
 * 否则 echarts 静默回退到默认浅色。这里集中注册一组可在 settings 页选择的主题。
 *
 * 模块级只执行一次；被 useEChartsGlobalConfig 和 settings 页共同引用，避免重复注册。
 *
 * 注：Light / Dark 不在本插件管理 —— 它们由 NocoBase 全局 Theme 设置处理。
 *     本插件只保留 Vintage / Macarons 两个真正具名、需要注册的 echarts 主题。
 */

let registered = false;

export function ensureEChartsThemesRegistered(): void {
  if (registered) {
    return;
  }
  registered = true;

  echarts.registerTheme('vintage', {
    color: ['#d87c7c', '#919e8b', '#d7ab82', '#6e7074', '#61a0a8', '#efa18d', '#787464', '#cc7e63'],
    backgroundColor: 'transparent',
    textStyle: { color: '#333' },
  });

  echarts.registerTheme('macarons', {
    color: ['#2ec7c9', '#b6a2de', '#5ab1ef', '#ffb980', '#d87a80', '#8d98b3', '#e5cf0d', '#97b552'],
    backgroundColor: 'transparent',
    textStyle: { color: '#333' },
  });
}

// ECHARTS_THEME_OPTIONS 已抽到 ./echartsThemeOptions（纯数据，不 import echarts），
// 这里 re-export 保持既有 import 路径不变。
