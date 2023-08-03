import { Actions } from "../const.ts";
import GithubEvent from "../models/github_event.ts";
import GithubRequest from "../models/github_request.ts";
import GithubRequestBody from "../models/github_request_body.ts";
import { createLabeledLogger } from "../utils/logger.ts";

const { silly: log } = createLabeledLogger("gh_parser");

type ActionConditions = {
  [key in Actions]: (
    eventType: string,
    requestBody: GithubRequestBody,
  ) => boolean | undefined;
};

const actionConditions: ActionConditions = {
  [Actions.COMMENTED]: (eventType: string, requestBody: GithubRequestBody) =>
    (eventType === "issue_comment" && requestBody.action === Actions.CREATED) ||
    (eventType === "pull_request_review" &&
      requestBody.action === Actions.SUBMITTED &&
      requestBody.review?.state === "commented"),
  [Actions.APPROVED]: (eventType: string, requestBody: GithubRequestBody) =>
    eventType === "pull_request_review" &&
    requestBody.action === "submitted" &&
    requestBody.review?.state === "approved",
  [Actions.CHANGES_REQUESTED]: (
    eventType: string,
    requestBody: GithubRequestBody,
  ) =>
    eventType === "pull_request_review" &&
    requestBody.action === "submitted" &&
    requestBody.review?.state === "changes_requested",
  [Actions.MERGED]: (eventType: string, requestBody: GithubRequestBody) =>
    eventType === "pull_request" &&
    requestBody.action === "closed" &&
    requestBody.pull_request?.merged,
  [Actions.CLOSED]: (eventType: string, requestBody: GithubRequestBody) =>
    eventType === "pull_request" &&
    requestBody.action === "closed" &&
    !requestBody.pull_request?.merged,

  [Actions.CREATED]: (_et: string, _rb: GithubRequestBody) => false,
  [Actions.SUBMITTED]: (_et: string, _rb: GithubRequestBody) => false,
};

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
    baseRef: getBaseRef(body),
  };
}

function getPrUrl(requestBody: GithubRequestBody) {
  return (
    requestBody.pull_request?.html_url ??
      requestBody.issue?.pull_request?.html_url
  );
}

function getPrAction(event: GithubRequest) {
  log("getPrAction called with", { headers: event.headers, body: event.body });
  const eventType = event.headers["x-github-event"];

  if (!eventType) {
    return;
  }

  const requestBody = event.body;
  const actionValue = Object.keys(actionConditions).find((key) =>
    actionConditions[key as Actions](eventType, requestBody)
  );

  if (!actionValue) {
    return;
  }

  return actionValue as Actions;
}

function getPrCommenter(requestBody: GithubRequestBody) {
  return requestBody.comment?.user?.login;
}

function getPrCommentBody(requestBody: GithubRequestBody) {
  return requestBody.comment?.body;
}

function getPrRepoName(requestBody: GithubRequestBody) {
  return requestBody.repository?.name;
}

function getPrRepoFullName(requestBody: GithubRequestBody) {
  return requestBody.repository?.full_name;
}

function getPrNumber(requestBody: GithubRequestBody) {
  return (
    requestBody.pull_request?.number ??
      requestBody.issue?.number
  );
}

function getPrAuthor(requestBody: GithubRequestBody) {
  return (
    requestBody.issue?.user?.login ??
      requestBody.pull_request?.user?.login
  );
}

function getPrLabels(requestBody: GithubRequestBody) {
  return (requestBody.pull_request?.labels ?? []).map((label) => label.name);
}

function getPrTitle(requestBody: GithubRequestBody) {
  return requestBody.issue?.title ?? requestBody.pull_request?.title;
}

function getPrSender(requestBody: GithubRequestBody) {
  return requestBody.sender?.login;
}

function getBaseRef(requestBody: GithubRequestBody) {
  return requestBody.pull_request?.base?.ref;
}
