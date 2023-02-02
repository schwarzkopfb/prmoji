import { PrmojiApp } from "../src/app.ts";
import { SlackClient } from "../src/slack_client.ts";
import { PostgresStorage } from "../src/storage.ts";

const USER_ID = Deno.args[0];
const SLACK_TOKEN = Deno.env.get("SLACK_TOKEN");
const CONNECTION_STRING = Deno.env.get("DATABASE_URL");

if (!SLACK_TOKEN) {
  throw new Error("SLACK_TOKEN environment variable is not set");
}
if (!CONNECTION_STRING) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const storage = new PostgresStorage(CONNECTION_STRING);
const slackClient = new SlackClient(SLACK_TOKEN);
const app = new PrmojiApp(storage, slackClient);

try {
  await app.introToUser(USER_ID);
  console.log("Intro sent!");
} catch (err) {
  console.error("Error while sending intro");
  console.error(err.message);
}
