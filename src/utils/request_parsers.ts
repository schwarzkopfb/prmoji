import { Actions } from "../const.ts";
import SlackMessage from "../models/slack_message.ts";
import SlackRequest from "../models/slack_request.ts";
import SlackCommand from "../models/slack_command.ts";
import {
  SlackSubcommand,
  SlackSubcommands,
} from "../models/slack_subcommand.ts";
import SlackGitHubUsernameSubcommand from "../models/slack_github_username_subcommand.ts";
import SlackSubscribeSubcommand from "../models/slack_subscribe_subcommand.ts";
import SlackUnsubscribeSubcommand from "../models/slack_unsubscribe_subcommand.ts";
import SlackCleanupSubcommand from "../models/slack_cleanup_subcommand.ts";
import GithubEvent from "../models/github_event.ts";
import GithubRequest from "../models/github_request.ts";
import {
  getPrAction,
  getPrAuthor,
  getPrCommentBody,
  getPrCommenter,
  getPrLabels,
  getPrNumber,
  getPrRepoFullName,
  getPrRepoName,
  getPrSender,
  getPrTitle,
  getPrUrl,
} from "./helpers.ts";
import * as logger from "../utils/logger.ts";

export function parseGithubRequest(event: GithubRequest): GithubEvent {
  const { body } = event;

  return {
    url: getPrUrl(body),
    action: getPrAction(event),
    commenter: getPrCommenter(body),
    comment: getPrCommentBody(body),
    name: getPrRepoName(body),
    fullName: getPrRepoFullName(body),
    number: getPrNumber(body),
    author: getPrAuthor(body),
    labels: getPrLabels(body),
    title: getPrTitle(body),
    sender: getPrSender(body),
  };
}

export function parseSlackRequest({
  body: { event },
}: SlackRequest): SlackMessage {
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

    case SlackSubcommands.CLEANUP: {
      const days = arg ? parseInt(arg, 10) : undefined;

      if (days !== undefined && isNaN(days)) {
        return null;
      }

      return {
        kind: SlackSubcommands.CLEANUP,
        days,
      } as SlackCleanupSubcommand;
    }

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
    logger.error("Missing user_id in Slack command");
    return null;
  }

  const subcommand = parseSlackCommandText(text);

  if (!subcommand) {
    logger.error("Invalid subcommand in Slack command");
    return null;
  }

  return {
    userId,
    text,
    subcommand,
  };
}