import SlackSubcommand from "./SlackSubcommand.ts";
import { Actions } from "../const.ts";

export default interface SlackSubscribeSubcommand extends SlackSubcommand {
  events: Set<Actions>;
}
