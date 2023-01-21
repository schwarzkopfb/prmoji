import SlackSubcommand from "./SlackSubcommand.ts";

export default interface SlackCleanupSubcommand extends SlackSubcommand {
  days?: number;
}
