/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Plugin } from '@nocobase/client';
import React from 'react';

import { EChartsConfigProvider } from './hooks';

export class PluginEchartsGlobalConfigClient extends Plugin {
  async load() {
    // 应用根部挂一次全局 ECharts 配置 Provider（配置从 localStorage 读取，
    // 这是用户级个性化配置，非平台级 admin 设置）。settings 页（挂在个人中心）
    // 通过 useSetEChartsGlobalConfig() 写入。本插件完全独立于 plugin-data-visualization，
    // 因此无法主动通知其 <ECharts> 组件重渲 —— 切换主题后用户需刷新页面生效。
    this.app.use(EChartsConfigProvider);

    // 个人中心（右上角头像 → 设置）注册 ECharts 个性化配置 tab。
    this.app.addUserCenterSettingsItem({
      name: 'echarts',
      sort: 320,
      Component: React.lazy(() => import('./settings/EChartsSettings').then((m) => ({ default: m.EChartsSettings }))),
    });
  }
}

export default PluginEchartsGlobalConfigClient;
