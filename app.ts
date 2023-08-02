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
import { enqueuePrValidation } from "./utils/queue.ts";
import {
  APP_NAME,
  HELP_MESSAGE,
  NOTIFICATIONS_CHANNEL_ID,
  UNKNOWN_COMMAND_MESSAGE,
  UNKNOWN_USER_MESSAGE,
} from "./const.ts";
import { SlackSubcommands } from "./models/slack_subcommand.ts";
import SlackSubscribeSubcommand from "./models/slack_subscribe_subcommand.ts";
import SlackUnsubscribeSubcommand from "./models/slack_unsubscribe_subcommand.ts";
import SlackGitHubUsernameSubcommand from "./models/slack_github_username_subcommand.ts";

const { info, debug, error } = createLabeledLogger("app");

export class PrmojiApp {
  async handleMessage(message: SlackMessage) {
    info(
      "received Slack message",
      message.text ? message.text.substring(0, 8) : "(no message text)",
    );
    if (!message.text || !message.channel || !message.timestamp) {
      debug("missing field(s), discarding message");
      return;
    }

    const prUrlsInMessage = getPrUrlsFromString(message.text);
    debug("PR URLs in message:", prUrlsInMessage);

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
        } catch ({ message }) {
          error(`error adding emoji (${emoji}):`, message);
        }
      }
    }
  }

  async handlePrEvent(event: GithubEvent) {
    info("received PR event:", event.action, event.number);

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

    debug(`got ${result.length} matching item(s)`);

    if (result.length > 0) {
      const emoji = PrActionEmojiMap[event.action];
      debug("selected emoji:", emoji);

      if (!emoji) {
        debug("no emoji for this event, discarding");
        return;
      }

      if (shouldAddEmoji(event)) {
        for (const item of result) {
          info("adding emoji:", emoji);

          try {
            await addEmoji(
              emoji,
              item.messageChannel,
              item.messageTimestamp,
            );
          } catch ({ message }) {
            error("error adding emoji:", message);
          }
        }
      } else {
        info("should not add emoji for this event");
      }

      if (event.author !== undefined && event.sender !== event.author) {
        const user = await storage.getUserByGitHubUsername(event.author);

        if (user?.subscriptions.has(event.action)) {
          info("user has subscribed to this event, sending direct message");
          await sendMessage(
            getPrActionUserNotificationMessage(event),
            user.slackId,
          );
        }
      }

      if (event.action === Actions.MERGED) {
        if (NOTIFICATIONS_CHANNEL_ID) {
          info("sending merge message to the configured channel");
          try {
            await sendMessage(
              getMergeNotificationMessage(event),
              NOTIFICATIONS_CHANNEL_ID,
            );
          } catch ({ message }) {
            error("error sending message:", message);
          }
        }

        info("enqueuing PR validation");
        await enqueuePrValidation(event.url);
      } else if (event.action === Actions.CLOSED) {
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
          ? "You are not subscribed to all events."
          : `You are subscribed to the following events: ${
            formatEventList(
              subscriptions,
            )
          }`;
      }

      case SlackSubcommands.CLEANUP:
        await this.cleanup();
        return "Cleanup complete. :white_check_mark:";

      case SlackSubcommands.HELP:
        return HELP_MESSAGE;

      default:
        return UNKNOWN_COMMAND_MESSAGE;
    }
  }

  async cleanup() {
    info("cleaning up all entries");
    const prs = await storage.getAllPrs();

    for (const { prUrl } of prs) {
      const { status } = await validatePr(prUrl);

      if (status === PrValidationResultStatus.Complete) {
        info("deleting", prUrl);
        await storage.deleteByPrUrl(prUrl);
      } else {
        debug("skipping incomplete PR", prUrl);
      }
    }
  }

  introToUser(userId: string) {
    return sendMessage(HELP_MESSAGE, userId);
  }
}
