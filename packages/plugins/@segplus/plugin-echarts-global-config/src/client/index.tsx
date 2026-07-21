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

import { EChartsConfigProvider, setEChartsConfigApp } from './hooks';
import { tStr } from './locale';

export class PluginEchartsGlobalConfigClient extends Plugin {
  async load() {
    // 把 app 引用注入 hooks 模块 —— storage 层（不依赖 @nocobase/client）
    // 通过这个单例拿到 api，调用 :list/:create/:update 走服务端 themeConfig 行。
    setEChartsConfigApp(this.app);

    // 应用根部挂一次全局 ECharts 配置 Provider（localStorage 是首屏同步读源，
    // mount 后会异步从服务端 themeConfig 拉一次拉到再写 localStorage）。
    this.app.use(EChartsConfigProvider);

    // 个人中心（右上角头像 → 设置）注册 ECharts 个性化配置 tab。
    this.app.addUserCenterSettingsItem({
      name: 'echarts',
      sort: 320,
      Component: React.lazy(() => import('./settings/EChartsSettings').then((m) => ({ default: m.EChartsSettings }))),
    });

    // 插件设置中心（/admin/settings/）注册 ECharts configuration 入口。
    // 仿 @nocobase/plugin-theme-editor 的 pluginSettingsManager.add 模式。
    // 主题定义在服务端 themeConfig 表里（uid='echarts-vintage' / 'echarts-macarons'），
    // 由 src/server/plugin.ts 的 seedEChartsThemes() 自动种入。Admin 在本页面
    // 点 "Set as default" 翻转行的 default 标志位。详见 src/server/plugin.ts
    // 的 ACL snippet 与 src/client/echarts/echartsConfigStorage.ts 的
    // loadRemoteEChartsThemes / setRemoteEChartsDefaultTheme。
    this.app.pluginSettingsManager.add('@segplus/plugin-echarts-global-config', {
      title: tStr('ECharts configuration'),
      icon: 'PieChartOutlined',
      aclSnippet: 'pm.echarts-global-config.admin',
      Component: React.lazy(() =>
        import('./settings/EChartsAdminSettings').then((m) => ({ default: m.EChartsAdminSettings })),
      ),
    });
  }
}

export default PluginEchartsGlobalConfigClient;
