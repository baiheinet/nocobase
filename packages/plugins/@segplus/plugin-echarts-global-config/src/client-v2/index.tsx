/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Application, Plugin } from '@nocobase/client-v2';
import { NAMESPACE } from './locale';

export class PluginEchartsGlobalConfigClient extends Plugin<any, Application> {
  async load() {
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
    // 持久化当前沿用 localStorage（与个人中心共享同一 key），等用户拍板
    // 「持久化策略」（issue BAI-43 Q1）后改走服务端 collection；那时再加
    // 显式 aclSnippet 与服务端 registerSnippet。
    this.pluginSettingsManager.addMenuItem({
      key: NAMESPACE,
      title: this.app.i18n.t('ECharts configuration', { ns: NAMESPACE }),
      icon: 'PieChartOutlined',
    });
    this.pluginSettingsManager.addPageTabItem({
      menuKey: NAMESPACE,
      key: 'index',
      title: this.app.i18n.t('ECharts configuration', { ns: NAMESPACE }),
      componentLoader: () => import('./pages/EChartsAdminSettingsPage'),
    });
  }
}

export default PluginEchartsGlobalConfigClient;
