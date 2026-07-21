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
 * 插件设置中心里的「ECharts configuration」页面（v2 / client-v2）。
 *
 * 跟 v1 的 EChartsAdminSettings 行为一致 —— v2 重新实现一份是为了保持 v1/v2 客户端
 * 入口的解耦（v2 不可 import v1 @nocobase/client）。两份共用相同的
 * load/saveRemoteEChartsConfig，所以存储层一致。
 *
 * 持久化说明详见 v1 EChartsAdminSettings 头部注释。
 */
const EChartsAdminSettingsPage: React.FC = () => {
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

export default EChartsAdminSettingsPage;
