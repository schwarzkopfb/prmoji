import { sprintf } from "std/fmt/printf.ts";
import GithubEvent from "../models/github_event.ts";
import { Levels } from "./logger.ts";
import {
  Actions,
  IGNORED_COMMENTERS,
  MERGE_NOTIFICATION_MESSAGE,
  PR_ACTION_USER_NOTIFICATION_MESSAGES,
  RX_PR_URL_MULTI,
} from "../const.ts";

export function getPrUrlsFromString(text: string) {
  return text.match(RX_PR_URL_MULTI) ?? [];
}

export function shouldAddEmoji(event: GithubEvent) {
  const isIgnoredComment = event.action === Actions.COMMENTED &&
    IGNORED_COMMENTERS.includes(event.commenter);
  return !isIgnoredComment;
}

function truncate(s?: string, maxLength = 100) {
  if (!s) return "";
  return s.length > maxLength ? s.substring(0, maxLength) + "..." : s;
}

export function formatEventList(events: Set<Actions>) {
  return Array.from(events)
    .map((e) => "`" + e + "`")
    .join(", ");
}

export function getMergeNotificationMessage(event: GithubEvent) {
  const { title } = event;
  const url = event.url || "(missing PR URL)";
  const repo = event.name || "(missing repo name)";
  const author = event.author || "(missing PR author)";
  const prNumber = event.number || "(missing PR number)";
  const shortTitle = truncate(title) || "(missing PR title)";

  return sprintf(
    MERGE_NOTIFICATION_MESSAGE,
    url,
    repo,
    prNumber,
    shortTitle,
    author,
  );
}

export function getPrActionUserNotificationMessage(event: GithubEvent) {
  const { action } = event;
  const sender = event.sender || "(missing sender)";
  const prUrl = event.url || "(missing PR URL)";
  const message = action
    ? PR_ACTION_USER_NOTIFICATION_MESSAGES[action]
    : PR_ACTION_USER_NOTIFICATION_MESSAGES.DEFAULT;

  return sprintf(message, sender, prUrl);
}

export function getLogLevelFromArgs(argv: string[]) {
  let levelString = "info";
  for (const arg of argv) {
    if (arg.startsWith("--loglevel=")) {
      levelString = arg.substring(11);
      break;
    }
  }
  switch (levelString) {
    case "silent":
      return Levels.SILENT;
    case "error":
      return Levels.ERROR;
    case "debug":
      return Levels.DEBUG;
    case "silly":
      return Levels.SILLY;
    case "info":
    default:
      return Levels.INFO;
  }
}
