import SlackSubcommand from "./slack_subcommand.ts";
import { Actions } from "../const.ts";

export default interface SlackUnsubscribeSubcommand extends SlackSubcommand {
  events: Set<Actions>;
}