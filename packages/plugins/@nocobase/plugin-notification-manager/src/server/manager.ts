/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import { Registry } from '@nocobase/utils';
import { Plugin } from '@nocobase/server';
import PluginNotificationManagerServer from './plugin';
import type { NotificationServer } from './types';
import { SendOptions, IChannel, WriteLogOptions } from './types';
interface NotificatonType {
  Server: new () => NotificationServer;
}

export default class NotificationManager {
  plugin: PluginNotificationManagerServer;
  notificationTypes = new Registry<{ server: NotificationServer }>();

  constructor({ plugin }: { plugin: PluginNotificationManagerServer }) {
    this.plugin = plugin;
  }
  registerTypes(type: string, config: NotificatonType) {
    const server = new config.Server();
    this.notificationTypes.register(type, { server });
  }
  createSendingRecord = async (options: WriteLogOptions) => {
    const logsRepo = this.plugin.app.db.getRepository('messageLogs');
    return logsRepo.create({ values: options });
  };

  async send(options: SendOptions) {
    this.plugin.logger.info('receive sending message request', options);
    const channelsRepo = this.plugin.app.db.getRepository('channels');
    const channel: IChannel = await channelsRepo.findOne({ filterByTk: options.channelId });
    const notificationServer = this.notificationTypes.get(channel.notificationType).server;
    const results = await notificationServer.send({ message: options, channel });
    results.forEach(async (result) => {
      await this.createSendingRecord({
        receiver: result.receiver,
        status: result.status,
        content: result.content,
        triggerFrom: options.triggerFrom,
        channelId: options.channelId,
        reason: result.reason,
      });
    });
  }
}
