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
import { loadRemoteEChartsThemes, updateUserEChartsTheme } from '../echarts/echartsConfigStorage';
import { translateEchartsGlobalConfig } from '../locale';

/**
 * v2 user-center（右上角头像 → 设置）里的「ECharts theme」下拉项。
 *
 * 2026-07-21 用户第三次反馈:主题设置是**用户级**。仿 theme-editor 的
 * useUpdateThemeSettings 模式,onChange 调 `users:updateEChartsTheme` action 把
 * 当前用户的 `systemSettings.echartsThemeUid` 写上去,然后 `window.location.reload()`
 * 让所有 <ECharts> 实例用新主题重渲(本插件独立于 plugin-data-visualization,
 * 无法主动通知)。
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
        const stripped = t.uid.replace(/^echarts-/, '');
        const labelKey = stripped.charAt(0).toUpperCase() + stripped.slice(1);
        return {
          uid: t.uid,
          label: translateEchartsGlobalConfig(this.context, labelKey),
        };
      });
    }
    const options: { label: string; value: string }[] = [
      { label: translateEchartsGlobalConfig(this.context, 'Use default'), value: '' },
      ...(dbOptions.length > 0
        ? dbOptions
        : ECHARTS_THEME_OPTIONS.map((o) => ({ label: o.label, value: o.uid }))
      ).map((o) => ({ label: o.label, value: o.uid })),
    ];

    this.label = translateEchartsGlobalConfig(this.context, 'ECharts theme');
    this.options = options;
    const currentUid = (this.context as { user?: { systemSettings?: { echartsThemeUid?: string | null } } })
      ?.user?.systemSettings?.echartsThemeUid;
    this.value = currentUid ?? '';
  }

  async onChange(value: string) {
    const uid = value || null;
    try {
      const api = (this.context as { api?: unknown }).api;
      if (!api) throw new Error('app not ready');
      await updateUserEChartsTheme(api as never, uid);
    } catch (err) {
      console.error('[echarts-global-config] updateUserEChartsTheme failed', err);
      return;
    }
    // theme-editor 同款行为:刷新页面让 <ECharts> 拿到新主题
    window.location.reload();
  }
}

export default EChartsUserCenterItemModel;
