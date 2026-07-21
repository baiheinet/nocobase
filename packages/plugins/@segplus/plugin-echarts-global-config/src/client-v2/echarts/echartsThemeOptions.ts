/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

/**
 * ECharts 主题选项（纯数据，**不 import echarts**）。
 *
 * 单独拆出来的原因：user-center 的 EChartsUserCenterItemModel 只需要这份下拉数据，
 * 一旦它 import 了会连带 `import * as echarts from 'echarts'` 的 echartsThemes.ts，
 * v2 插件 loader 在动态 import 时就得解析 echarts 这个重外部依赖；echarts 在 v2
 * 运行时没有作为共享模块暴露，loader 的 import() 会 reject，registerModelLoaders
 * 静默失败 → 用户中心项永远发现不到。把纯数据抽到这里即可让 model 的加载链彻底
 * 不碰 echarts。
 *
 * `value: ''` 表示 echarts 默认浅色（不指定主题）。label 用 i18n key。
 */
export const ECHARTS_THEME_OPTIONS: { label: string; value: string }[] = [
  { label: 'Vintage', value: 'vintage' },
  { label: 'Macarons', value: 'macarons' },
];
