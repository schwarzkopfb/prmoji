import SlackMessage from "../models/SlackMessage.ts";
import SlackRequest from "../models/SlackRequest.ts";
import GithubEvent from "../models/GithubEvent.ts";
import GithubRequest from "../models/GithubRequest.ts";
import {
  getPrAction,
  getPrAuthor,
  getPrCommentBody,
  getPrCommenter,
  getPrLabels,
  getPrNumber,
  getPrRepoFullName,
  getPrRepoName,
  getPrTitle,
  getPrUrl,
} from "./helpers.ts";

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
  };
}

export function parseSlackRequest(
  { body: { event } }: SlackRequest,
): SlackMessage {
  return {
    id: event.client_msg_id,
    text: event.text,
    channel: event.channel,
    timestamp: event.event_ts,
  };
}
