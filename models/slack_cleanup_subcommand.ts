import SlackSubcommand from "./slack_subcommand.ts";

export default interface SlackCleanupSubcommand extends SlackSubcommand {
  days?: number;
}
