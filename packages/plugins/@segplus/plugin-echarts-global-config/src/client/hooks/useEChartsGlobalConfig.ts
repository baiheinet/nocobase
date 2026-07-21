/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import mergeWith from 'lodash/mergeWith';
import isPlainObject from 'lodash/isPlainObject';
import type { EChartsOption, EChartsType } from 'echarts';
import { ensureEChartsThemesRegistered } from '../echarts/echartsThemes';
import { loadStoredEChartsConfig, saveStoredEChartsConfig } from '../echarts/echartsConfigStorage';

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

interface EChartsConfigContextValue {
  config: EChartsGlobalConfig;
  setConfig: (next: EChartsGlobalConfig) => void;
}

const EChartsConfigContext = createContext<EChartsConfigContextValue | undefined>(undefined);
EChartsConfigContext.displayName = 'EChartsConfigContext';

export interface EChartsConfigProviderProps {
  children: React.ReactNode;
}

/**
 * 运行时全局 ECharts 配置 Provider。
 *
 * 有状态（uncontrolled）：内部用 useState 持有 config，初始值从 localStorage 读取
 * （用户级个性化配置，真值即 localStorage）。暴露 setConfig 供 settings 页写入，
 * setConfig 会同步写回 localStorage 并更新内部 state，使全树 <ECharts> 立即重渲染。
 *
 * 用法（应用根部注入一次；plugin client 已通过 app.use 挂载）：
 * ```tsx
 * <EChartsConfigProvider>
 *   <App />
 * </EChartsConfigProvider>
 * ```
 */
export const EChartsConfigProvider: React.FC<EChartsConfigProviderProps> = ({ children }) => {
  const [config, setConfigState] = useState<EChartsGlobalConfig>(() => loadStoredEChartsConfig() ?? {});

  const setConfig = useCallback((next: EChartsGlobalConfig) => {
    setConfigState(next);
    saveStoredEChartsConfig(next);
    dispatchConfigChange();
  }, []);

  const value = useMemo<EChartsConfigContextValue>(() => ({ config, setConfig }), [config, setConfig]);

  return React.createElement(EChartsConfigContext.Provider, { value }, children);
};

/** 读取当前全局 ECharts 配置（无 Provider 时返回空对象，向后兼容）。 */
export function useEChartsGlobalConfig(): EChartsGlobalConfig {
  return useContext(EChartsConfigContext)?.config ?? {};
}

/**
 * 获取修改全局配置的 setter（settings 页用）。
 * 有 Provider 时用 Provider 的 setConfig（同步 context）；无 Provider 时退化为
 * 直接写 localStorage + 派发变更事件，保证 charts 仍能即时响应主题切换。
 */
export function useSetEChartsGlobalConfig(): (next: EChartsGlobalConfig) => void {
  const ctx = useContext(EChartsConfigContext);
  return (
    ctx?.setConfig ??
    ((next: EChartsGlobalConfig) => {
      saveStoredEChartsConfig(next);
      dispatchConfigChange();
    })
  );
}

/**
 * 推导最终 echarts 主题名，优先级：
 *   1. 本地 theme prop 显式传入 → 最高
 *   2. 持久化主题（localStorage，用户级个性化配置的真值来源）→ 其次
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
