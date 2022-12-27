import RequestBody from "./RequestBody.ts";

export default interface GithubEvent {
  headers: {
    "x-github-event": string;
  };
  body: RequestBody;
}
