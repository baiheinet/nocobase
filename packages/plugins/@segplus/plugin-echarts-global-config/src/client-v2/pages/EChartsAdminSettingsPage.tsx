/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { useFlowContext } from '@nocobase/flow-engine';
import { Alert, Button, Card, ColorPicker, Empty, Input, Modal, Space, Spin, Tabs, message } from 'antd';
import { useRequest } from 'ahooks';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as echarts from 'echarts';
import {
  createEChartsTheme,
  deleteEChartsTheme,
  listEChartsThemes,
  setEChartsThemeAsDefault,
  updateEChartsThemeConfig,
} from '../utils/echartsThemeApi';
import { type EChartsTheme, registerPreviewTheme, unregisterPreviewTheme } from '../echarts/echartsThemes';
import { useT } from '../locale';

interface ThemeEditorState {
  draft: string;
  saved: string;
  saving: boolean;
  error: string | null;
}

const EMPTY_DRAFT: ThemeEditorState = { draft: '', saved: '', saving: false, error: null };

function initState(theme: EChartsTheme): ThemeEditorState {
  return {
    draft: JSON.stringify(theme.config ?? {}, null, 2),
    saved: JSON.stringify(theme.config ?? {}, null, 2),
    saving: false,
    error: null,
  };
}

const PreviewChart: React.FC<{ theme: EChartsTheme }> = ({ theme }) => {
  const chartRef = React.useRef<HTMLDivElement>(null);
  const chartInstance = React.useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    if (chartInstance.current) {
      chartInstance.current.dispose();
    }
    const previewUid = `preview-${theme.uid}`;
    chartInstance.current = echarts.init(chartRef.current, previewUid);
    chartInstance.current.setOption({
      title: { text: theme.name || theme.uid },
      tooltip: { trigger: 'axis' },
      legend: { data: ['Sales'] },
      xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
      yAxis: { type: 'value' },
      series: [{ name: 'Sales', type: 'line', data: [120, 200, 150, 80, 70, 110, 130] }],
    });
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, [theme.uid, theme.name]);

  return <div ref={chartRef} style={{ width: '100%', height: 300 }} />;
};

/**
 * ECharts 主题编辑器页面（v2 / client-v2）。
 *
 * 基于 Apache ECharts 主题编辑器 (https://echarts.apache.org/zh/theme-builder.html) 设计。
 * 左 sidebar 主题列表 + 右侧结构化编辑器 + 实时预览 + Form/JSON Tab。
 */
const EChartsAdminSettingsPage: React.FC = () => {
  const t = useT();
  const ctx = useFlowContext();
  const {
    data: themes = [],
    loading,
    refresh,
  } = useRequest(() => listEChartsThemes(ctx.api), { refreshDeps: [ctx.api] });
  const [editors, setEditors] = useState<Record<string, ThemeEditorState>>({});
  const [pendingDeleteUid, setPendingDeleteUid] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createUid, setCreateUid] = useState('');
  const [createName, setCreateName] = useState('');
  const [createConfig, setCreateConfig] = useState('{\n  "color": []\n}');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Currently selected theme
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const selectedTheme = useMemo(() => themes.find((t) => t.uid === selectedUid) ?? null, [themes, selectedUid]);

  // Auto-select first theme if none selected
  useEffect(() => {
    if (!selectedUid && themes.length > 0) {
      setSelectedUid(themes[0].uid);
    }
  }, [selectedUid, themes]);

  useEffect(() => {
    setEditors((prev) => {
      const next: Record<string, ThemeEditorState> = {};
      for (const t2 of themes) {
        const savedJson = JSON.stringify(t2.config ?? {}, null, 2);
        const existing = prev[t2.uid];
        if (!existing || existing.saved !== savedJson) {
          next[t2.uid] = initState(t2);
        } else {
          next[t2.uid] = existing;
        }
      }
      return next;
    });
  }, [themes]);

  const setEditor = (uid: string, patch: Partial<ThemeEditorState>) => {
    setEditors((prev) => ({ ...prev, [uid]: { ...(prev[uid] ?? EMPTY_DRAFT), ...patch } }));
  };

  // Parse config from draft string
  const parseConfig = useCallback(
    (uid: string): Record<string, unknown> | null => {
      const editor = editors[uid];
      if (!editor) return null;
      try {
        const parsed = JSON.parse(editor.draft);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          setEditor(uid, { error: t('Config must be a JSON object') });
          return null;
        }
        return parsed;
      } catch {
        setEditor(uid, { error: t('Invalid JSON') });
        return null;
      }
    },
    [editors, t],
  );

  // Update preview theme when config changes
  useEffect(() => {
    if (selectedUid) {
      const config = parseConfig(selectedUid);
      if (config) {
        registerPreviewTheme(selectedUid, config);
      }
    }
  }, [selectedUid, editors[selectedUid]?.draft, parseConfig]);

  // Cleanup preview themes on unmount
  useEffect(() => {
    return () => {
      themes.forEach((t) => t.uid && unregisterPreviewTheme(t.uid));
    };
  }, []);

  const handleSaveConfig = async (uid: string) => {
    const theme = themes.find((t2) => t2.uid === uid);
    const editor = editors[uid];
    if (!theme || !editor || theme.id == null) return;

    const parsed = parseConfig(uid);
    if (!parsed) return;

    setEditor(uid, { saving: true, error: null });
    try {
      await updateEChartsThemeConfig(ctx.api, theme.id, parsed);
      // 改完 config 后,echarts 全局的主题通过 reload 时 Provider 重新 register 拿到。
      // data-visualization chart 实例已经 init 的不会自动 re-render —— admin
      // 自己 reload 一下整页即可。
      message.success(t('Theme config saved'));
      setEditor(uid, { draft: editor.draft, saved: editor.draft, saving: false, error: null });
      await refresh();
    } catch (err) {
      setEditor(uid, { saving: false, error: t('Save failed') });
      console.error('[echarts-global-config] save config failed', err);
    }
  };

  const handleSetDefault = async (theme: EChartsTheme) => {
    if (theme.id == null) return;
    try {
      await setEChartsThemeAsDefault(ctx.api, theme.id, themes);
      message.success(t('Default theme updated'));
      await refresh();
    } catch (err) {
      message.error(t('Update failed'));
      console.error('[echarts-global-config] set default failed', err);
    }
  };

  const handleDelete = async (theme: EChartsTheme) => {
    if (theme.isBuiltIn) return;
    if (theme.id == null) return;
    Modal.confirm({
      title: t('Delete theme'),
      content: t('Delete "{{uid}}"? This cannot be undone.', { uid: theme.uid }),
      okText: t('Delete'),
      okButtonProps: { danger: true },
      cancelText: t('Cancel'),
      onOk: async () => {
        setPendingDeleteUid(theme.uid);
        try {
          await deleteEChartsTheme(ctx.api, theme.id as number);
          message.success(t('Theme deleted'));
          if (selectedUid === theme.uid) {
            setSelectedUid(themes.find((t) => t.uid !== theme.uid)?.uid ?? null);
          }
          await refresh();
        } catch (err) {
          message.error(t('Delete failed'));
          console.error('[echarts-global-config] delete failed', err);
        } finally {
          setPendingDeleteUid(null);
        }
      },
    });
  };

  const handleCreate = async () => {
    setCreateError(null);
    const trimmedUid = createUid.trim();
    const trimmedName = createName.trim();
    if (!trimmedUid) {
      setCreateError(t('UID is required'));
      return;
    }
    if (!trimmedName) {
      setCreateError(t('Name is required'));
      return;
    }
    if (!/^echarts-[a-zA-Z0-9_-]+$/.test(trimmedUid)) {
      setCreateError(t('UID must match /echarts-[a-zA-Z0-9_-]+/'));
      return;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(createConfig);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setCreateError(t('Config must be a JSON object'));
        return;
      }
    } catch {
      setCreateError(t('Invalid JSON'));
      return;
    }
    setCreating(true);
    try {
      await createEChartsTheme(ctx.api, { uid: trimmedUid, name: trimmedName, config: parsed });
      message.success(t('Theme created'));
      setCreateOpen(false);
      setCreateUid('');
      setCreateName('');
      setCreateConfig('{\n  "color": []\n}');
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCreateError(msg);
      console.error('[echarts-global-config] create failed', err);
    } finally {
      setCreating(false);
    }
  };

  const handleReload = () => {
    refresh();
  };

  // Render structured form editor
  const renderFormEditor = (theme: EChartsTheme) => {
    const editor = editors[theme.uid] ?? EMPTY_DRAFT;
    let config: Record<string, unknown> = {};
    try {
      config = JSON.parse(editor.draft);
    } catch {
      // ignore
    }

    const updateConfig = (path: string, value: unknown) => {
      const newConfig = { ...config };
      const keys = path.split('.');
      let current: any = newConfig;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      setEditor(theme.uid, { draft: JSON.stringify(newConfig, null, 2), error: null });
    };

    return (
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        {/* Color Palette */}
        <Card size="small" title={t('Color palette')}>
          <Space wrap>
            {(config.color as string[] | undefined)?.map((color, index) => (
              <ColorPicker
                key={index}
                value={color}
                onChange={(_, hex) => updateConfig(`color.${index}`, hex)}
                showText
              />
            ))}
            <Button
              size="small"
              onClick={() => {
                const colors = (config.color as string[]) || [];
                updateConfig('color', [...colors, '#000000']);
              }}
            >
              + {t('Add color')}
            </Button>
          </Space>
        </Card>

        {/* Background */}
        <Card size="small" title={t('Background')}>
          <ColorPicker
            value={(config.backgroundColor as string) || 'transparent'}
            onChange={(_, hex) => updateConfig('backgroundColor', hex)}
            showText
          />
        </Card>

        {/* Text Style */}
        <Card size="small" title={t('Text style')}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <label>{t('Color')}</label>
              <ColorPicker
                value={(config.textStyle as any)?.color || '#333'}
                onChange={(_, hex) => updateConfig('textStyle.color', hex)}
                showText
              />
            </div>
            <div>
              <label>{t('Font family')}</label>
              <Input
                value={(config.textStyle as any)?.fontFamily || ''}
                onChange={(e) => updateConfig('textStyle.fontFamily', e.target.value)}
              />
            </div>
            <div>
              <label>{t('Font size')}</label>
              <Input
                type="number"
                value={(config.textStyle as any)?.fontSize || 12}
                onChange={(e) => updateConfig('textStyle.fontSize', parseInt(e.target.value) || 12)}
              />
            </div>
          </Space>
        </Card>

        {/* Title */}
        <Card size="small" title={t('Title')}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <label>{t('Show')}</label>
              <input
                type="checkbox"
                checked={(config.title as any)?.show !== false}
                onChange={(e) => updateConfig('title.show', e.target.checked)}
              />
            </div>
            <div>
              <label>{t('Color')}</label>
              <ColorPicker
                value={(config.title as any)?.textStyle?.color || '#333'}
                onChange={(_, hex) => updateConfig('title.textStyle.color', hex)}
                showText
              />
            </div>
          </Space>
        </Card>

        {/* Line */}
        <Card size="small" title={t('Line')}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <label>{t('Symbol')}</label>
              <Input
                value={(config.lineStyle as any)?.symbol || 'circle'}
                onChange={(e) => updateConfig('lineStyle.symbol', e.target.value)}
              />
            </div>
            <div>
              <label>{t('Symbol size')}</label>
              <Input
                type="number"
                value={(config.lineStyle as any)?.symbolSize || 10}
                onChange={(e) => updateConfig('lineStyle.symbolSize', parseInt(e.target.value) || 10)}
              />
            </div>
            <div>
              <label>{t('Line color')}</label>
              <ColorPicker
                value={(config.lineStyle as any)?.color || '#333'}
                onChange={(_, hex) => updateConfig('lineStyle.color', hex)}
                showText
              />
            </div>
            <div>
              <label>{t('Line width')}</label>
              <Input
                type="number"
                value={(config.lineStyle as any)?.width || 2}
                onChange={(e) => updateConfig('lineStyle.width', parseInt(e.target.value) || 2)}
              />
            </div>
          </Space>
        </Card>

        {/* Legend */}
        <Card size="small" title={t('Legend')}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <label>{t('Show')}</label>
              <input
                type="checkbox"
                checked={(config.legend as any)?.show !== false}
                onChange={(e) => updateConfig('legend.show', e.target.checked)}
              />
            </div>
            <div>
              <label>{t('Item width')}</label>
              <Input
                type="number"
                value={(config.legend as any)?.itemWidth || 20}
                onChange={(e) => updateConfig('legend.itemWidth', parseInt(e.target.value) || 20)}
              />
            </div>
            <div>
              <label>{t('Item height')}</label>
              <Input
                type="number"
                value={(config.legend as any)?.itemHeight || 14}
                onChange={(e) => updateConfig('legend.itemHeight', parseInt(e.target.value) || 14)}
              />
            </div>
          </Space>
        </Card>
      </Space>
    );
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
      {/* Left Sidebar - Theme List */}
      <div
        style={{
          width: 240,
          borderRight: '1px solid #f0f0f0',
          padding: 16,
          overflowY: 'auto',
        }}
      >
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>{t('Themes')}</h3>
          <Button size="small" onClick={handleReload} loading={loading}>
            {t('Reload')}
          </Button>
        </Space>
        <Button type="primary" style={{ width: '100%', marginBottom: 12 }} onClick={() => setCreateOpen(true)}>
          {t('Add theme')}
        </Button>
        {themes.length === 0 ? (
          <Empty description={t('No themes')} />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size={4}>
            {themes.map((theme) => (
              <div
                key={theme.uid}
                onClick={() => setSelectedUid(theme.uid)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderRadius: 4,
                  backgroundColor: selectedUid === theme.uid ? '#e6f7ff' : 'transparent',
                  border: `1px solid ${selectedUid === theme.uid ? '#1890ff' : 'transparent'}`,
                }}
              >
                <div style={{ fontWeight: 500 }}>{theme.name || theme.uid}</div>
                <div style={{ fontSize: 12, color: '#999' }}>
                  {theme.uid}
                  {theme.isBuiltIn && ` · ${t('built-in')}`}
                  {theme.isDefault && ` · ${t('default')}`}
                </div>
              </div>
            ))}
          </Space>
        )}
      </div>

      {/* Right Main Area - Editor */}
      <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
        {!selectedTheme ? (
          <Empty description={t('Select a theme to edit')} />
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>{selectedTheme.name || selectedTheme.uid}</h2>
              <div style={{ color: '#999' }}>
                {selectedTheme.uid}
                {selectedTheme.isBuiltIn && ` · ${t('built-in')}`}
                {selectedTheme.isDefault && ` · ${t('default fallback')}`}
              </div>
            </div>

            <Tabs
              defaultActiveKey="form"
              items={[
                {
                  key: 'form',
                  label: t('Form'),
                  children: renderFormEditor(selectedTheme),
                },
                {
                  key: 'json',
                  label: t('JSON'),
                  children: (
                    <div>
                      <Input.TextArea
                        value={editors[selectedTheme.uid]?.draft || ''}
                        onChange={(e) => setEditor(selectedTheme.uid, { draft: e.target.value, error: null })}
                        rows={20}
                        spellCheck={false}
                        status={editors[selectedTheme.uid]?.error ? 'error' : undefined}
                        style={{
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        }}
                      />
                      {editors[selectedTheme.uid]?.error && (
                        <div style={{ color: '#ff4d4f', marginTop: 4, fontSize: 12 }}>
                          {editors[selectedTheme.uid]?.error}
                        </div>
                      )}
                    </div>
                  ),
                },
              ]}
            />

            {/* Preview */}
            <Card size="small" title={t('Preview')} style={{ marginTop: 16 }}>
              <PreviewChart theme={selectedTheme} />
            </Card>

            {/* Action Buttons */}
            <Space style={{ marginTop: 16 }}>
              <Button
                type="primary"
                onClick={() => handleSaveConfig(selectedTheme.uid)}
                loading={editors[selectedTheme.uid]?.saving}
                disabled={editors[selectedTheme.uid]?.draft === editors[selectedTheme.uid]?.saved}
              >
                {t('Save')}
              </Button>
              <Button
                onClick={() =>
                  setEditor(selectedTheme.uid, {
                    draft: editors[selectedTheme.uid]?.saved || '',
                    error: null,
                  })
                }
                disabled={editors[selectedTheme.uid]?.draft === editors[selectedTheme.uid]?.saved}
              >
                {t('Reset')}
              </Button>
              {!selectedTheme.isDefault && (
                <Button onClick={() => handleSetDefault(selectedTheme)}>{t('Set as default')}</Button>
              )}
              {!selectedTheme.isBuiltIn && (
                <Button
                  danger
                  loading={pendingDeleteUid === selectedTheme.uid}
                  onClick={() => handleDelete(selectedTheme)}
                >
                  {t('Delete')}
                </Button>
              )}
            </Space>
          </>
        )}
      </div>

      {/* Create Theme Modal */}
      <Modal
        title={t('Add ECharts theme')}
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false);
          setCreateError(null);
        }}
        onOk={handleCreate}
        confirmLoading={creating}
        okText={t('Create')}
        cancelText={t('Cancel')}
        width={640}
      >
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>{t('UID')}</label>
          <Input value={createUid} onChange={(e) => setCreateUid(e.target.value)} placeholder="echarts-my-theme" />
          <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12, marginTop: 4 }}>
            {t('Must match /echarts-[a-zA-Z0-9_-]+/')}
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>{t('Name')}</label>
          <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="My Theme" />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4 }}>{t('Config (JSON)')}</label>
          <Input.TextArea
            value={createConfig}
            onChange={(e) => setCreateConfig(e.target.value)}
            rows={10}
            spellCheck={false}
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
          />
        </div>
        {createError && <div style={{ color: '#ff4d4f', marginTop: 8 }}>{createError}</div>}
      </Modal>
    </div>
  );
};

export default EChartsAdminSettingsPage;
