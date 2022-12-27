import RequestBody from "./types/RequestBody.ts";
import GithubEvent from "./types/GithubEvent.ts";
import { Levels, silly as log } from "./logger.ts";
import {
  Actions,
  IGNORED_COMMENTERS,
  WATCHED_LABELS,
  WATCHED_REPOSITORIES,
} from "./const.ts";

export function getPrUrl(requestBody: RequestBody) {
  if (requestBody.pull_request != null) {
    return requestBody.pull_request.html_url;
  } else if (
    requestBody.issue != null && requestBody.issue.pull_request != null
  ) {
    return requestBody.issue.pull_request.html_url;
  } else {
    return null;
  }
}

export function getPrAction(event: GithubEvent) {
  log("getPrAction called with", { headers: event.headers, body: event.body });
  const eventType = event.headers["x-github-event"];
  const requestBody = event.body;
  return Object.keys(actionConditions).find((key) =>
    actionConditions[key as Actions](eventType, requestBody)
  );
}

export function getPrCommenter(requestBody: RequestBody) {
  return requestBody.comment && requestBody.comment.user &&
    requestBody.comment.user.login;
}

export function getPrCommentBody(requestBody: RequestBody) {
  return requestBody.comment && requestBody.comment.body;
}

export function getPrRepoName(requestBody: RequestBody) {
  return requestBody.repository && requestBody.repository.name;
}

export function getPrRepoFullName(requestBody: RequestBody) {
  return requestBody.repository && requestBody.repository.full_name;
}

export function getPrNumber(requestBody: RequestBody) {
  return (
    (requestBody.pull_request && requestBody.pull_request.number) ||
    (requestBody.issue && requestBody.issue.number)
  );
}

export function getPrAuthor(requestBody: RequestBody) {
  return (
    (requestBody.issue && requestBody.issue.user &&
      requestBody.issue.user.login) ||
    (requestBody.pull_request && requestBody.pull_request.user &&
      requestBody.pull_request.user.login)
  );
}

export function getPrLabels(requestBody: RequestBody) {
  return ((requestBody.pull_request && requestBody.pull_request.labels) || [])
    .map((label) => label.name);
}

export function getPrTitle(requestBody: RequestBody) {
  return (
    (requestBody.issue && requestBody.issue.title) ||
    (requestBody.pull_request && requestBody.pull_request.title)
  );
}
type ActionConditions = {
  [key in Actions]: (
    eventType: string,
    requestBody: RequestBody,
  ) => boolean | undefined;
};
export const actionConditions: ActionConditions = {
  [Actions.COMMENTED]: (eventType: string, requestBody: RequestBody) =>
    (eventType === "issue_comment" && requestBody.action === Actions.CREATED) ||
    (eventType === "pull_request_review" &&
      requestBody.action === Actions.SUBMITTED &&
      requestBody.review.state === "commented"),
  [Actions.APPROVED]: (eventType: string, requestBody: RequestBody) =>
    eventType === "pull_request_review" &&
    requestBody.action === "submitted" &&
    requestBody.review.state === "approved",
  [Actions.CHANGES_REQUESTED]: (eventType: string, requestBody: RequestBody) =>
    eventType === "pull_request_review" &&
    requestBody.action === "submitted" &&
    requestBody.review.state === "changes_requested",
  [Actions.MERGED]: (eventType: string, requestBody: RequestBody) =>
    eventType === "pull_request" && requestBody.action === "closed" &&
    requestBody.pull_request.merged,
  [Actions.CLOSED]: (eventType: string, requestBody: RequestBody) =>
    eventType === "pull_request" && requestBody.action === "closed" &&
    !requestBody.pull_request.merged,

  [Actions.CREATED]: (_et: string, _rb: RequestBody) => false,
  [Actions.SUBMITTED]: (_et: string, _rb: RequestBody) => false,
};

export function getPrUrlsFromString(text: string) {
  return text.match(/(https:\/\/github\.com\/[\w-_]+\/[\w-_]+\/pull\/\d+)/g) ||
    [];
}

export function getLogLevelFromArgs(argv: string[]) {
  let levelString = "info";
  for (const arg of argv) {
    if (arg.startsWith("--loglevel=")) {
      levelString = arg.substr(11);
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
    default:
      return Levels.INFO;
  }
}

export function shouldAddEmoji(event: RequestBody) {
  const isIgnoredComment = event.action === Actions.COMMENTED &&
    IGNORED_COMMENTERS.includes(event.commenter);
  return !isIgnoredComment;
}

export function shouldNotify(event: RequestBody) {
  log("shouldNotify examining event:", JSON.stringify(event, null, 2));

  const isMerged = event.action === Actions.MERGED;
  const isWatchedRepository = WATCHED_REPOSITORIES.includes(event.fullName);
  const hasWatchedLabel = event.labels.some((label) =>
    WATCHED_LABELS.includes(label)
  );

  const shouldNotify = isMerged && isWatchedRepository && hasWatchedLabel;
  log(
    "Notification criteria:",
    JSON.stringify(
      { isMerged, isWatchedRepository, hasWatchedLabel, shouldNotify },
      null,
      2,
    ),
  );

  return shouldNotify;
}

export function getDateStringForDeletion(date: Date, numDays: number) {
  date.setDate(date.getDate() - numDays);
  return date.toISOString().substr(0, 10);
}

export function getMessage(event: RequestBody) {
  const repoName = event.name || "(missing repo name)";
  const prUrl = event.url || "(missing PR URL)";
  const prNumber = event.number || "(missing PR number)";
  const prTitleMaxLength = 100;
  const truncatedTitle = event.title.length > prTitleMaxLength
    ? event.title.substr(0, prTitleMaxLength) + "..."
    : event.title;
  const authorName = event.author || "(missing PR author)";

  return `Merged: <${prUrl}|${repoName} #${prNumber} ${truncatedTitle}> (by ${authorName})`;
}
