import { WebClient } from "@slack/web-api";
import { createLabeledLogger } from "./utils/logger.ts";

const log = createLabeledLogger("slack");

export class SlackClient {
  // deno-lint-ignore no-explicit-any
  client: any;

  constructor(token: string) {
    this.client = new WebClient(token);
  }

  async addEmoji(name: string, channel: string, timestamp: string) {
    log.info(
      "Slack client called with",
      JSON.stringify({ emoji: name, channel, timestamp }),
    );

    try {
      await this.client.reactions.add({ name, channel, timestamp });
    } catch (error) {
      log.error(error);
      throw error;
    }
  }

  sendMessage(message: string, channel: string) {
    log.info(
      "Slack client called with:",
      JSON.stringify({ channel, message: "(hidden)" }),
    );
    return this.client.chat.postMessage({ channel, text: message });
  }
}

export default SlackClient;
