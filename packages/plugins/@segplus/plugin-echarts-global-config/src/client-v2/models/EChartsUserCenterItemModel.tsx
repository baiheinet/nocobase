/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { UserCenterSelectItemModel } from '@nocobase/client-v2';
import { getCurrentUserThemeUid, listEChartsThemes, updateUserEChartsTheme } from '../utils/echartsThemeApi';
import { translateEchartsGlobalConfig } from '../locale';

export class EChartsUserCenterItemModel extends UserCenterSelectItemModel {
  static itemId = 'echarts-global-config';

  section = 'preferences' as const;
  sort = 320;
  label = 'ECharts theme';

  async prepare() {
    const themes = await listEChartsThemes(this.context.api);
    const currentUid = getCurrentUserThemeUid(this.context.user);

    this.label = translateEchartsGlobalConfig(this.context, 'ECharts theme');
    this.options = [
      { label: translateEchartsGlobalConfig(this.context, 'Use default'), value: '' },
      ...themes.map((t) => ({
        label: translateEchartsGlobalConfig(this.context, t.name || t.uid),
        value: t.uid,
      })),
    ];
    this.value = currentUid ?? '';
  }

  async onChange(value: string) {
    const uid = value || null;
    await updateUserEChartsTheme(this.context.api, uid);
    // theme-editor 同款行为:刷新页面让 <ECharts> 拿到新主题
    window.location.reload();
  }
}

export default EChartsUserCenterItemModel;
