import { PrmojiApp } from "../app.ts";

const USER_ID = Deno.args[0];
const SLACK_TOKEN = Deno.env.get("SLACK_TOKEN");
const CONNECTION_STRING = Deno.env.get("DATABASE_URL");

if (!SLACK_TOKEN) {
  throw new Error("SLACK_TOKEN environment variable is not set");
}
if (!CONNECTION_STRING) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const app = new PrmojiApp();

try {
  await app.introToUser(USER_ID);
  console.log("Intro sent!");
} catch (err) {
  console.error("Error while sending intro");
  console.error(err.message);
}
