import SlackSubcommand from "./slack_subcommand.ts";

export default interface SlackGitHubUsernameSubcommand extends SlackSubcommand {
  username?: string;
}
