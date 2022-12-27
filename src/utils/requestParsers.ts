import GithubEvent from "./types/GithubEvent.ts";
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

export function parseGithubRequest(event: GithubEvent) {
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

export function parseSlackRequest({ body: { event } }: GithubEvent) {
  return {
    id: event.client_msg_id,
    text: event.text,
    channel: event.channel,
    timestamp: event.event_ts,
  };
}
