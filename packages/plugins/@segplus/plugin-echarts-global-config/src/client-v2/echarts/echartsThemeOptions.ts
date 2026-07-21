/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

/**
 * ECharts 主题选项 fallback（纯数据，**不 import echarts**）。
 *
 * 单独拆出来的原因：user-center 的 EChartsUserCenterItemModel 只需要这份下拉数据，
 * 一旦它 import 了会连带 `import * as echarts from 'echarts'` 的 echartsThemes.ts，
 * v2 插件 loader 在动态 import 时就得解析 echarts 这个重外部依赖；echarts 在 v2
 * 运行时没有作为共享模块暴露，loader 的 import() 会 reject，registerModelLoaders
 * 静默失败 → 用户中心项永远发现不到。把纯数据抽到这里即可让 model 的加载链彻底
 * 不碰 echarts。
 *
 * 2026-07-21 迁移到 DB 后:
 *   - `uid` 是 DB 行的 uid(完整名 'echarts-vintage' / 'echarts-macarons');
 *   - 真值在 useEChartsGlobalConfig().themes,这份仅作 DB 拉到前的 fallback
 *     label(保证下拉 UI 不空);
 *   - `value: ''` 仍表示 echarts 默认浅色(不指定主题)。
 */
export const ECHARTS_THEME_OPTIONS: { label: string; uid: string; value: string }[] = [
  { label: 'Vintage', uid: 'echarts-vintage', value: 'echarts-vintage' },
  { label: 'Macarons', uid: 'echarts-macarons', value: 'echarts-macarons' },
];
