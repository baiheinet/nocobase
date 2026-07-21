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
import { saveStoredUserTheme } from '../echarts/echartsConfigStorage';
import { useEChartsGlobalConfig } from '../hooks';
import { useT } from '../locale';

/**
 * v1 个人中心里的「ECharts theme」下拉项。
 *
 * 2026-07-21 第二次拍板后:用户选的主题只存 localStorage,DB default 是平台级。
 * 选项:DB 拉到的 themes(以 useEChartsGlobalConfig().themes 为准) + 顶部
 * 「Use default」空选项;DB 拉失败时回退到静态 ECHARTS_THEME_OPTIONS。
 */
export const EChartsSettings: React.FC = () => {
  const t = useT();
  const { themes, currentThemeUid } = useEChartsGlobalConfig();

  const options = useMemo(() => {
    const source =
      themes.length > 0
        ? themes.map((t2) => {
            // 把 'echarts-vintage' 拼成 'Vintage'(i18n key),i18n 找不到就 fallback 到原字串
            const stripped = t2.uid.replace(/^echarts-/, '');
            const labelKey = stripped.charAt(0).toUpperCase() + stripped.slice(1);
            return { label: t(labelKey), value: t2.uid };
          })
        : ECHARTS_THEME_OPTIONS.map((o) => ({ label: t(o.label), value: o.uid }));
    return [
      { label: t('Use default'), value: '' },
      ...source,
    ];
    // themes 来自 useEChartsGlobalConfig 的 state,变更会触发 re-render
  }, [themes, t]);

  return (
    <SchemaSettingsSelectItem
      title={t('ECharts theme')}
      options={options}
      value={currentThemeUid ?? ''}
      onChange={(value: string) => {
        const next = value || undefined;
        if (next === currentThemeUid) return;
        saveStoredUserTheme(next);
        // 与 v2 行为一致:刷新页面让 <ECharts> 拿到新主题
        window.location.reload();
      }}
    />
  );
};
