import { Migration } from '@nocobase/server';

export default class extends Migration {
  async up() {
    const { db } = this;

    await db.collection({
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
    }).sync();

    await db.addIndex(['uid'], { unique: true });
  }
}
