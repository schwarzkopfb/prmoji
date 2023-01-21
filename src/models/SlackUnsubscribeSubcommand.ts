import SlackSubcommand from "./SlackSubcommand.ts";
import { Actions } from "../const.ts";

export default interface SlackUnsubscribeSubcommand extends SlackSubcommand {
  events: Set<Actions>;
}
