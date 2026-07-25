/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useRequest } from 'ahooks';
import React, { useEffect } from 'react';
import { registerEChartsTheme } from '../echarts/echartsThemes';
import { listEChartsThemes } from '../utils/echartsThemeApi';

interface Props {
  /** 由 v2 plugin load() 时注入,绕过 useFlowContext 在 app 根部拿不到 context 的问题。 */
  api: any;
  children: React.ReactNode;
}

/**
 * v2 运行时 ECharts 配置 Provider。
 *
 * 职责: mount 时拉 DB 上的 echarts-* 主题,写进 window.__echartsGlobalThemes
 * (跨 plugin 共享,绕过 echarts 实例隔离)。
 *
 * 时序说明: children (含 chart) 的 useEffect 在 parent (本 Provider) 的
 * useEffect 之前跑。chart 首次 mount 时 window 可能还没写入 → 拿不到 theme
 * config → fallback 默认色。data-visualization 的 ECharts 走 init-once 策略,
 * 用户在 personal center 改完主题触发 window.location.reload() 整页重来,
 * chart 重新 mount,首次 init 就能拿到 userThemeUid 对应的主题 config。
 */
export const EChartsConfigProvider: React.FC<Props> = ({ api, children }) => {
  const { data: themes = [] } = useRequest(() => listEChartsThemes(api), { refreshDeps: [api] });

  useEffect(() => {
    if (!themes.length) return;
    themes.forEach(registerEChartsTheme);
  }, [themes]);

  return <>{children}</>;
};
