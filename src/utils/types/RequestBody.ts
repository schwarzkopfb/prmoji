import { Actions } from "../const.ts";

export default interface RequestBody {
  action: Actions;
  fullName: string;
  name: string;
  url: string;
  title: string;
  number: number;
  author: string;
  labels: string[];
  issue: {
    number: number;
    title: string;
    pull_request: {
      html_url: string;
    };
    user: {
      login: string;
    };
  };
  pull_request: {
    number: number;
    html_url: string;
    title: string;
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
  review: {
    state: string;
  };
  repository: {
    name: string;
    full_name: string;
  };
  commenter: string;
  event: {
    client_msg_id: string;
    text: string;
    channel: string;
    event_ts: string;
  };
}
