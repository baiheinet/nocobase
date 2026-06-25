import { Plugin } from '@nocobase/client';
import { PCFParserPage } from './routes/pcf-parser';

export class PluginPCFParserClient extends Plugin {
  async load() {
    this.app.router.add('pcf-parser', {
      path: '/admin/pcf-parser',
      element: PCFParserPage,
    });
  }
}

export default PluginPCFParserClient;
