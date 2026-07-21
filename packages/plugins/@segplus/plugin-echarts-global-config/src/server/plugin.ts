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
 * 我们的 ECharts global config 作为其中**一行**，通过 uid='echarts-global-config'
 * 识别（行内 config 字段存 { theme, option }）：
 *   - 与 theme-editor 自己的内置主题行(vintage/macarons/dark/light) 共存；
 *   - 主题行 vs. config 行的区别在于 isBuiltIn：主题行 isBuiltIn=true，config 行
 *     isBuiltIn=false（不参与主题切换 UI 展示）。
 *
 * ACL：
 *   - 读 (themeConfig:list/get) 已被 theme-editor 设为 public，所有用户可读
 *     （个人中心的下拉项启动时要拉一次，public 是必要的）；
 *   - 写通过本插件的 snippet 'pm.echarts-global-config.admin' 收口。admin 角色
 *     默认有所有 snippet，所以 /admin/settings/ 里的 ECharts configuration 页面
 *     仅 admin 可写；其他用户进设置中心也看不到该入口（aclSnippet 限制）。
 */
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
  }

  async install() {}

  async afterEnable() {}

  async afterDisable() {}

  async remove() {}
}

export default PluginEchartsGlobalConfigServer;
