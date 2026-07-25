/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Application, Plugin } from '@nocobase/client-v2';
import { localeResources } from '../locale';
import { EChartsConfigProvider } from './components/EChartsConfigProvider';
import { NAMESPACE } from './locale';

export class PluginEchartsGlobalConfigClient extends Plugin<any, Application> {
  async load() {
    Object.entries(localeResources).forEach(([lang, resource]) => {
      this.app.i18n.addResources(lang, NAMESPACE, resource);
    });

    // 挂全局 Provider:拉 themes 预注册进 echarts,派 refresh 事件驱动 chart 强制 re-init。
    // api 从 this.app.apiClient 注入,绕过 useFlowContext 在 app 根部拿不到 context 的问题。
    this.app.use(EChartsConfigProvider, { api: this.app.apiClient });

    this.flowEngine.registerModelLoaders({
      EChartsUserCenterItemModel: {
        extends: 'UserCenterItemModel',
        loader: () => import('./models/EChartsUserCenterItemModel'),
      },
    });

    this.pluginSettingsManager.addMenuItem({
      key: NAMESPACE,
      title: this.app.i18n.t('ECharts configuration', { ns: NAMESPACE }),
      icon: 'PieChartOutlined',
      aclSnippet: 'pm.echarts-global-config.config',
    });
    this.pluginSettingsManager.addPageTabItem({
      menuKey: NAMESPACE,
      key: 'index',
      title: this.app.i18n.t('ECharts configuration', { ns: NAMESPACE }),
      componentLoader: () => import('./pages/EChartsAdminSettingsPage'),
      aclSnippet: 'pm.echarts-global-config.config',
    });
  }
}

export default PluginEchartsGlobalConfigClient;
