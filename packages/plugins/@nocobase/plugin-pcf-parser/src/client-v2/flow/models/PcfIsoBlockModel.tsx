import { DataBlockModel } from '@nocobase/client-v2';
import React from 'react';
import { PcfIsoViewer } from '../components/PcfIsoViewer';
import { SessionSelect } from '../components/SessionSelect';
import { tExpr } from '../../locale';

export class PcfIsoBlockModel extends DataBlockModel {
  renderComponent() {
    const sessionId = this.props?.sessionId || '';
    const unitDisplay = this.props?.unitDisplay || 'original';
    return <PcfIsoViewer sessionId={sessionId} unitDisplay={unitDisplay} model={this} />;
  }
}

PcfIsoBlockModel.define({
  label: tExpr('PCF ISO Viewer'),
});

PcfIsoBlockModel.registerFlow({
  key: 'pcfIsoSettings',
  title: tExpr('PCF ISO Settings'),
  steps: {
    selectSession: {
      title: tExpr('Select session'),
      uiSchema: {
        sessionId: {
          type: 'string',
          'x-component': SessionSelect,
          'x-decorator': 'FormItem',
          title: tExpr('Session'),
        },
        unitDisplay: {
          type: 'string',
          'x-component': 'Select',
          'x-decorator': 'FormItem',
          title: tExpr('Unit display'),
          enum: [
            { label: tExpr('Original'), value: 'original' },
            { label: tExpr('Meter'), value: 'meter' },
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

export default PcfIsoBlockModel;
