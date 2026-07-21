/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Button, Form, Input, Select, Space, message } from 'antd';
import React, { useEffect, useState } from 'react';
import { ECHARTS_THEME_OPTIONS } from '../echarts/echartsThemes';
import { useEChartsGlobalConfig, useSetEChartsGlobalConfig } from '../hooks';
import { useT } from '../locale';

/**
 * 插件设置中心里的「ECharts configuration」页面（v1）。
 *
 * 与个人中心 EChartsSettings 的区别：
 *   - 个人中心 EChartsSettings 是一个 SchemaSettingsSelectItem（下拉项）；
 *   - 本组件是一个**完整页面**，admin 视角下的平台级 ECharts 配置入口。
 *
 * 持久化（2026-07-21 用户拍板）：真值在服务端 themeConfig 表 uid='echarts-global-config'
 * 那一行的 config JSON 字段；localStorage 是写穿缓存，charts 启动后从服务端拉一次再写
 * localStorage，setter 写 localStorage + 异步写服务端。详见 hooks/useEChartsGlobalConfig.ts。
 */
export const EChartsAdminSettings: React.FC = () => {
  const t = useT();
  const config = useEChartsGlobalConfig();
  const setConfig = useSetEChartsGlobalConfig();
  const [theme, setTheme] = useState<string>(config.theme ?? '');
  const [optionJson, setOptionJson] = useState<string>(
    config.option ? JSON.stringify(config.option, null, 2) : '',
  );
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setTheme(config.theme ?? '');
    setOptionJson(config.option ? JSON.stringify(config.option, null, 2) : '');
    // 不依赖 savedAt —— 外部 config 变化（例如另一个 admin 改了）也应当同步进表单
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.theme, config.option ? JSON.stringify(config.option) : '']);

  const handleSave = async () => {
    let parsedOption: Record<string, unknown> | undefined;
    const trimmed = optionJson.trim();
    if (trimmed) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
          parsedOption = parsed as Record<string, unknown>;
        } else {
          message.error(t('Default option must be a JSON object'));
          return;
        }
      } catch {
        message.error(t('Invalid JSON in Default option'));
        return;
      }
    }
    setSaving(true);
    try {
      await setConfig({
        theme: theme || undefined,
        option: parsedOption,
      });
      setSavedAt(Date.now());
      message.success(t('ECharts configuration saved'));
    } catch (err) {
      // setConfig 内部已经把服务端写失败降级为 console.warn，所以理论上 catch 不会触发；
      // 但如果未来接口契约变化，保留这条用户可见错误兜底。
      message.error(t('Failed to save ECharts configuration'));
      console.error('[echarts-global-config] save failed', err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setTheme('');
    setOptionJson('');
  };

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <h2 style={{ marginTop: 0 }}>{t('ECharts configuration')}</h2>
      <p style={{ color: 'rgba(0,0,0,0.65)' }}>
        {t(
          'Set the platform-wide defaults for ECharts. These values are merged into every <ECharts> instance (local option overrides global).',
        )}
      </p>
      <Form layout="vertical">
        <Form.Item label={t('Default theme')}>
          <Select
            value={theme || undefined}
            onChange={(v) => setTheme(v ?? '')}
            allowClear
            placeholder={t('Use ECharts default')}
            options={ECHARTS_THEME_OPTIONS.map((o) => ({ label: t(o.label), value: o.value }))}
            style={{ maxWidth: 320 }}
          />
        </Form.Item>
        <Form.Item
          label={t('Default option (JSON)')}
          extra={t(
            'Raw ECharts option object. Merge rules: plain objects deep-merge, arrays replace, primitives override.',
          )}
        >
          <Input.TextArea
            value={optionJson}
            onChange={(e) => setOptionJson(e.target.value)}
            rows={14}
            spellCheck={false}
            placeholder={'{\n  "color": ["#2ec7c9", "#b6a2de", "#5ab1ef"]\n}'}
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
          />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" onClick={handleSave} loading={saving}>
              {t('Save')}
            </Button>
            <Button onClick={handleReset}>{t('Reset')}</Button>
            {savedAt ? (
              <span style={{ color: '#52c41a' }}>{t('Saved')}</span>
            ) : null}
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
};
