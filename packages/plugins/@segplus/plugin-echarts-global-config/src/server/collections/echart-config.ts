import { defineCollection } from '@nocobase/database';

export default defineCollection({
  name: 'echartConfig',
  fields: [
    { type: 'string', name: 'name' },
    { type: 'string', name: 'uid', unique: true },
    { type: 'text', name: 'description' },
    { type: 'json', name: 'config' },
    { type: 'boolean', name: 'isBuiltIn', defaultValue: false },
    { type: 'boolean', name: 'isDefault', defaultValue: false },
    { type: 'belongsTo', name: 'createdBy', target: 'users' },
  ],
});
