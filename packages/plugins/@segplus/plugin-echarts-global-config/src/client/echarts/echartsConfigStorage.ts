/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import type { EChartsGlobalConfig } from '../hooks/useEChartsGlobalConfig';

/**
 * ECharts global config 持久化。
 *
 * 存储策略（v2 起，2026-07-21 用户拍板）：
 *   - 真值在服务端（@nocobase/plugin-theme-editor 的 themeConfig collection，
 *     uid='echarts-global-config' 那行的 config JSON 字段）；
 *   - localStorage 是**写穿缓存**：每次写入都同步落 localStorage 并派发
 *     ECHARTS_CONFIG_CHANGE_EVENT，<ECharts> 监听事件即时重渲；
 *   - 服务端是跨用户/跨设备的真值来源：插件 client load() 时从服务端拉一次
 *     写入 localStorage，setter 写 localStorage 后再异步写服务端。
 *   - 这样同一浏览器会话内 <ECharts> 永远拿到最新值（localStorage 同步读），
 *     其他浏览器/用户在刷新后从服务端拉到新值。
 *
 * 仅持久化可序列化字段（theme / option），onRefReady 这类函数不落盘。
 */

const STORAGE_KEY = 'nocobase:plugin-echarts-global-config:echarts-global-config';

export const ECHARTS_GLOBAL_CONFIG_UID = 'echarts-global-config';

type PersistedConfig = Pick<EChartsGlobalConfig, 'theme' | 'option'>;

export function loadStoredEChartsConfig(): PersistedConfig | undefined {
  if (typeof window === 'undefined' || !window.localStorage) {
    return undefined;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return undefined;
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as PersistedConfig;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function saveStoredEChartsConfig(config: EChartsGlobalConfig): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    throw new Error('localStorage is not available');
  }
  const persisted: PersistedConfig = { theme: config.theme, option: config.option };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
}

/**
 * 极简的 api 客户端类型（只取我们用到的两个方法）。
 * 完整类型在 @nocobase/client / @nocobase/client-v2 里，但 storage 不该
 * 反向依赖任何一个 client 包。
 */
interface ApiLike {
  request: (options: {
    url: string;
    method?: string;
    params?: Record<string, unknown>;
    data?: unknown;
  }) => Promise<{ data?: any[] }>;
}

/**
 * 从服务端拉 ECharts global config（themeConfig 表 uid=ECHARTS_GLOBAL_CONFIG_UID 那行）。
 *
 * 返回该行的 `config` 字段（PersistedConfig），没找到或无权读时返回 undefined。
 * 网络/解析错误一律静默降级 —— storage 层的契约是「尽力而为」，不让 storage 抛
 * 异常把上层 render 弄炸。
 */
export async function loadRemoteEChartsConfig(api: ApiLike): Promise<PersistedConfig | undefined> {
  try {
    const res = await api.request({
      url: 'themeConfig:list',
      params: { filter: { uid: ECHARTS_GLOBAL_CONFIG_UID }, pageSize: 1 },
    });
    const row = res?.data?.[0];
    if (!row) return undefined;
    const cfg = row.config;
    if (cfg && typeof cfg === 'object') {
      return cfg as PersistedConfig;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * 把 ECharts global config 写到服务端（themeConfig 表对应行）。
 *
 * 行为：
 *   - 行已存在（按 uid 查到）→ update；
 *   - 行不存在 → create（isBuiltIn=false, optional=true, default=false）。
 *
 * 错误一律抛回上层，让 setter 决定如何处理（admin settings 页要 surface 错误给用户）。
 */
export async function saveRemoteEChartsConfig(api: ApiLike, config: EChartsGlobalConfig): Promise<void> {
  const persisted: PersistedConfig = { theme: config.theme, option: config.option };
  const payload = {
    uid: ECHARTS_GLOBAL_CONFIG_UID,
    isBuiltIn: false,
    optional: true,
    default: false,
    config: persisted,
  };

  const list = await api.request({
    url: 'themeConfig:list',
    params: { filter: { uid: ECHARTS_GLOBAL_CONFIG_UID }, pageSize: 1 },
  });
  const existing = list?.data?.[0];
  if (existing?.id != null) {
    await api.request({
      url: `themeConfig:update/${existing.id}`,
      method: 'post',
      data: payload,
    });
    return;
  }
  await api.request({
    url: 'themeConfig:create',
    method: 'post',
    data: payload,
  });
}
