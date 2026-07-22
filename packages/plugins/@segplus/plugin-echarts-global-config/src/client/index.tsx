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
    // 把 app 引用注入 hooks 模块。Provider 用它拉 themes(走 :list) + 调 CRUD API。
    setEChartsConfigApp(this.app);

    // 应用根部挂一次全局 ECharts 配置 Provider。Provider:
    //   - mount 时从 currentUser 读 echartsThemeUid 作为 userThemeUid state;
    //   - 异步从 DB 拉 themes,register 进 echarts(用 echarts.registerTheme);
    //   - 暴露 updateUserTheme / setOption / reload 给 personal center 与 admin 页。
    this.app.use(EChartsConfigProvider);

    // 个人中心(右上角头像 → 设置)注册 ECharts 主题下拉项。
    // onChange 调 users:updateEChartsTheme action 写 currentUser.systemSettings,
    // 仿 theme-editor 的 useUpdateThemeSettings 模式(用户级不是平台级)。
    this.app.addUserCenterSettingsItem({
      name: 'echarts',
      sort: 320,
      Component: React.lazy(() => import('./settings/EChartsSettings').then((m) => ({ default: m.EChartsSettings }))),
    });

    // 插件设置中心(/admin/settings/)注册 ECharts configuration 入口。
    // 仿 @nocobase/plugin-theme-editor 的 pluginSettingsManager.add 模式。
    // 本页只 CRUD 主题定义(themeConfig 行 config JSON + isBuiltIn),不再有
    // "Set as default" 按钮 —— 那是个"平台默认"概念,跟"用户级主题设置"
    // 语义混淆;seed 已经给 vintage=true 作为新用户 fallback。
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
