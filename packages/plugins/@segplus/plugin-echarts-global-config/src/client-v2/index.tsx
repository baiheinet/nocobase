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
import { listEChartsThemes } from './utils/echartsThemeApi';
import { NAMESPACE } from './locale';

export class PluginEchartsGlobalConfigClient extends Plugin<any, Application> {
  async load() {
    Object.entries(localeResources).forEach(([lang, resource]) => {
      this.app.i18n.addResources(lang, NAMESPACE, resource);
    });

    // 跨 plugin 主题穿透:把 themes 写到 engine context。
    // 跟 NocoBase 官方 auth:check 写 user 同款姿势(都是 this.context.defineProperty),
    // data-visualization 的 ECharts 用 useFlowContext() 就能读到。
    // 不再需要 window / EChartsConfigProvider / ECHARTS_THEMES_READY_EVENT 这些 hack。
    //
    // 文档参考:https://docs.nocobase.com/cn/plugin-development/client/ctx/
    // — "this.context === useFlowContext() 返回的是同一个对象"
    const themes = await listEChartsThemes(this.app.apiClient);
    const registry: Record<string, object> = {};
    for (const t of themes) {
      registry[t.uid] = t.config;
    }
    this.context.defineProperty('__echartsGlobalThemes', { value: registry });

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
