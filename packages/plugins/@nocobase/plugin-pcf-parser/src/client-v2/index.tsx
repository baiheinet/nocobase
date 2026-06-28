import { Plugin } from '@nocobase/client-v2';
import { PCFParserPage } from '../client/routes/pcf-parser';

export class PluginPCFParserClientV2 extends Plugin {
  async load() {
    this.pluginSettingsManager.addMenuItem({
      key: 'pcf-parser',
      title: this.t('PCF Parser'),
      icon: 'FileTextOutlined',
      isPinned: true,
      sort: 300,
    });
    this.pluginSettingsManager.addPageTabItem({
      menuKey: 'pcf-parser',
      key: 'pcf-parser',
      title: this.t('Parse PCF'),
      icon: 'FileTextOutlined',
      aclSnippet: 'pm.pcf-parser',
      Component: PCFParserPage,
    });
  }
}

export default PluginPCFParserClientV2;
