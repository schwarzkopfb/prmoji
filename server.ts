import { Application, Context, Router } from "oak";
import { PrmojiApp } from "./app.ts";
import * as logger from "./utils/logger.ts";
import SlackEvent from "./models/slack_event.ts";
import GithubRequest from "./models/github_request.ts";
import GithubRequestBody from "./models/github_request_body.ts";
import {
  parseGithubRequest,
  parseSlackCommand,
  parseSlackEvent,
} from "./utils/request_parsers.ts";
import { getLogLevelFromArgs } from "./utils/helpers.ts";
import { INTERNAL_REST_API_KEY, UNKNOWN_COMMAND_MESSAGE } from "./const.ts";

const PORT = parseInt(Deno.env.get("PORT") || "4002", 10);

const startLog = logger.createLabeledLogger("start");
const apiLog = logger.createLabeledLogger("rest");

const LOG_LEVEL = getLogLevelFromArgs(Deno.args);
logger.setLevel(LOG_LEVEL);

const server = new Application();
const router = new Router();
const app = new PrmojiApp();

router
  .get("/", healthcheck)
  .post("/event/github", handleGithubEvent)
  .post("/event/slack", handleSlackEvent)
  .post("/event/slack/command", handleSlackCommand)
  .post("/cleanup/", handleCleanupRequest)
  .get("/validate-prs", handleValidatePrsRequest)
  .get("/test", handleTestRequest); // TODO: remove

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
    app.handleMessage(parseSlackEvent(body as SlackEvent));
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

async function handleValidatePrsRequest(ctx: Context) {
  apiLog.info("received check release checklists request");
  const key = ctx.request.headers.get("x-api-key");

  ctx.assert(INTERNAL_REST_API_KEY === key, 401);
  await app.validatePrs();
  ctx.response.body = "OK";
}

import { enqueuePrValidation } from "./utils/queue.ts";
async function handleTestRequest({ response }: Context) {
  apiLog.info("received test request");
  await enqueuePrValidation("https://github.com/colossyan/app/pull/1757");
  response.body = "OK";
}
