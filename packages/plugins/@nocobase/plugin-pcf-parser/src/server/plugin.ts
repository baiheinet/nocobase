import { Plugin } from '@nocobase/server';

export class PluginPCFParserServer extends Plugin {
  async beforeLoad() {
    this.app.resourcer.define({
      name: 'pcf-parser',
      actions: {
        parse: {
          handler: this.parseAction.bind(this),
        },
      },
      only: ['parse'],
    });

    this.app.acl.registerSnippet({
      name: ['pm', this.name, 'configuration'].join('.'),
      actions: ['pcf-parser:parse'],
    });

    this.app.acl.allow('pcf-parser', 'parse', 'loggedIn');
  }

  async load() {}

  private async parseAction(context: any, next: any) {
    const { parsePCF } = await import('./routes/parse');
    return parsePCF(context, next);
  }
}

export default PluginPCFParserServer;
