import * as logger from "./utils/logger.ts";
import GithubEvent from "./models/GithubEvent.ts";
import SlackMessage from "./models/SlackMessage.ts";
import SlackCommand from "./models/SlackCommand.ts";
import { Actions, EmojiMap } from "./const.ts";
import SlackClient from "./slack/client.ts";
import { PostgresStorage } from "./storage/postgres.ts";
import {
  formatEventList,
  getDirectNotificationMessage,
  getMessage,
  getPrUrlsFromString,
  shouldAddEmoji,
  shouldNotify,
} from "./utils/helpers.ts";
import {
  APP_NAME,
  HELP_MESSAGE,
  UNKNOWN_COMMAND_MESSAGE,
  UNKNOWN_USER_MESSAGE,
} from "./const.ts";
import { SlackSubcommands } from "./models/SlackSubcommand.ts";
import SlackSubscribeSubcommand from "./models/SlackSubscribeSubcommand.ts";
import SlackUnsubscribeSubcommand from "./models/SlackUnsubscribeSubcommand.ts";
import SlackGitHubUsernameSubcommand from "./models/SlackGitHubUsernameSubcommand.ts";
import SlackCleanupSubcommand from "./models/SlackCleanupSubcommand.ts";

export class PrmojiApp {
  storage: PostgresStorage;
  slackClient: SlackClient;
  notificationsChannelId: string | null;

  constructor(
    storage: PostgresStorage,
    slackClient: SlackClient,
    notificationsChannelId: string | null = null,
  ) {
    logger.debug("[app] Initializing PrmojiApp instance");
    this.storage = storage;
    this.slackClient = slackClient;
    this.notificationsChannelId = notificationsChannelId;
  }

  async handleMessage(message: SlackMessage) {
    logger.info(
      "[app] Received Slack message",
      message.text ? message.text.substr(0, 8) : "(no message text)",
    );
    if (!message.text || !message.channel || !message.timestamp) {
      logger.debug("[app] Missing field(s), discarding message.");
      return;
    }

    const prUrlsInMessage = getPrUrlsFromString(message.text);
    logger.debug(
      "[app] PR URLs in message:",
      prUrlsInMessage.length > 0 ? prUrlsInMessage : "none",
    );

    for (const prUrl of prUrlsInMessage) {
      logger.debug("[app] Storing", prUrl);
      await this.storage.store(prUrl, message.channel, message.timestamp);
    }
  }

  async handlePrEvent(event: GithubEvent) {
    logger.info("[app] Received PR event:", event.number || "(no PR number)");
    if (!event.url || !event.action) {
      logger.debug("[app] Missing field(s), discarding PR event.");
      return;
    }

    logger.debug("[app] Looking up PR in the storage");
    const result = await this.storage.get(event.url);

    if (!result) {
      logger.debug("[app] No matching item found, discarding event.");
      return;
    }

    logger.debug(
      "[app] Got",
      result.length,
      "matching item" + (result.length === 1 ? "" : "s"),
    );

    if (result.length > 0) {
      const emoji = EmojiMap[event.action];
      logger.debug("[app] Selected emoji:", emoji);

      if (!emoji) {
        logger.debug("[app] No emoji for this event, discarding.");
        return;
      }

      if (shouldAddEmoji(event)) {
        for (const item of result) {
          logger.info("[app] Adding emoji", emoji);

          try {
            await this.slackClient.addEmoji(
              emoji,
              item.messageChannel,
              item.messageTimestamp,
            );
          } catch (e) {
            logger.error("[app] Error adding emoji:", e);
          }
        }
      } else {
        logger.info("[app] Should not add emoji for this event.");
      }

      // send merge notification to the configured channel
      if (this.notificationsChannelId && shouldNotify(event)) {
        logger.info(
          "[app] Event meets notification criteria, sending message.",
        );
        try {
          await this.slackClient.sendMessage(
            getMessage(event),
            this.notificationsChannelId,
          );
        } catch (e) {
          logger.error("[app] Error sending message:", e);
        }
      } else {
        logger.info(
          "[app] Event does not meet notification criteria, not sending message",
        );
      }

      // send direct activity notification to subscribed user
      if (event.author !== undefined) {
        const user = await this.storage.getUserByGitHubUsername(event.author);

        if (user && user.subscriptions.has(event.action)) {
          logger.info(
            "[app] User has subscribed to this event, sending message.",
          );
          await this.slackClient.sendMessage(
            getDirectNotificationMessage(event),
            user.slackId,
          );
        }
      }

      if (event.action === Actions.MERGED || event.action === Actions.CLOSED) {
        logger.debug("[app] Deleting", event.url);
        await this.storage.deleteByPrUrl(event.url);
      }
    }
  }

  async handleCommand(command: SlackCommand): Promise<string> {
    logger.info("[app] Received Slack command:", command);

    switch (command.subcommand.kind) {
      case SlackSubcommands.GITHUB_USERNAME: {
        const { username } = command
          .subcommand as SlackGitHubUsernameSubcommand;

        if (username) {
          await this.storage.setGitHubUsername(
            command.userId,
            username,
          );
          return `Your GitHub username is now set to \`${username}\`. Use \`/${APP_NAME} subscribe <event>\` to receive notifications about your PRs.`;
        } else {
          return `Your GitHub username is \`${await this.storage
            .getGitHubUsername(command.userId)}\``;
        }
      }

      case SlackSubcommands.SUBSCRIBE: {
        const { events } = command.subcommand as SlackSubscribeSubcommand;
        const username = await this.storage.getGitHubUsername(command.userId);

        if (!username) {
          return UNKNOWN_USER_MESSAGE;
        }

        const subscriptions = await this.storage
          .getSubscriptionsByUserId(command.userId);

        for (const event of events) {
          subscriptions.add(event);
        }

        await this.storage.setSubscriptionsByUserId(
          command.userId,
          subscriptions,
        );

        return `You will now be notified about ${
          formatEventList(events)
        } events.`;
      }

      case SlackSubcommands.UNSUBSCRIBE: {
        const { events } = command.subcommand as SlackUnsubscribeSubcommand;
        const username = await this.storage.getGitHubUsername(command.userId);

        if (!username) {
          return UNKNOWN_USER_MESSAGE;
        }

        const subscriptions = await this.storage
          .getSubscriptionsByUserId(command.userId);

        for (const event of events) {
          subscriptions.delete(event);
        }

        await this.storage.setSubscriptionsByUserId(
          command.userId,
          subscriptions,
        );

        return `You will no longer be notified about ${
          formatEventList(events)
        } events.`;
      }

      case SlackSubcommands.LIST_SUBSCRIPTIONS: {
        const username = await this.storage.getGitHubUsername(command.userId);

        if (!username) {
          return UNKNOWN_USER_MESSAGE;
        }

        const subscriptions = await this.storage.getSubscriptionsByUserId(
          command.userId,
        );

        return subscriptions.size === 0
          ? "You are not subscribed to any events."
          : `You are subscribed to the following events: ${
            formatEventList(subscriptions)
          }`;
      }

      case SlackSubcommands.CLEANUP: {
        const { days } = command.subcommand as SlackCleanupSubcommand;

        if (days) {
          await this.cleanupOld(days);
        } else {
          await this.cleanup();
        }

        return "Cleanup complete. :white_check_mark:";
      }

      case SlackSubcommands.HELP:
        return HELP_MESSAGE;

      default:
        return UNKNOWN_COMMAND_MESSAGE;
    }
  }

  cleanupOld(days = 7) {
    logger.info("[app] Cleaning up entries as old as", days, "days or older");
    return this.storage.deleteBeforeDays(days);
  }

  cleanup() {
    logger.info("[app] Cleaning up all entries");
    return this.storage.deleteAll();
  }
}
