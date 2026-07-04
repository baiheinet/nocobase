import { DataBlockModel } from '@nocobase/client-v2';
import React from 'react';
import { PcfIsoViewer } from '../components/PcfIsoViewer';
import { SessionSelect } from '../components/SessionSelect';
import { tExpr } from '../../locale';

export class PcfIsoBlockModel extends DataBlockModel {
  renderComponent() {
    const sessionId = this.props?.sessionId || '';
    const unitDisplay = this.props?.unitDisplay || 'original';
    const projection = this.props?.projection || 'isometric';
    const angle = this.props?.angle ?? 30;
    const showLabels = this.props?.showLabels !== false;
    const { heightMode, height } = (this as any).decoratorProps || {};
    return (
      <PcfIsoViewer
        sessionId={sessionId}
        unitDisplay={unitDisplay}
        projection={projection}
        angle={angle}
        showLabels={showLabels}
        heightMode={heightMode}
        height={height}
        model={this}
      />
    );
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
        projection: {
          type: 'string',
          'x-component': 'Select',
          'x-decorator': 'FormItem',
          title: tExpr('Projection'),
          enum: [
            { label: tExpr('Isometric'), value: 'isometric' },
          ],
          default: 'isometric',
        },
        angle: {
          type: 'number',
          'x-component': 'Slider',
          'x-decorator': 'FormItem',
          title: tExpr('Isometric angle'),
          'x-component-props': {
            min: 1,
            max: 89,
          },
          default: 30,
        },
        showLabels: {
          type: 'boolean',
          'x-component': 'Switch',
          'x-decorator': 'FormItem',
          title: tExpr('Show component labels'),
          default: true,
        },
      },
      handler(ctx, params) {
        ctx.model.setProps({
          sessionId: params.sessionId || '',
          unitDisplay: params.unitDisplay || 'original',
          projection: params.projection || 'isometric',
          angle: params.angle ?? 30,
          showLabels: params.showLabels !== false,
        });
      },
    },
  },
});

export default PcfIsoBlockModel;
