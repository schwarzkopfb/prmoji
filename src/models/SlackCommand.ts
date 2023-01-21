import SlackSubcommand from "./SlackSubcommand.ts";

export default interface SlackCommand {
  [key: string]: string | SlackSubcommand;

  userId: string;
  text: string;
  subcommand: SlackSubcommand;
}
