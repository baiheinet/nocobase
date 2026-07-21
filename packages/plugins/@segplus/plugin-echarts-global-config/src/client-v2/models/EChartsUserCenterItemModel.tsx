/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { UserCenterSelectItemModel } from '@nocobase/client-v2';
import { ECHARTS_THEME_OPTIONS } from '../echarts/echartsThemeOptions';
import { loadStoredEChartsConfig, saveStoredEChartsConfig } from '../echarts/echartsConfigStorage';
import { translateEchartsGlobalConfig } from '../locale';

/**
 * v2 user-center（右上角头像 → 设置）里的「ECharts theme」下拉项。
 *
 * v1 用 `this.app.addUserCenterSettingsItem({ Component: ... })`（@nocobase/client 的
 * Application API）挂一个页面；v2 没有这个 app API，改为继承 client-v2 的
 * `UserCenterSelectItemModel` 并通过 `flowEngine.registerModelLoaders` 注册，
 * 由核心 UserCenterTopbarActionModel 自动发现并渲染。
 */
export class EChartsUserCenterItemModel extends UserCenterSelectItemModel {
  static itemId = 'echarts-global-config';

  section = 'preferences' as const;
  sort = 320;
  label = 'ECharts theme';

  async prepare() {
    const config = loadStoredEChartsConfig() ?? {};

    this.label = translateEchartsGlobalConfig(this.context, 'ECharts theme');
    this.options = ECHARTS_THEME_OPTIONS.map((o) => ({
      label: translateEchartsGlobalConfig(this.context, o.label),
      value: o.value,
    }));
    this.value = config.theme ?? '';
  }

  async onChange(value: string) {
    const config = loadStoredEChartsConfig() ?? {};
    const next = { ...config, theme: value || undefined };

    // 选回当前已选值时无需刷新
    if (next.theme === config.theme) {
      return;
    }

    saveStoredEChartsConfig(next);

    // 与 v1 行为一致：保存后刷新页面，使所有 <ECharts> 实例用新主题重渲
    // （本插件独立于 plugin-data-visualization，无法主动通知其组件）。
    window.location.reload();
  }
}

export default EChartsUserCenterItemModel;
