import { DataBlockModel, tExpr } from '@nocobase/client-v2';
import React from 'react';
import { Pcf3DViewer } from '../components/Pcf3DViewer';
import { SessionSelect } from '../components/SessionSelect';

export class Pcf3DBlockModel extends DataBlockModel {
  renderComponent() {
    const sessionId = this.props?.sessionId || '';
    const unitDisplay = this.props?.unitDisplay || 'original';
    return <Pcf3DViewer sessionId={sessionId} unitDisplay={unitDisplay} model={this} />;
  }
}

Pcf3DBlockModel.define({
  label: tExpr('PCF 3D Viewer', { ns: 'pcf-parser' }),
});

Pcf3DBlockModel.registerFlow({
  key: 'pcf3dSettings',
  title: tExpr('PCF 3D Settings', { ns: 'pcf-parser' }),
  steps: {
    selectSession: {
      title: tExpr('Select session', { ns: 'pcf-parser' }),
      uiSchema: {
        sessionId: {
          type: 'string',
          'x-component': SessionSelect,
          'x-decorator': 'FormItem',
          title: tExpr('Session', { ns: 'pcf-parser' }),
        },
        unitDisplay: {
          type: 'string',
          'x-component': 'Select',
          'x-decorator': 'FormItem',
          title: tExpr('Unit display', { ns: 'pcf-parser' }),
          enum: [
            { label: tExpr('Original', { ns: 'pcf-parser' }), value: 'original' },
            { label: tExpr('Meter', { ns: 'pcf-parser' }), value: 'meter' },
          ],
          default: 'original',
        },
      },
      handler(ctx, params) {
        ctx.model.setProps({
          sessionId: params.sessionId || '',
          unitDisplay: params.unitDisplay || 'original',
        });
      },
    },
  },
});

export default Pcf3DBlockModel;
