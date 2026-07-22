/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Alert, Button, Card, Empty, Input, Modal, Space, Spin, message } from 'antd';
import React, { useEffect, useState } from 'react';
import {
  createRemoteEChartsTheme,
  deleteRemoteEChartsTheme,
  updateRemoteEChartsTheme,
} from '../echarts/echartsConfigStorage';
import { type EChartsTheme } from '../echarts/echartsThemes';
import { getEChartsConfigApi, useEChartsGlobalConfig } from '../hooks';
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

/**
 * 插件设置中心里的「ECharts configuration」页面（v1）。
 *
 * 2026-07-21 第二次拍板 + 第三次反馈补 JSON 编辑器:
 *   - 主题定义在服务端 themeConfig 表里,每行一个主题;
 *   - admin 在本页面:
 *     - **C**: 新建 echarts-* 主题(uid + config JSON);
 *     - **R**: 看列表 + 看每行 config JSON;
 *     - **U**: 编辑每行 config JSON、Set as default 翻 default 标志;
 *     - **D**: 删除非内置主题(!isBuiltIn 的才能删,内置的 plugin seed 会重新补上)。
 */
export const EChartsAdminSettings: React.FC = () => {
  const t = useT();
  const { themes, defaultThemeUid, setDefaultTheme, reload } = useEChartsGlobalConfig();
  const [editors, setEditors] = useState<Record<string, ThemeEditorState>>({});
  const [reloading, setReloading] = useState(false);
  const [pendingDefaultUid, setPendingDefaultUid] = useState<string | null>(null);
  const [pendingDeleteUid, setPendingDeleteUid] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createUid, setCreateUid] = useState('');
  const [createConfig, setCreateConfig] = useState('{\n  "color": []\n}');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // 拉一次 themes 后,初始化 / 同步每张卡的 editor state。
  useEffect(() => {
    setEditors((prev) => {
      const next: Record<string, ThemeEditorState> = {};
      for (const t2 of themes) {
        const savedJson = JSON.stringify(t2.config ?? {}, null, 2);
        const existing = prev[t2.uid];
        // 已有 draft 但远端 config 变了(其他 admin 改过)→ 用远端覆盖
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

  const handleSaveConfig = async (uid: string) => {
    const theme = themes.find((t2) => t2.uid === uid);
    const editor = editors[uid];
    if (!theme || !editor || theme.id == null) return;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(editor.draft);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setEditor(uid, { error: t('Config must be a JSON object') });
        return;
      }
    } catch (e) {
      setEditor(uid, { error: t('Invalid JSON') });
      return;
    }

    setEditor(uid, { saving: true, error: null });
    try {
      const api = getEChartsConfigApi();
      if (!api) throw new Error('app not ready');
      await updateRemoteEChartsTheme(
        api as never,
        theme.id,
        { config: parsed },
      );
      message.success(t('Theme config saved'));
      setEditor(uid, { draft: editor.draft, saved: editor.draft, saving: false, error: null });
      await reload();
    } catch (err) {
      setEditor(uid, { saving: false, error: t('Save failed') });
      console.error('[echarts-global-config] save config failed', err);
    }
  };

  const handleSetDefault = async (uid: string) => {
    if (uid === defaultThemeUid) return;
    setPendingDefaultUid(uid);
    try {
      await setDefaultTheme(uid);
      message.success(t('ECharts default theme updated'));
    } catch (err) {
      message.error(t('Failed to update ECharts default theme'));
      console.error('[echarts-global-config] setDefaultTheme failed', err);
    } finally {
      setPendingDefaultUid(null);
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
          const api = getEChartsConfigApi();
          if (!api) throw new Error('app not ready');
          await deleteRemoteEChartsTheme(api as never, theme.id as number);
          message.success(t('Theme deleted'));
          await reload();
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
    if (!trimmedUid) {
      setCreateError(t('UID is required'));
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
      const api = getEChartsConfigApi();
      if (!api) throw new Error('app not ready');
      await createRemoteEChartsTheme(api as never, trimmedUid, parsed);
      message.success(t('Theme created'));
      setCreateOpen(false);
      setCreateUid('');
      setCreateConfig('{\n  "color": []\n}');
      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCreateError(msg);
      console.error('[echarts-global-config] create failed', err);
    } finally {
      setCreating(false);
    }
  };

  const handleReload = async () => {
    setReloading(true);
    try {
      await reload();
    } finally {
      setReloading(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <h2 style={{ marginTop: 0 }}>{t('ECharts configuration')}</h2>
      <p style={{ color: 'rgba(0,0,0,0.65)' }}>
        {t(
          'Each ECharts theme is a row in the server-side themeConfig table. Edit the JSON config inline, set the platform-wide default, or add/remove themes.',
        )}
      </p>
      <Space style={{ marginBottom: 12 }}>
        <Button onClick={handleReload} loading={reloading}>
          {t('Reload')}
        </Button>
        <Button type="primary" onClick={() => setCreateOpen(true)}>
          {t('Add theme')}
        </Button>
      </Space>
      {themes.length === 0 ? (
        <Empty
          description={
            <span>
              {t('No ECharts themes found.')}{' '}
              {t('Use "Add theme" to create one, or restart the server to re-seed built-ins.')}
            </span>
          }
        />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          {defaultThemeUid ? null : (
            <Alert
              type="warning"
              showIcon
              message={t('No default ECharts theme is set. <ECharts> will fall back to ECharts default.')}
            />
          )}
          {themes.map((theme) => {
            const isDefault = theme.uid === defaultThemeUid;
            const editor = editors[theme.uid] ?? EMPTY_DRAFT;
            const dirty = editor.draft !== editor.saved;
            return (
              <Card
                key={theme.uid}
                size="small"
                title={
                  <Space>
                    <span>{theme.uid}</span>
                    {theme.isBuiltIn ? (
                      <span style={{ color: '#999' }}>· {t('built-in')}</span>
                    ) : null}
                    {isDefault ? (
                      <strong style={{ color: '#52c41a' }}>· {t('default')}</strong>
                    ) : null}
                    {dirty ? <span style={{ color: '#faad14' }}>· {t('unsaved')}</span> : null}
                  </Space>
                }
                extra={
                  <Space>
                    {isDefault ? (
                      <Button disabled>{t('Current default')}</Button>
                    ) : (
                      <Button
                        loading={pendingDefaultUid === theme.uid}
                        onClick={() => handleSetDefault(theme.uid)}
                      >
                        {t('Set as default')}
                      </Button>
                    )}
                    {!theme.isBuiltIn ? (
                      <Button
                        danger
                        loading={pendingDeleteUid === theme.uid}
                        onClick={() => handleDelete(theme)}
                      >
                        {t('Delete')}
                      </Button>
                    ) : null}
                  </Space>
                }
              >
                <Input.TextArea
                  value={editor.draft}
                  onChange={(e) => setEditor(theme.uid, { draft: e.target.value, error: null })}
                  rows={10}
                  spellCheck={false}
                  status={editor.error ? 'error' : undefined}
                  style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
                />
                {editor.error ? (
                  <div style={{ color: '#ff4d4f', marginTop: 4, fontSize: 12 }}>{editor.error}</div>
                ) : null}
                <Space style={{ marginTop: 8 }}>
                  <Button
                    type="primary"
                    onClick={() => handleSaveConfig(theme.uid)}
                    loading={editor.saving}
                    disabled={!dirty}
                  >
                    {t('Save config')}
                  </Button>
                  <Button
                    onClick={() => setEditor(theme.uid, { draft: editor.saved, error: null })}
                    disabled={!dirty}
                  >
                    {t('Reset')}
                  </Button>
                </Space>
              </Card>
            );
          })}
        </Space>
      )}
      {reloading ? <Spin style={{ marginTop: 12 }} /> : null}

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
          <Input
            value={createUid}
            onChange={(e) => setCreateUid(e.target.value)}
            placeholder="echarts-my-theme"
          />
          <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12, marginTop: 4 }}>
            {t('Must match /echarts-[a-zA-Z0-9_-]+/')}
          </div>
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
        {createError ? (
          <div style={{ color: '#ff4d4f', marginTop: 8 }}>{createError}</div>
        ) : null}
      </Modal>
    </div>
  );
};
