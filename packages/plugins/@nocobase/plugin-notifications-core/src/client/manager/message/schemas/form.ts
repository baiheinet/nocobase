/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

export const formProperties = {
  title: {
    'x-component': 'CollectionField',
    'x-decorator': 'FormItem',
  },
  channel: {
    'x-component': 'CollectionField',
    'x-decorator': 'FormItem',
    'x-collection-field': 'messages.channel',
  },
  receiver: {
    'x-component': 'CollectionField',
    'x-decorator': 'FormItem',
  },
  message: {
    'x-component': 'CollectionField',
    'x-decorator': 'FormItem',
  },
};
