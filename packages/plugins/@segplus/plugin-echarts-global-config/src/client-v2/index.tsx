/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Application, Plugin } from '@nocobase/client-v2';

import { EChartsUserCenterItemModel } from './models/EChartsUserCenterItemModel';

export class PluginEchartsGlobalConfigClient extends Plugin<any, Application> {
  async load() {
    // 个人中心（右上角头像 → 设置）注册 ECharts 个性化配置下拉项。
    // v2 不再用 v1 的 this.app.addUserCenterSettingsItem（@nocobase/client 的 app API），
    // 改为注册一个 UserCenterSelectItemModel 子类，由核心 UserCenterTopbarActionModel 自动发现。
    console.log('[echarts-global-config] registerModelLoaders called');
    this.flowEngine.registerModelLoaders({
      EChartsUserCenterItemModel: {
        extends: 'UserCenterItemModel',
        loader: () => {
          console.log('[echarts-global-config] loader invoked');
          return import('./models/EChartsUserCenterItemModel');
        },
      },
    });
  }
}

export default PluginEchartsGlobalConfigClient;
