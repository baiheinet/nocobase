/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { SchemaSettingsSelectItem } from '@nocobase/client';
import React from 'react';
import { ECHARTS_THEME_OPTIONS } from '../echarts/echartsThemes';
import { useEChartsGlobalConfig, useSetEChartsGlobalConfig } from '../hooks';
import { useT } from '../locale';

export const EChartsSettings: React.FC = () => {
  const t = useT();
  const config = useEChartsGlobalConfig();
  const setConfig = useSetEChartsGlobalConfig();
  const options = ECHARTS_THEME_OPTIONS.map((o) => ({
    label: t(o.label),
    value: o.value,
  }));

  return (
    <SchemaSettingsSelectItem
      title={t('ECharts theme')}
      options={options}
      value={config.theme ?? ''}
      onChange={async (value: string) => {
        // setConfig 内部已经写 localStorage + 派发事件，charts 立即重渲；
        // await 只是让 setConfig 的「本地 → 服务端」链路有机会跑完。
        await setConfig({ ...config, theme: value || undefined });
      }}
    />
  );
};
