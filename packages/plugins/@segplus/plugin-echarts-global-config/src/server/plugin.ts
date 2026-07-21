/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Plugin } from '@nocobase/server';

/**
 * 服务端插件。
 *
 * 持久化复用 @nocobase/plugin-theme-editor 已有的 themeConfig collection
 * （DDL 见 issue BAI-43 用户评论）：
 *
 *   CREATE TABLE "public"."themeConfig" (
 *     "id" int8 NOT NULL DEFAULT nextval('"themeConfig_id_seq"'::regclass),
 *     "createdAt" timestamptz NOT NULL,
 *     "updatedAt" timestamptz NOT NULL,
 *     "config" json,
 *     "optional" bool,
 *     "isBuiltIn" bool,
 *     "uid" varchar(255),
 *     "default" bool DEFAULT false,
 *     PRIMARY KEY ("id")
 *   );
 *
 * 持久化策略（2026-07-21 用户拍板，第二次修正）：
 *   - **每个 ECharts 主题 = 一行**。uid 形如 'echarts-vintage' / 'echarts-macarons'，
 *     config 字段就是 echarts.registerTheme() 接受的对象（color / backgroundColor
 *     / textStyle 等）。
 *   - **不使用**之前的 `uid='echarts-global-config'` 单行存 {theme, option} 策略。
 *     那个策略错把"选择"和"定义"混在同一行,容易脏、也跟 theme-editor 的"一行一主题"
 *     约定不一致。
 *   - **全局默认**靠行上的 `default` 标志位标记(只一个为 true)。
 *   - **用户级 option 覆盖**不走服务端,只 localStorage;与平台级主题解耦。
 *
 * ACL:
 *   - 读 (themeConfig:list/get) 已被 theme-editor 设为 public,所有用户可读
 *     (个人中心下拉 / admin settings 列主题都要拉,public 是必要的);
 *   - 写通过本插件的 snippet 'pm.echarts-global-config.admin' 收口。admin 角色
 *     默认有所有 snippet,所以 /admin/settings/ 里的 ECharts configuration 页面
 *     仅 admin 可写;其他用户进设置中心也看不到该入口(aclSnippet 限制)。
 */
const SEED_THEMES = [
  {
    uid: 'echarts-vintage',
    isBuiltIn: true,
    optional: true,
    default: true,
    config: {
      color: ['#d87c7c', '#919e8b', '#d7ab82', '#6e7074', '#61a0a8', '#efa18d', '#787464', '#cc7e63'],
      backgroundColor: 'transparent',
      textStyle: { color: '#333' },
    },
  },
  {
    uid: 'echarts-macarons',
    isBuiltIn: true,
    optional: true,
    default: false,
    config: {
      color: ['#2ec7c9', '#b6a2de', '#5ab1ef', '#ffb980', '#d87a80', '#8d98b3', '#e5cf0d', '#97b552'],
      backgroundColor: 'transparent',
      textStyle: { color: '#333' },
    },
  },
];

export class PluginEchartsGlobalConfigServer extends Plugin {
  async beforeLoad() {}

  async load() {
    this.app.acl.registerSnippet({
      name: 'pm.echarts-global-config.admin',
      actions: [
        'themeConfig:create',
        'themeConfig:update',
        'themeConfig:destroy',
      ],
    });

    // 幂等 seed:每次 plugin load 检查并补全缺失的内置主题行。
    // 已经存在的行不 touch(保留 admin 通过 UI 改的 default / config 等)。
    await this.seedEChartsThemes();
  }

  private async seedEChartsThemes() {
    const repo = this.db.getRepository('themeConfig');
    if (!repo) return;
    for (const seed of SEED_THEMES) {
      const existing = await repo.findOne({ filter: { uid: seed.uid } });
      if (existing) continue;
      await repo.create({ values: seed });
    }
  }

  async install() {}

  async afterEnable() {}

  async afterDisable() {}

  async remove() {}
}

export default PluginEchartsGlobalConfigServer;
