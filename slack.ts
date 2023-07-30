import { WebClient } from "@slack/web-api";
import { createLabeledLogger } from "./utils/logger.ts";

const SLACK_TOKEN = Deno.env.get("SLACK_TOKEN");
const { debug } = createLabeledLogger("slack");
const client = new WebClient(SLACK_TOKEN);

export function addEmoji(name: string, channel: string, timestamp: string) {
  debug(
    "Slack client called with:",
    JSON.stringify({ name, channel, timestamp }),
  );
  return client.reactions.add({ name, channel, timestamp });
}

export function sendMessage(message: string, channel: string) {
  debug(
    "Slack client called with:",
    JSON.stringify({ channel, message: "(hidden)" }),
  );
  return client.chat.postMessage({ channel, text: message });
}
