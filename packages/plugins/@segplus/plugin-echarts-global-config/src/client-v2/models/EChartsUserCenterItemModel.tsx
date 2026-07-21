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
import {
  loadRemoteEChartsThemes,
  loadStoredUserTheme,
  saveStoredUserTheme,
} from '../echarts/echartsConfigStorage';
import { translateEchartsGlobalConfig } from '../locale';

/**
 * v2 user-center（右上角头像 → 设置）里的「ECharts theme」下拉项。
 *
 * 2026-07-21 第二次拍板后模型简化:
 *   - 主题定义在服务端,uid 形如 'echarts-vintage';
 *   - 用户选的主题只存 localStorage(per-user override,DB default 是平台级);
 *   - 不再调服务端写;admin 在 /admin/settings/ 里改 DB default。
 */
export class EChartsUserCenterItemModel extends UserCenterSelectItemModel {
  static itemId = 'echarts-global-config';

  section = 'preferences' as const;
  sort = 320;
  label = 'ECharts theme';

  async prepare() {
    const api = (this.context as { api?: unknown }).api;
    let dbOptions: { uid: string; label: string }[] = [];
    if (api) {
      const themes = await loadRemoteEChartsThemes(api as never);
      dbOptions = themes.map((t) => {
        // 把 'echarts-vintage' 拼成 'Vintage'(i18n key)
        const stripped = t.uid.replace(/^echarts-/, '');
        const labelKey = stripped.charAt(0).toUpperCase() + stripped.slice(1);
        return {
          uid: t.uid,
          label: translateEchartsGlobalConfig(this.context, labelKey),
        };
      });
    }
    // 顶部加一个「Use default」空选项,清掉 userTheme 让 <ECharts> 用 DB default
    const options: { label: string; value: string }[] = [
      { label: translateEchartsGlobalConfig(this.context, 'Use default'), value: '' },
      ...(dbOptions.length > 0
        ? dbOptions
        : ECHARTS_THEME_OPTIONS.map((o) => ({ label: o.label, value: o.uid }))
      ).map((o) => ({
        label: o.label,
        value: o.uid,
      })),
    ];

    this.label = translateEchartsGlobalConfig(this.context, 'ECharts theme');
    this.options = options;
    this.value = loadStoredUserTheme() ?? '';
  }

  async onChange(value: string) {
    const previous = loadStoredUserTheme();
    const next = value || undefined;
    if (next === previous) return;

    saveStoredUserTheme(next);

    // 与 v1 行为一致：保存后刷新页面，使所有 <ECharts> 实例用新主题重渲
    // （本插件独立于 plugin-data-visualization，无法主动通知其组件）。
    window.location.reload();
  }
}

export default EChartsUserCenterItemModel;
