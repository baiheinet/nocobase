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
import { tStr } from './locale';

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

    // 插件设置中心（/admin/settings/）注册 ECharts configuration 入口。
    // 仿 @nocobase/plugin-theme-editor 的 pluginSettingsManager.add 模式。
    // 持久化当前沿用 localStorage（与个人中心共享同一 key），等用户拍板
    // 「持久化策略」（issue BAI-43 Q1）后改走服务端 collection；那时再加
    // 显式 aclSnippet 与服务端 registerSnippet。
    this.app.pluginSettingsManager.add('@segplus/plugin-echarts-global-config', {
      title: tStr('ECharts configuration'),
      icon: 'PieChartOutlined',
      Component: React.lazy(() =>
        import('./settings/EChartsAdminSettings').then((m) => ({ default: m.EChartsAdminSettings })),
      ),
    });
  }
}

export default PluginEchartsGlobalConfigClient;
