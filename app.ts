import { createLabeledLogger } from "./utils/logger.ts";
import GithubEvent from "./models/github_event.ts";
import SlackMessage from "./models/slack_message.ts";
import SlackCommand from "./models/slack_command.ts";
import { Actions, MessageEmojiMap, PrActionEmojiMap } from "./const.ts";
import SlackClient from "./slack_client.ts";
import { PostgresStorage } from "./storage.ts";
import {
  formatEventList,
  getDirectNotificationMessage,
  getMessage,
  getPrUrlsFromString,
  shouldAddEmoji,
  shouldNotify,
} from "./utils/helpers.ts";
import {
  checkPrReleaseChecklist,
  PrCheckResultStatus,
} from "./utils/pr_checker.ts";
import {
  APP_NAME,
  HELP_MESSAGE,
  UNKNOWN_COMMAND_MESSAGE,
  UNKNOWN_USER_MESSAGE,
} from "./const.ts";
import { SlackSubcommands } from "./models/slack_subcommand.ts";
import SlackSubscribeSubcommand from "./models/slack_subscribe_subcommand.ts";
import SlackUnsubscribeSubcommand from "./models/slack_unsubscribe_subcommand.ts";
import SlackGitHubUsernameSubcommand from "./models/slack_github_username_subcommand.ts";
import SlackCleanupSubcommand from "./models/slack_cleanup_subcommand.ts";

const log = createLabeledLogger("app");

export class PrmojiApp {
  storage: PostgresStorage;
  slackClient: SlackClient;
  notificationsChannelId: string | null;

  constructor(
    storage: PostgresStorage,
    slackClient: SlackClient,
    notificationsChannelId: string | null = null,
  ) {
    log.debug("Initializing PrmojiApp instance");
    this.storage = storage;
    this.slackClient = slackClient;
    this.notificationsChannelId = notificationsChannelId;
  }

  async handleMessage(message: SlackMessage) {
    log.info(
      "Received Slack message",
      message.text ? message.text.substr(0, 8) : "(no message text)",
    );
    if (!message.text || !message.channel || !message.timestamp) {
      log.debug("Missing field(s), discarding message.");
      return;
    }

    const prUrlsInMessage = getPrUrlsFromString(message.text);
    log.debug(
      "PR URLs in message:",
      prUrlsInMessage.length > 0 ? prUrlsInMessage : "none",
    );

    for (const prUrl of prUrlsInMessage) {
      log.debug("Storing", prUrl);
      await this.storage.store(prUrl, message.channel, message.timestamp);
    }

    for (const [pattern, emoji] of MessageEmojiMap) {
      if (pattern.test(message.text)) {
        log.debug("Adding emoji", emoji);
        try {
          await this.slackClient.addEmoji(
            emoji,
            message.channel,
            message.timestamp,
          );
        } catch (e) {
          log.error(`Error adding emoji (${emoji}):`, e);
        }
      }
    }
  }

  async handlePrEvent(event: GithubEvent) {
    log.info("Received PR event:", event.number || "(no PR number)");

    if (!event.url || !event.action) {
      log.debug("Missing field(s), discarding PR event");
      return;
    }

    log.debug("Looking up PR in the storage");
    const result = await this.storage.get(event.url);

    if (!result) {
      log.debug("No matching item found, discarding event");
      return;
    }

    log.debug(
      `Got ${result.length} matching item ${result.length === 1 ? "" : "s"}`,
    );

    if (result.length > 0) {
      const emoji = PrActionEmojiMap[event.action];
      log.debug("Selected emoji:", emoji);

      if (!emoji) {
        log.debug("No emoji for this event, discarding.");
        return;
      }

      if (shouldAddEmoji(event)) {
        for (const item of result) {
          log.info("Adding emoji", emoji);

          try {
            await this.slackClient.addEmoji(
              emoji,
              item.messageChannel,
              item.messageTimestamp,
            );
          } catch (e) {
            log.error("Error adding emoji:", e);
          }
        }
      } else {
        log.info("Should not add emoji for this event");
      }

      // send merge notification to the configured channel
      if (this.notificationsChannelId && shouldNotify(event)) {
        log.info("Event meets notification criteria, sending message");
        try {
          await this.slackClient.sendMessage(
            getMessage(event),
            this.notificationsChannelId,
          );
        } catch (e) {
          log.error("Error sending message:", e);
        }
      } else {
        log.info(
          "Event does not meet notification criteria, not sending message",
        );
      }

      // send direct activity notification to subscribed user
      if (event.author !== undefined && event.sender !== event.author) {
        const user = await this.storage.getUserByGitHubUsername(event.author);

        if (user?.subscriptions.has(event.action)) {
          log.info("User has subscribed to this event, sending message");
          await this.slackClient.sendMessage(
            getDirectNotificationMessage(event),
            user.slackId,
          );
        }
      }

      if (event.action === Actions.CLOSED) {
        log.debug("Deleting", event.url);
        await this.storage.deleteByPrUrl(event.url);
      }
    }
  }

  async handleCommand(command: SlackCommand): Promise<string> {
    log.info("Received Slack command:", command);

    switch (command.subcommand.kind) {
      case SlackSubcommands.GITHUB_USERNAME: {
        const { username } = command
          .subcommand as SlackGitHubUsernameSubcommand;

        if (username) {
          await this.storage.setGitHubUsername(command.userId, username);
          return `Your GitHub username is now set to \`${username}\`. Use \`/${APP_NAME} subscribe <event>\` to receive notifications about your PRs.`;
        } else {
          return `Your GitHub username is \`${await this.storage
            .getGitHubUsername(
              command.userId,
            )}\``;
        }
      }

      case SlackSubcommands.SUBSCRIBE: {
        const { events } = command.subcommand as SlackSubscribeSubcommand;
        const username = await this.storage.getGitHubUsername(command.userId);

        if (!username) {
          return UNKNOWN_USER_MESSAGE;
        }

        const subscriptions = await this.storage.getSubscriptionsByUserId(
          command.userId,
        );

        for (const event of events) {
          subscriptions.add(event);
        }

        await this.storage.setSubscriptionsByUserId(
          command.userId,
          subscriptions,
        );

        return `You will now be notified about ${
          formatEventList(
            events,
          )
        } events.`;
      }

      case SlackSubcommands.UNSUBSCRIBE: {
        const { events } = command.subcommand as SlackUnsubscribeSubcommand;
        const username = await this.storage.getGitHubUsername(command.userId);

        if (!username) {
          return UNKNOWN_USER_MESSAGE;
        }

        const subscriptions = await this.storage.getSubscriptionsByUserId(
          command.userId,
        );

        for (const event of events) {
          subscriptions.delete(event);
        }

        await this.storage.setSubscriptionsByUserId(
          command.userId,
          subscriptions,
        );

        return `You will no longer be notified about ${
          formatEventList(
            events,
          )
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
            formatEventList(
              subscriptions,
            )
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
    log.info("Cleaning up entries as old as", days, "days or older");
    return this.storage.deleteBeforeDays(days);
  }

  cleanup() {
    log.info("Cleaning up all entries");
    return this.storage.deleteAll();
  }

  introToUser(userId: string) {
    return this.slackClient.sendMessage(HELP_MESSAGE, userId);
  }

  async checkPrReleaseChecklists() {
    log.info("Checking PR release checklists");
    const prs = await this.storage.getAllPrs();

    for (const { prUrl } of prs) {
      log.info("Checking release checklist", prUrl);
      const { status, user } = await checkPrReleaseChecklist(prUrl);

      if (status === PrCheckResultStatus.Complete) {
        log.info("Deleting", prUrl);
        await this.storage.deleteByPrUrl(prUrl);
      } else if (status === PrCheckResultStatus.Incomplete && user) {
        log.info("Sending message about incomplete PR", prUrl);
        const userMetaData = await this.storage.getUserByGitHubUsername(user);

        if (userMetaData?.slackId) {
          await this.slackClient.sendMessage(
            `:warning: release checklist is not complete for <${prUrl}|your PR>, please review it and make sure all neccessary items are checked`,
            userMetaData.slackId,
          );
        }
      }
    }
  }
}
