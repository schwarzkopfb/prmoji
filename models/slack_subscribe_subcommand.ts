import SlackSubcommand from "./slack_subcommand.ts";
import { Actions } from "../const.ts";

export default interface SlackSubscribeSubcommand extends SlackSubcommand {
  events: Set<Actions>;
}
