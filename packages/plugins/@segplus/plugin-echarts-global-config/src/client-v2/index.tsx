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
    // 把 app 引用注入 hooks 模块；kick off 一次性从服务端 themeConfig 拉
    // ECharts global config 到 localStorage（init 内部去重 + 静默降级）。
    setEChartsConfigApp(this.app);
    initEChartsGlobalConfigFromServer();

    // 个人中心（右上角头像 → 设置）注册 ECharts 个性化配置下拉项。
    // v2 不再用 v1 的 this.app.addUserCenterSettingsItem（@nocobase/client 的 app API），
    // 改为注册一个 UserCenterSelectItemModel 子类，由核心 UserCenterTopbarActionModel 自动发现。
    this.flowEngine.registerModelLoaders({
      EChartsUserCenterItemModel: {
        extends: 'UserCenterItemModel',
        // 动态导入，首次真正用到这个 model 时才会加载对应模块
        loader: () => import('./models/EChartsUserCenterItemModel'),
      },
    });

    // 插件设置中心（/admin/settings/）注册 ECharts configuration 入口。
    // 仿 @nocobase/plugin-theme-editor client-v2 的 addMenuItem + addPageTabItem 模式：
    //   - addMenuItem: 在设置中心左侧加一个菜单项
    //   - addPageTabItem: 给该菜单项加一个页面 tab，componentLoader 懒加载页面组件
    // 持久化走服务端 themeConfig 行（uid='echarts-global-config'），不再依赖
    // localStorage —— 见 src/server/plugin.ts 的 ACL snippet 与
    // src/client-v2/echarts/echartsConfigStorage.ts 的 load/saveRemoteEChartsConfig。
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
}

export default PluginEchartsGlobalConfigClient;
