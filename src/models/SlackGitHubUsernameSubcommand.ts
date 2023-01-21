import SlackSubcommand from "./SlackSubcommand.ts";

export default interface SlackGitHubUsernameSubcommand extends SlackSubcommand {
  username?: string;
}
