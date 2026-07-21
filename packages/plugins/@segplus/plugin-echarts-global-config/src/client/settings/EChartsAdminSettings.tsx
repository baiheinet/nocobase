/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Alert, Button, Card, Empty, Space, Spin, message } from 'antd';
import React, { useState } from 'react';
import { useEChartsGlobalConfig } from '../hooks';
import { useT } from '../locale';

/**
 * 插件设置中心里的「ECharts configuration」页面（v1）。
 *
 * 模型（2026-07-21 用户拍板，第二次修正）：
 *   - 主题定义在服务端 themeConfig 表里，每行一个主题（uid='echarts-vintage' / 'echarts-macarons'）；
 *   - 全局默认主题由行的 `default` 标志位标记（仅一个为 true）；
 *   - admin 在本页面点 "Set as default" 调 themeConfig:update 翻转 `default` 标志。
 *
 * 与个人中心「ECharts theme」下拉的区别：个人中心改的是 localStorage 的 userTheme
 * （个人级覆盖），本页面改的是 DB 的 `default` 标志（平台级默认）。
 */
export const EChartsAdminSettings: React.FC = () => {
  const t = useT();
  const { themes, defaultThemeUid, setDefaultTheme, reload } = useEChartsGlobalConfig();
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);

  const handleSetDefault = async (uid: string) => {
    if (uid === defaultThemeUid) return;
    setPendingUid(uid);
    try {
      await setDefaultTheme(uid);
      message.success(t('ECharts default theme updated'));
    } catch (err) {
      message.error(t('Failed to update ECharts default theme'));
      console.error('[echarts-global-config] setDefaultTheme failed', err);
    } finally {
      setPendingUid(null);
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
    <div style={{ padding: 24, maxWidth: 800 }}>
      <h2 style={{ marginTop: 0 }}>{t('ECharts configuration')}</h2>
      <p style={{ color: 'rgba(0,0,0,0.65)' }}>
        {t(
          'Set the platform-wide default ECharts theme. The default theme is used when an <ECharts> instance has no theme prop and the current user has not picked a personal one.',
        )}
      </p>
      <div style={{ marginBottom: 12 }}>
        <Space>
          <Button onClick={handleReload} loading={reloading}>
            {t('Reload')}
          </Button>
        </Space>
      </div>
      {themes.length === 0 ? (
        <Empty
          description={
            <span>
              {t('No ECharts themes found.')}{' '}
              {t('Themes are stored in the server-side themeConfig table.')}
            </span>
          }
        >
          <Button onClick={handleReload} loading={reloading}>
            {t('Reload')}
          </Button>
        </Empty>
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
            return (
              <Card
                key={theme.uid}
                size="small"
                title={
                  <Space>
                    <span>{theme.uid}</span>
                    {theme.isBuiltIn ? <span style={{ color: '#999' }}>· {t('built-in')}</span> : null}
                    {isDefault ? <strong style={{ color: '#52c41a' }}>· {t('default')}</strong> : null}
                  </Space>
                }
                extra={
                  <Button
                    type={isDefault ? 'default' : 'primary'}
                    disabled={isDefault}
                    loading={pendingUid === theme.uid}
                    onClick={() => handleSetDefault(theme.uid)}
                  >
                    {isDefault ? t('Current default') : t('Set as default')}
                  </Button>
                }
              >
                <pre
                  style={{
                    background: '#fafafa',
                    padding: 12,
                    borderRadius: 4,
                    fontSize: 12,
                    margin: 0,
                    maxHeight: 200,
                    overflow: 'auto',
                  }}
                >
                  {JSON.stringify(theme.config, null, 2)}
                </pre>
              </Card>
            );
          })}
        </Space>
      )}
      {reloading ? <Spin style={{ marginTop: 12 }} /> : null}
    </div>
  );
};
