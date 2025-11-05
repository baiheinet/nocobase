/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React from 'react';
import { L7MapComponent } from './L7Map';

/**
 * Unified Map Component using L7
 * Supports Mapbox, AMap (Gaode), and Google Maps
 */
export const MapComponent = React.forwardRef<any, any>((props, ref) => {
  return <L7MapComponent ref={ref} {...props} />;
});
MapComponent.displayName = 'MapComponent';
