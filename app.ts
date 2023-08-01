import { createLabeledLogger } from "./utils/logger.ts";
import GithubEvent from "./models/github_event.ts";
import SlackMessage from "./models/slack_message.ts";
import SlackCommand from "./models/slack_command.ts";
import { Actions, MessageEmojiMap, PrActionEmojiMap } from "./const.ts";
import { addEmoji, sendMessage } from "./slack.ts";
import { storage } from "./storage.ts";
import {
  formatEventList,
  getMergeNotificationMessage,
  getPrActionUserNotificationMessage,
  getPrUrlsFromString,
  shouldAddEmoji,
} from "./utils/helpers.ts";
import { PrValidationResultStatus, validatePr } from "./utils/validate_pr.ts";
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

const { info, debug, error } = createLabeledLogger("app");

export class PrmojiApp {
  notificationsChannelId: string | null;

  constructor(
    notificationsChannelId: string | null = null,
  ) {
    debug("initializing PrmojiApp instance");
    this.notificationsChannelId = notificationsChannelId;
  }

  async handleMessage(message: SlackMessage) {
    info(
      "received Slack message",
      message.text ? message.text.substr(0, 8) : "(no message text)",
    );
    if (!message.text || !message.channel || !message.timestamp) {
      debug("missing field(s), discarding message");
      return;
    }

    const prUrlsInMessage = getPrUrlsFromString(message.text);
    debug(
      "PR URLs in message:",
      prUrlsInMessage.length > 0 ? prUrlsInMessage : "none",
    );

    for (const prUrl of prUrlsInMessage) {
      debug("storing", prUrl);
      await storage.store(prUrl, message.channel, message.timestamp);
    }

    for (const [pattern, emoji] of MessageEmojiMap) {
      if (pattern.test(message.text)) {
        debug("adding emoji", emoji);
        try {
          await addEmoji(
            emoji,
            message.channel,
            message.timestamp,
          );
        } catch (e) {
          error(`error adding emoji (${emoji}):`, e);
        }
      }
    }
  }

  async handlePrEvent(event: GithubEvent) {
    info("received PR event:", event.number || "(no PR number)");

    if (!event.url || !event.action) {
      debug("missing field(s), discarding PR event");
      return;
    }

    debug("looking up PR in the storage");
    const result = await storage.get(event.url);

    if (!result) {
      debug("no matching item found, discarding event");
      return;
    }

    debug(
      `got ${result.length} matching item ${result.length === 1 ? "" : "s"}`,
    );

    if (result.length > 0) {
      const emoji = PrActionEmojiMap[event.action];
      debug("selected emoji:", emoji);

      if (!emoji) {
        debug("no emoji for this event, discarding");
        return;
      }

      if (shouldAddEmoji(event)) {
        for (const item of result) {
          info("adding emoji", emoji);

          try {
            await addEmoji(
              emoji,
              item.messageChannel,
              item.messageTimestamp,
            );
          } catch (e) {
            error("error adding emoji:", e);
          }
        }
      } else {
        info("should not add emoji for this event");
      }

      // send merge notification to the configured channel
      if (event.action === Actions.MERGED && this.notificationsChannelId) {
        info("sending merge message to the configured channel");
        try {
          await sendMessage(
            getMergeNotificationMessage(event),
            this.notificationsChannelId,
          );
        } catch ({ message }) {
          error("error sending message:", message);
        }
      }

      // send direct activity notification to subscribed user
      if (event.author !== undefined && event.sender !== event.author) {
        const user = await storage.getUserByGitHubUsername(event.author);

        if (user?.subscriptions.has(event.action)) {
          info("user has subscribed to this event, sending message");
          await sendMessage(
            getPrActionUserNotificationMessage(event),
            user.slackId,
          );
        }
      }

      if (event.action === Actions.CLOSED) {
        info("deleting", event.url);
        await storage.deleteByPrUrl(event.url);
      }
    }
  }

  async handleCommand(command: SlackCommand): Promise<string> {
    info("received Slack command:", command);

    switch (command.subcommand.kind) {
      case SlackSubcommands.GITHUB_USERNAME: {
        const { username } = command
          .subcommand as SlackGitHubUsernameSubcommand;

        if (username) {
          await storage.setGitHubUsername(command.userId, username);
          return `Your GitHub username is now set to \`${username}\`. Use \`/${APP_NAME} subscribe <event>\` to receive notifications about your PRs.`;
        } else {
          return `Your GitHub username is \`${await storage
            .getGitHubUsername(
              command.userId,
            )}\``;
        }
      }

      case SlackSubcommands.SUBSCRIBE: {
        const { events } = command.subcommand as SlackSubscribeSubcommand;
        const username = await storage.getGitHubUsername(command.userId);

        if (!username) {
          return UNKNOWN_USER_MESSAGE;
        }

        const subscriptions = await storage.getSubscriptionsByUserId(
          command.userId,
        );

        for (const event of events) {
          subscriptions.add(event);
        }

        await storage.setSubscriptionsByUserId(
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
        const username = await storage.getGitHubUsername(command.userId);

        if (!username) {
          return UNKNOWN_USER_MESSAGE;
        }

        const subscriptions = await storage.getSubscriptionsByUserId(
          command.userId,
        );

        for (const event of events) {
          subscriptions.delete(event);
        }

        await storage.setSubscriptionsByUserId(
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
        const username = await storage.getGitHubUsername(command.userId);

        if (!username) {
          return UNKNOWN_USER_MESSAGE;
        }

        const subscriptions = await storage.getSubscriptionsByUserId(
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
    info("cleaning up entries as old as", days, "days or older");
    return storage.deleteBeforeDays(days);
  }

  cleanup() {
    info("cleaning up all entries");
    return storage.deleteAll();
  }

  introToUser(userId: string) {
    return sendMessage(HELP_MESSAGE, userId);
  }

  async validatePrs() {
    debug("checking PR release checklists");
    const prs = await storage.getAllPrs();

    for (const { prUrl } of prs) {
      debug("checking release checklist", prUrl);
      const { status, user } = await validatePr(prUrl);

      if (status === PrValidationResultStatus.Complete) {
        info("deleting", prUrl);
        await storage.deleteByPrUrl(prUrl);
      } else if (status === PrValidationResultStatus.Incomplete && user) {
        info("sending message about incomplete PR", prUrl);
        const userMetaData = await storage.getUserByGitHubUsername(user);

        if (userMetaData?.slackId) {
          await sendMessage(
            `:warning: release checklist is not complete for <${prUrl}|your PR>, please review it and make sure all neccessary items are checked`,
            userMetaData.slackId,
          );
        }
      }
    }
  }
}
