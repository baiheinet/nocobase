import React from 'react';
import { Navigate } from 'react-router-dom';
import { Plugin } from '@nocobase/client';
import { PCFParserPage } from './routes/pcf-parser';
import { Pcf3DBlockModel } from '../client-v2/flow/models/Pcf3DBlockModel';

export class PluginPCFParserClient extends Plugin {
  async load() {
    this.app.pluginSettingsManager.add('pcf-parser', {
      title: 'PCF Parser',
      icon: 'FileTextOutlined',
      Component: PCFParserPage,
    });

    this.app.router.add('admin.pcf-parser-redirect', {
      path: '/admin/pcf-parser',
      element: <Navigate to="/admin/settings/pcf-parser" replace />,
    });

    this.app.flowEngine.registerModels({ Pcf3DBlockModel });
  }
}

export default PluginPCFParserClient;
