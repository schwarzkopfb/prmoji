import { Actions } from "../const.ts";
import SlackMessage from "../models/slack_message.ts";
import SlackEvent from "../models/slack_event.ts";
import SlackCommand from "../models/slack_command.ts";
import {
  SlackSubcommand,
  SlackSubcommands,
} from "../models/slack_subcommand.ts";
import SlackGitHubUsernameSubcommand from "../models/slack_github_username_subcommand.ts";
import SlackSubscribeSubcommand from "../models/slack_subscribe_subcommand.ts";
import SlackUnsubscribeSubcommand from "../models/slack_unsubscribe_subcommand.ts";

import { createLabeledLogger } from "../utils/logger.ts";

const { error } = createLabeledLogger("slack_parser");

export function parseSlackEvent({
  event,
}: SlackEvent): SlackMessage {
  return {
    id: event.client_msg_id,
    text: event.text,
    channel: event.channel,
    timestamp: event.event_ts,
  };
}

export function parseSlackSubscriptionEvent(args: string[]): Set<Actions> {
  const evts = new Set<Actions>();

  const addAll = () => {
    evts.add(Actions.APPROVED);
    evts.add(Actions.CREATED);
    evts.add(Actions.COMMENTED);
    evts.add(Actions.CHANGES_REQUESTED);
    evts.add(Actions.SUBMITTED);
    evts.add(Actions.MERGED);
    evts.add(Actions.CLOSED);
  };

  if (args.length === 0) {
    addAll();
  }

  for (const arg of args) {
    switch (arg.trim().toLowerCase()) {
      case "approved":
        evts.add(Actions.APPROVED);
        break;
      case "created":
        evts.add(Actions.CREATED);
        break;
      case "commented":
        evts.add(Actions.COMMENTED);
        break;
      case "changes-requested":
        evts.add(Actions.CHANGES_REQUESTED);
        break;
      case "submitted":
        evts.add(Actions.SUBMITTED);
        break;
      case "merged":
        evts.add(Actions.MERGED);
        break;
      case "closed":
        evts.add(Actions.CLOSED);
        break;
      case "all":
        addAll();
        break;
    }
  }

  return evts;
}

export function parseSlackCommandText(text: string): SlackSubcommand | null {
  const [subcommand, ...args] = text.split(/\s+|,+/g);
  const [arg] = args;

  switch (subcommand) {
    case SlackSubcommands.GITHUB_USERNAME:
      return {
        kind: SlackSubcommands.GITHUB_USERNAME,
        username: arg,
        args,
      } as SlackGitHubUsernameSubcommand;

    case SlackSubcommands.SUBSCRIBE: {
      const events = parseSlackSubscriptionEvent(args);

      return {
        kind: SlackSubcommands.SUBSCRIBE,
        events,
        args,
      } as SlackSubscribeSubcommand;
    }

    case SlackSubcommands.UNSUBSCRIBE: {
      const events = parseSlackSubscriptionEvent(args);

      return {
        kind: SlackSubcommands.UNSUBSCRIBE,
        events,
        args,
      } as SlackUnsubscribeSubcommand;
    }

    case SlackSubcommands.LIST_SUBSCRIPTIONS:
      return { kind: SlackSubcommands.LIST_SUBSCRIPTIONS, args };

    case SlackSubcommands.CLEANUP:
      return {
        kind: SlackSubcommands.CLEANUP,
        args,
      };

    case "":
    case "hello":
    case SlackSubcommands.HELP:
      return {
        kind: SlackSubcommands.HELP,
        args,
      };

    default:
      return null;
  }
}

export function parseSlackCommand(
  params: URLSearchParams,
): SlackCommand | null {
  const userId = params.get("user_id");
  const text = params.get("text") || "";

  if (!userId) {
    error("missing user_id in Slack command");
    return null;
  }

  const subcommand = parseSlackCommandText(text);

  if (!subcommand) {
    error("invalid subcommand in Slack command");
    return null;
  }

  return {
    userId,
    text,
    subcommand,
  };
}
