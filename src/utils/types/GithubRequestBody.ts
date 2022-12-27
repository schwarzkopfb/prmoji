import { Actions } from "../const.ts";

// action: getPrAction(event),
// commenter: getPrCommenter(body),
// comment: getPrCommentBody(body),
// name: getPrRepoName(body),
// number: getPrNumber(body),
// author: getPrAuthor(body),
// labels: getPrLabels(body),

export default interface GithubRequestBody {
  action: Actions;
  name: string;
  number: number;
  author: string;
  commenter: string;
  labels: string[];
  issue?: {
    number: number;
    title?: string;
    pull_request: {
      html_url: string;
    };
    user: {
      login: string;
    };
  };
  pull_request?: {
    number: number;
    html_url: string;
    title?: string;
    merged: boolean;
    user: {
      login: string;
    };
    labels: {
      name: string;
    }[];
  };
  comment: {
    body: string;
    user: {
      login: string;
    };
  };
  review?: {
    state: string;
  };
  repository?: {
    name: string;
    full_name: string;
  };
  event?: {
    client_msg_id: string;
    text: string;
    channel: string;
    event_ts: string;
  };
}
