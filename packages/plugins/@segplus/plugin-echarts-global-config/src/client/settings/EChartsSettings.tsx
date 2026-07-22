/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { SchemaSettingsSelectItem } from '@nocobase/client';
import React, { useMemo } from 'react';
import { ECHARTS_THEME_OPTIONS } from '../echarts/echartsThemes';
import { updateUserEChartsTheme } from '../echarts/echartsConfigStorage';
import { getEChartsConfigApi, useEChartsGlobalConfig } from '../hooks';
import { useT } from '../locale';

/**
 * v1 个人中心里的「ECharts theme」下拉项。
 *
 * 2026-07-21 用户第三次反馈:主题设置是**用户级**不是平台级。仿 theme-editor 的
 * useUpdateThemeSettings 模式,onChange 调 `users:updateEChartsTheme` action 把
 * `currentUser.systemSettings.echartsThemeUid` 写上去,然后 `window.location.reload()`
 * 让所有 <ECharts> 实例用新主题重渲(本插件独立于 plugin-data-visualization,
 * 无法主动通知它)。
 *
 * 选项来源:useEChartsGlobalConfig().themes(DB 拉到的 echarts-* 行),DB 拉失败
 * 回退到静态 ECHARTS_THEME_OPTIONS。"None" / "Use default" 留空(写 null)时
 * 运行时 fallback 到 DB 中 default=true 的那一行(seed 阶段给 vintage=true)。
 */
export const EChartsSettings: React.FC = () => {
  const t = useT();
  const { themes, userThemeUid } = useEChartsGlobalConfig();

  const options = useMemo(() => {
    const source =
      themes.length > 0
        ? themes.map((t2) => {
            // 'echarts-vintage' → 'Vintage' (i18n key)
            const stripped = t2.uid.replace(/^echarts-/, '');
            const labelKey = stripped.charAt(0).toUpperCase() + stripped.slice(1);
            return { label: t(labelKey), value: t2.uid };
          })
        : ECHARTS_THEME_OPTIONS.map((o) => ({ label: t(o.label), value: o.uid }));
    return [
      { label: t('Use default'), value: '' },
      ...source,
    ];
  }, [themes, t]);

  const handleChange = async (value: string) => {
    const uid = value || null;
    if ((uid ?? null) === (userThemeUid ?? null)) return;
    try {
      const api = getEChartsConfigApi();
      if (!api) throw new Error('app not ready');
      await updateUserEChartsTheme(api as never, uid);
    } catch (err) {
      console.error('[echarts-global-config] updateUserEChartsTheme failed', err);
      return;
    }
    // theme-editor 的同款行为:刷新页面让 <ECharts> 拿到新主题
    window.location.reload();
  };

  return (
    <SchemaSettingsSelectItem
      title={t('ECharts theme')}
      options={options}
      value={userThemeUid ?? ''}
      onChange={handleChange}
    />
  );
};
