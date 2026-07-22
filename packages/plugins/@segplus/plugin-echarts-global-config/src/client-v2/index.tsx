/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Application, Plugin } from '@nocobase/client-v2';
import { initEChartsGlobalConfigFromServer, setEChartsConfigApp } from './hooks';
import { NAMESPACE } from './locale';

export class PluginEchartsGlobalConfigClient extends Plugin<any, Application> {
  async load() {
    // 把 app 引用注入 hooks 模块；kick off 一次性从服务端 themeConfig 拉 themes
    // register 进 echarts(init 内部去重 + 静默降级)。
    setEChartsConfigApp(this.app);
    initEChartsGlobalConfigFromServer();

    // 个人中心(右上角头像 → 设置)注册 ECharts 主题下拉项。v2 用
    // UserCenterSelectItemModel 子类(UserCenterTopbarActionModel 自动发现),
    // prepare() 拉 DB themes 作选项,onChange 调 users:updateEChartsTheme
    // action 写 currentUser.systemSettings.echartsThemeUid,然后 reload
    // 让 <ECharts> 拿到新主题。仿 theme-editor 的 useUpdateThemeSettings 模式
    // (用户级不是平台级)。
    this.flowEngine.registerModelLoaders({
      EChartsUserCenterItemModel: {
        extends: 'UserCenterItemModel',
        loader: () => import('./models/EChartsUserCenterItemModel'),
      },
    });

    // 插件设置中心(/admin/settings/)注册 ECharts configuration 入口。
    // 仿 @nocobase/plugin-theme-editor client-v2 的 addMenuItem + addPageTabItem。
    // 本页只 CRUD 主题定义(themeConfig 行 config JSON + isBuiltIn),不再有
    // "Set as default" 按钮 —— 那是个"平台默认"概念,跟"用户级主题设置"
    // 语义混淆;seed 已经给 vintage=true 作为新用户 fallback。
    this.pluginSettingsManager.addMenuItem({
      key: NAMESPACE,
      title: this.app.i18n.t('ECharts configuration', { ns: NAMESPACE }),
      icon: 'PieChartOutlined',
      aclSnippet: 'pm.echarts-global-config.admin',
    });
    this.pluginSettingsManager.addPageTabItem({
      menuKey: NAMESPACE,
      key: 'index',
      title: this.app.i18n.t('ECharts configuration', { ns: NAMESPACE }),
      componentLoader: () => import('./pages/EChartsAdminSettingsPage'),
      aclSnippet: 'pm.echarts-global-config.admin',
    });
  }
}

export default PluginEchartsGlobalConfigClient;
