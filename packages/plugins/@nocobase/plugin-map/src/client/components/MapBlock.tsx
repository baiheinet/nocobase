/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { PopupContextProvider, withSkeletonComponent } from '@nocobase/client';
import React from 'react';
import { L7MapBlock } from './L7Map/Block';

/**
 * Unified Map Block Component using L7
 * Supports Mapbox, AMap (Gaode), and Google Maps
 */
export const MapBlockComponent: React.FC<any> = withSkeletonComponent(
  (props) => {
    return (
      <PopupContextProvider>
        <L7MapBlock {...props} />
      </PopupContextProvider>
    );
  },
  {
    displayName: 'MapBlockComponent',
  },
);
