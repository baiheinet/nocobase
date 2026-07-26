/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useFlowContext } from '@nocobase/flow-engine';
import React, { forwardRef, useCallback, useEffect, useRef, MutableRefObject } from 'react';
import * as echarts from 'echarts';
import type { EChartsType, EChartsOption } from 'echarts';
import './chartBlock.css';

interface Props {
  option: EChartsOption;
  style?: React.CSSProperties;
  className?: string;
  /**
   * 主题。string (UID) 或 object (config JSON) 都接受;
   * echarts.init 两种都吃。我们这里用 object 跨 plugin 共享,避免
   * 各自 bundle 的 echarts 实例 registry 不互通的问题。
   */
  theme?: string | object;
  onRefReady?: (chart: EChartsType) => void;
  fillHeight?: boolean;
}

const ECharts = forwardRef<EChartsType, Props>(
  ({ option, style, className, theme: themeProp, onRefReady, fillHeight }, ref) => {
    const chartRef = useRef<HTMLDivElement>(null);
    // inner instance ref
    const instanceRef = useRef<EChartsType | null>(null);
    const resizeObserverRef = useRef<ResizeObserver>();
    const initializedRef = useRef(false);
    const ctx = useFlowContext();

    // 跟 @nocobase/plugin-theme-editor 同款:从 FlowEngine context 拿 user。
    // 不要用 @nocobase/client-v2 的 useCurrentUserContext —— 它返回的
    // currentUser.data.data 结构里 systemSettings 在某些路径下不包含完整
    // 自定义键(我们的 echartsThemeUid 拿不到),用 ctx.user 直读更稳。
    const userThemeUid = (ctx as any)?.user?.systemSettings?.echartsThemeUid as string | null | undefined;

    // 关键:从 ctx.__echartsGlobalThemes 拿 user 选的主题 config 对象。
    // @segplus/plugin-echarts-global-config 在 plugin load() 里通过
    // this.context.defineProperty('__echartsGlobalThemes', { value }) 写进来。
    // (this.context === useFlowContext(),文档:
    //  https://docs.nocobase.com/cn/plugin-development/client/ctx/)
    const themeFromRegistry = userThemeUid
      ? ((ctx as any)?.__echartsGlobalThemes?.[userThemeUid] as object | undefined)
      : undefined;

    // 优先级: 显式 theme prop > engine context.__echartsGlobalThemes 里的 config 对象 > undefined
    const theme = themeProp || themeFromRegistry;

    // forword outside ref
    const setForwardedRef = useCallback(
      (value: EChartsType | null) => {
        if (!ref) return;
        if (typeof ref === 'function') {
          ref(value);
        } else {
          (ref as MutableRefObject<EChartsType | null>).current = value;
        }
      },
      [ref],
    );

    // 关键设计: **只 init 一次**。
    // 早期版本 re-init on theme change,但 setOption useEffect 依赖 [option],
    // option 没变就不重跑 → 新 instance 没数据 → 渲染空白 / ErrorBoundary 兜底。
    // 用户改主题靠 personal center 触发 window.location.reload() 整页重来,
    // chart 重新 mount,首次 init 就用 userThemeUid 对应的主题。
    /* eslint-disable react-hooks/exhaustive-deps -- 故意空 deps,initializedRef 守护 */
    useEffect(() => {
      if (!chartRef.current || initializedRef.current) {
        return;
      }
      initializedRef.current = true;

      instanceRef.current = echarts.init(chartRef.current, theme as any);
      instanceRef.current.setOption(option, true);
      setForwardedRef(instanceRef.current);
      onRefReady?.(instanceRef.current);

      resizeObserverRef.current = new ResizeObserver(() => {
        instanceRef.current?.resize?.();
      });
      resizeObserverRef.current.observe(chartRef.current);

      return () => {
        const ins = instanceRef.current;
        if (ins && typeof (ins as any).dispose === 'function') {
          ins.dispose();
        }
        instanceRef.current = null;
        setForwardedRef(null);
        resizeObserverRef.current?.disconnect();
        initializedRef.current = false;
      };
    }, []);

    // option 变化时只 setOption,不重建 instance
    useEffect(() => {
      const ins = instanceRef.current;
      if (ins) {
        ins.setOption(option, true);
      }
    }, [option]);

    return (
      <div
        ref={chartRef}
        style={{ width: '100%', height: fillHeight ? '100%' : 400, minHeight: 0, ...style }}
        className={['data-visualization-chart', className].filter(Boolean).join(' ')}
      />
    );
  },
);

export default ECharts;
