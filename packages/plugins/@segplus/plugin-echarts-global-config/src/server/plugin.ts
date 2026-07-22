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
 * 持久化使用自有 echartConfig collection（DDL 见 issue BAI-43）：
 *
 *   CREATE TABLE "public"."echartConfig" (
 *     "id" int8 NOT NULL DEFAULT nextval('"echartConfig_id_seq"'::regclass),
 *     "createdAt" timestamptz NOT NULL,
 *     "updatedAt" timestamptz NOT NULL,
 *     "name" varchar(255) NOT NULL,
 *     "uid" varchar(255) NOT NULL,
 *     "description" text,
 *     "config" jsonb NOT NULL,
 *     "isBuiltIn" bool NOT NULL DEFAULT false,
 *     "isDefault" bool NOT NULL DEFAULT false,
 *     "createdById" int8,
 *     PRIMARY KEY ("id")
 *   );
 *
 *   CREATE UNIQUE INDEX "echartConfig_uid_unique" ON "public"."echartConfig" ("uid");
 *
 * 持久化策略（2026-07-22 用户拍板）：
 *   - 每个主题 = echartConfig 一行，uid 形如 'echarts-vintage' / 'echarts-macarons'
 *   - config 字段是 echarts.registerTheme() 接受的完整对象
 *   - 默认主题由 isDefault 标志位标记
 *   - admin 在 /admin/settings/ → ECharts configuration 改 default
 *   - user 在 personal center 选个人主题（只 localStorage）
 *
 * ACL:
 *   - echartConfig:list/get 已设为 public
 *   - echartConfig:create/update/destroy 收口到 'pm.echarts-global-config.config'
 *   - users:updateEChartsTheme: 登录用户都能调自己
 */
const SEED_THEMES = [
  {
    uid: 'echarts-vintage',
    name: 'Vintage',
    isBuiltIn: true,
    isDefault: true,
    config: {
      color: ['#d87c7c', '#919e8b', '#d7ab82', '#6e7074', '#61a0a8', '#efa18d', '#787464', '#cc7e63'],
      backgroundColor: 'transparent',
      textStyle: { color: '#333' },
    },
  },
  {
    uid: 'echarts-macarons',
    name: 'Macarons',
    isBuiltIn: true,
    isDefault: false,
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
      name: 'pm.echarts-global-config.config',
      actions: [
        'echartConfig:create',
        'echartConfig:update',
        'echartConfig:destroy',
        'echartConfig:get',
        'echartConfig:list',
      ],
    });

    // 仿 theme-editor 的 users:updateTheme,写当前用户的 echartsThemeUid 字段。
    this.app.resourceManager.registerActionHandler('users:updateEChartsTheme', updateEChartsTheme);

    // 幂等 seed
    await this.seedEChartsThemes();
  }

  private async seedEChartsThemes() {
    const repo = this.db.getRepository('echartConfig');
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
