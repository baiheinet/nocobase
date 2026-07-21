/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useEffect, useState } from 'react';
import mergeWith from 'lodash/mergeWith';
import isPlainObject from 'lodash/isPlainObject';
import type { EChartsOption, EChartsType } from 'echarts';
import { ensureEChartsThemesRegistered } from '../echarts/echartsThemes';
import {
  loadRemoteEChartsConfig,
  loadStoredEChartsConfig,
  saveRemoteEChartsConfig,
  saveStoredEChartsConfig,
} from '../echarts/echartsConfigStorage';

export interface EChartsGlobalConfig {
  /**
   * 全局 ECharts option 配置。
   * 与每个 <ECharts> 的本地 option 做深度合并，全局作为底，本地覆盖。
   * 合并规则（见 mergeOption）：
   *   - 纯对象：递归深合并
   *   - 数组：整组替换（color / series / dataset.source 等不被拼接）
   *   - 原始值：本地覆盖全局
   */
  option?: EChartsOption;
  /**
   * 全局默认 echarts 主题名。
   * 当本地未传 theme 时回退到该值（通常为 undefined = echarts 默认浅色）。
   *
   * 注：Light / Dark 由 NocoBase 全局 Theme 设置处理，本插件不管理；
   *     这里只承载 Vintage / Macarons 等真正具名、需要注册的 echarts 主题。
   */
  theme?: string;
  /**
   * 全局 onRefReady 回调。
   * 在每个 ECharts 实例初始化后调用，先于本地 onRefReady 执行。
   */
  onRefReady?: (chart: EChartsType) => void;
}

// dark / vintage / macarons 等具名主题必须在任何 <ECharts> init 之前注册，
// 否则 echarts.init(el, name) 会静默回退浅色。模块级执行一次。
ensureEChartsThemesRegistered();

// 主题变更事件：setConfig 写入 localStorage 后派发，<ECharts> 监听后强制重渲。
// 用 window 事件而非 React context 传递变更信号 —— 这样即使 <ECharts> 与 settings 页
// 不在同一 context 实例（v1/v2 边界、懒加载 chunk 导致 context 分裂），主题也能即时生效。
export const ECHARTS_CONFIG_CHANGE_EVENT = 'echarts-global-config-change';

function dispatchConfigChange(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ECHARTS_CONFIG_CHANGE_EVENT));
  }
}

/**
 * 模块级 app 引用，由 plugin load() 时注入。storage 与 hooks 都不应该反向依赖
 * @nocobase/client-v2，所以通过这个单例传 api。
 */
let _app: { api: unknown } | undefined;
export function setEChartsConfigApp(app: { api: unknown }): void {
  _app = app;
}

/**
 * 把服务端真值拉到 localStorage 的「一次性 init」。
 * plugin load() 时调一次，模块级 promise 去重，network 失败静默降级。
 */
let initStarted = false;
let initPromise: Promise<void> | undefined;
export function initEChartsGlobalConfigFromServer(): Promise<void> | undefined {
  if (initStarted) return initPromise;
  if (!_app?.api) return undefined;
  initStarted = true;
  initPromise = (async () => {
    try {
      const remote = await loadRemoteEChartsConfig(_app!.api as never);
      if (!remote) return;
      const current = loadStoredEChartsConfig();
      if (JSON.stringify(current ?? {}) === JSON.stringify(remote)) return;
      saveStoredEChartsConfig(remote);
      dispatchConfigChange();
    } catch {
      // server unreachable / ACL denied, use localStorage
    }
  })();
  return initPromise;
}

/**
 * 读取当前全局 ECharts 配置。
 *
 * v2 没有 Provider（v1/v2 context 分裂 + 懒加载 chunk 会让 Provider 边界与
 * 组件边界不一致），改成在 hook 内部 useState 持有当前值 + useEffect 订阅
 * ECHARTS_CONFIG_CHANGE_EVENT，所有 setConfig 路径都会派发该事件，hook 自动 re-render。
 */
export function useEChartsGlobalConfig(): EChartsGlobalConfig {
  const [config, setConfig] = useState<EChartsGlobalConfig>(() => loadStoredEChartsConfig() ?? {});
  useEffect(() => {
    const handler = () => setConfig(loadStoredEChartsConfig() ?? {});
    window.addEventListener(ECHARTS_CONFIG_CHANGE_EVENT, handler);
    return () => window.removeEventListener(ECHARTS_CONFIG_CHANGE_EVENT, handler);
  }, []);
  return config;
}

/**
 * 获取修改全局配置的 setter（settings 页 / user-center 项用）。
 * 同步写 localStorage + 派发事件（charts 立即响应）；异步写服务端（跨设备同步）。
 * 服务端失败仅 console.warn，不阻塞 UI —— admin settings 页会在自己的
 * handleSave 里 await 并 surface 错误。
 */
export function useSetEChartsGlobalConfig(): (next: EChartsGlobalConfig) => Promise<void> {
  return async (next: EChartsGlobalConfig) => {
    saveStoredEChartsConfig(next);
    dispatchConfigChange();
    if (_app?.api) {
      try {
        await saveRemoteEChartsConfig(_app.api as never, next);
      } catch (err) {
        console.warn('[echarts-global-config] failed to sync to server', err);
      }
    }
  };
}

/**
 * 推导最终 echarts 主题名，优先级：
 *   1. 本地 theme prop 显式传入 → 最高
 *   2. 持久化主题（localStorage 用户级缓存，真值在服务端）→ 其次
 *
 * Light / Dark 不在此处理：交给 NocoBase 全局 Theme 设置，本插件只承载具名 echarts 主题。
 * 主题直接读 localStorage 而非 React context —— 这样无论 <ECharts> 与 settings 页
 * 是否共享同一 context 实例，切换主题后 charts 都能拿到最新值。
 * 用 ?? 而非 ||：theme='' 表示「显式清空全局主题」（echarts 对 '' 等同无主题，不报错），
 * 不应被 falsy 回退吞掉；想继承全局就传 undefined。
 */
export function useEChartsTheme(themeProp?: string): string | undefined {
  const stored = loadStoredEChartsConfig();
  return themeProp ?? stored?.theme;
}

/**
 * 深度合并 ECharts option。
 *
 * 合并规则：
 *   - 纯对象：递归深合并
 *   - 数组：srcValue（local）整组替换（不拼接）
 *   - 其他原始值：srcValue 覆盖
 *
 * @param base     全局 option（底）
 * @param override 本地 option（覆盖层）
 */
export function mergeOption(base: EChartsOption | undefined, override: EChartsOption): EChartsOption {
  if (!base) {
    return override;
  }
  return mergeWith({}, base, override, (objValue: unknown, srcValue: unknown) => {
    if (Array.isArray(srcValue)) {
      return srcValue;
    }
    if (!isPlainObject(srcValue)) {
      return srcValue;
    }
    return undefined;
  });
}
