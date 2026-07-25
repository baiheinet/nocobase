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
 * 持久化使用自有 echartConfig collection:
 *   - uid 形如 'echarts-vintage' / 'echarts-macarons'；
 *   - config 字段是 echarts.registerTheme() 接受的完整对象；
 *   - isBuiltIn / isDefault / optional 标志位跟 @nocobase/plugin-theme-editor 对齐。
 *
 * 持久化策略（2026-07-22 用户拍板）：
 *   - 每个主题 = echartConfig 一行；
 *   - 默认主题由 isDefault 标志位标记；
 *   - admin 在 /admin/settings/echarts-global-config 改主题定义；
 *   - user 在 personal center 选个人主题(写 user.systemSettings.echartsThemeUid)。
 *
 * ACL（仿 theme-editor 的 server/plugin.ts）：
 *   - echartConfig:list / :get → public（前端 user center 需要拉列表渲染下拉项）；
 *   - 其余 :create / :update / :destroy 收口到 snippet `pm.echarts-global-config.config`；
 *   - users:updateEChartsTheme → loggedIn（任何登录用户都能改自己的偏好）。
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
 * users:updateEChartsTheme action handler —— 仿 theme-editor 的 update-user-theme.ts。
 * 把当前用户的 echartsThemeUid 写进 systemSettings。
 */
async function updateEChartsTheme(ctx: Context, next: Next) {
  const { themeUid } = ctx.action.params.values || {};
  const { currentUser } = ctx.state;
  if (!currentUser) {
    ctx.throw(401);
  }
  const userRepo = ctx.db.getRepository('users');
  const user = await userRepo.findOne({ filter: { id: currentUser.id } });
  await userRepo.update({
    filterByTk: currentUser.id,
    values: {
      systemSettings: {
        ...user.systemSettings,
        echartsThemeUid: themeUid ?? null,
      },
    },
  });
  await next();
}

export class PluginEchartsGlobalConfigServer extends Plugin {
  async beforeLoad() {}

  async load() {
    this.app.resourceManager.registerActionHandler('users:updateEChartsTheme', updateEChartsTheme);
    this.app.acl.allow('users', 'updateEChartsTheme', 'loggedIn');
    this.app.acl.allow('echartConfig', ['list', 'get'], 'public');

    this.app.acl.registerSnippet({
      name: 'pm.echarts-global-config.config',
      actions: ['echartConfig:*'],
    });
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

  async install() {
    await this.seedEChartsThemes();
  }

  async afterEnable() {}

  async afterDisable() {}

  async remove() {}
}

export default PluginEchartsGlobalConfigServer;
