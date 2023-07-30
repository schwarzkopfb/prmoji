import { Application, Context, Router } from "oak";
import { PrmojiApp } from "./app.ts";
import { PostgresStorage } from "./storage.ts";
import { SlackClient } from "./slack_client.ts";
import * as logger from "./utils/logger.ts";
import SlackRequest from "./models/slack_request.ts";
import GithubRequest from "./models/github_request.ts";
import GithubRequestBody from "./models/github_request_body.ts";
import {
  parseGithubRequest,
  parseSlackCommand,
  parseSlackRequest,
} from "./utils/request_parsers.ts";
import { getLogLevelFromArgs } from "./utils/helpers.ts";
import { UNKNOWN_COMMAND_MESSAGE } from "./const.ts";

const PORT = parseInt(Deno.env.get("PORT") || "5000", 10);
const SLACK_TOKEN = Deno.env.get("SLACK_TOKEN");
const CONNECTION_STRING = Deno.env.get("DATABASE_URL");
const NOTIFICATIONS_CHANNEL_ID = Deno.env.get("NOTIFICATIONS_CHANNEL_ID");

const startLog = logger.createLabeledLogger("start");
const apiLog = logger.createLabeledLogger("rest");

if (!SLACK_TOKEN) {
  startLog.error("SLACK_TOKEN environment variable is not set");
  Deno.exit(1);
}
if (!CONNECTION_STRING) {
  startLog.error("DATABASE_URL environment variable is not set");
  Deno.exit(1);
}

const LOG_LEVEL = getLogLevelFromArgs(Deno.args);
logger.setLevel(LOG_LEVEL);

const storage = new PostgresStorage(CONNECTION_STRING);
const slackClient = new SlackClient(SLACK_TOKEN);
const server = new Application();
const router = new Router();
const app = new PrmojiApp(storage, slackClient, NOTIFICATIONS_CHANNEL_ID);

router
  .get("/", healthcheck)
  .post("/event/github", handleGithubEvent)
  .post("/event/slack", handleSlackEvent)
  .post("/event/slack/command", handleSlackCommand)
  .post("/cleanup/", handleCleanupRequest)
  .get("/validate-prs", handleValidatePrsRequest);

server.addEventListener("listen", ({ hostname, port, secure }) => {
  startLog.info(
    `server is listening on ${secure ? "https://" : "http://"}${
      hostname ?? "localhost"
    }:${port}`,
  );
});

server.use(router.routes());
server.use(router.allowedMethods());

await server.listen({ port: PORT });

function healthcheck({ response }: Context) {
  response.body = "OK";
}

async function handleGithubEvent({ request, response }: Context) {
  apiLog.info("received GitHub event");
  response.body = "OK";

  const result = request.body({ type: "json" });
  const body = (await result.value) as GithubRequestBody;
  app.handlePrEvent(
    parseGithubRequest({
      headers: {
        "x-github-event": request.headers.get("x-github-event"),
      },
      body,
    } as GithubRequest),
  );
}

async function handleSlackEvent({ request, response }: Context) {
  apiLog.info("received Slack event");
  const result = request.body({ type: "json" });
  const body = await result.value;

  // Slack sends a challenge to verify the endpoint on first setup
  if (body.challenge) {
    response.body = body.challenge;
  } else {
    response.body = "OK";
    app.handleMessage(parseSlackRequest({ body } as SlackRequest));
  }
}

async function handleSlackCommand({ request, response }: Context) {
  apiLog.info("received Slack command");
  const result = request.body({ type: "form" });
  const params = await result.value;
  const command = parseSlackCommand(params);

  if (command) {
    response.body = await app.handleCommand(command);
  } else {
    response.body = UNKNOWN_COMMAND_MESSAGE;
  }
}

async function handleCleanupRequest({ response }: Context) {
  apiLog.info("received cleanup request");
  await app.cleanupOld();
  response.body = "OK";
}

async function handleValidatePrsRequest({ response }: Context) {
  apiLog.info("received check release checklists request");
  await app.validatePrs();
  response.body = "OK";
}
