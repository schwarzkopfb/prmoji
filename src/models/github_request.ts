import RequestBody from "./github_request_body.ts";

export default interface GithubRequest {
  headers: {
    "x-github-event"?: string;
  };
  body: RequestBody;
}
