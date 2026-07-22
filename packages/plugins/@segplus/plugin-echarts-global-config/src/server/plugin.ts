/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Context, Next, Plugin } from '@nocobase/server';

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
 * 持久化策略（2026-07-21 用户第三次反馈，**主题设置是用户级不是平台级**）：
 *   - 主题定义(色板 / backgroundColor / textStyle)存 themeConfig 表,**每行一个主题**,
 *     uid 形如 'echarts-vintage' / 'echarts-macarons'。admin 在 /admin/settings/ →
 *     ECharts configuration 页面 CRUD 主题定义(本插件不暴露"平台默认"概念 —— 那
 *     跟"用户级主题设置"语义混淆;若 admin 真要给新用户一个兜底,直接改
 *     themeConfig 行的 `default` 字段,seed 里已设 vintage=true);
 *   - **用户的主题选择**存在 user 记录的 `systemSettings.echartsThemeUid` 字段上
 *     (参照 theme-editor 的 `systemSettings.themeId`),**不是 localStorage**。
 *     通过新 action `users:updateEChartsTheme` 写入,客户端 personal center
 *     下拉项 onChange 调它,然后 `window.location.reload()` 让所有 <ECharts>
 *     拿到新主题(theme-editor 用的就是这个模式);
 *   - 运行时 `useEChartsTheme()` 从 currentUser 读 echartsThemeUid,再在已
 *     register 的 themes 里查 config。
 *
 * ACL:
 *   - themeConfig:list/get 已被 theme-editor 设为 public;
 *   - themeConfig:create/update/destroy 收口到 'pm.echarts-global-config.admin';
 *   - users:updateEChartsTheme: 登录用户都能调自己(逻辑上类似 theme-editor 的
 *     users:updateTheme)。
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

/**
 * users:updateEChartsTheme action handler。
 *
 * 行为:
 *   - 从 ctx.action.params.values.themeUid 读用户选的主题 uid;
 *   - 把当前 user 的 systemSettings.echartsThemeUid 字段更新;
 *   - 失败抛 ctx.throw(401/403/500)。
 *
 * 仿 theme-editor 的 update-user-theme.ts。
 */
async function updateEChartsTheme(ctx: Context, next: Next) {
  const { themeUid } = ctx.action.params.values || {};
  if (themeUid !== null && typeof themeUid !== 'string') {
    ctx.throw(400, 'themeUid must be a string or null');
  }
  const { currentUser } = ctx.state;
  if (!currentUser) {
    ctx.throw(401);
  }
  const userRepo = ctx.db.getRepository('users');
  if (!userRepo) {
    ctx.throw(500, 'users repository not found');
  }
  const user = await userRepo.findOne({ filter: { id: currentUser.id } });
  await userRepo.update({
    filterByTk: currentUser.id,
    values: {
      systemSettings: {
        ...(user?.systemSettings || {}),
        echartsThemeUid: themeUid ?? null,
      },
    },
  });
  await next();
}

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

    // 仿 theme-editor 的 users:updateTheme,写当前用户的 echartsThemeUid 字段。
    this.app.resourceManager.registerActionHandler('users:updateEChartsTheme', updateEChartsTheme);

    // 幂等 seed
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
