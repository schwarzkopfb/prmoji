import { createLabeledLogger } from "./logger.ts";
import { PR_VALIDATION_USER_NOTIFICATION_DELAY } from "../const.ts";
import { PrValidationResultStatus, validatePr } from "./validate_pr.ts";
import { storage } from "../storage.ts";
import { sendMessage } from "../slack.ts";

const { info, debug, error } = createLabeledLogger("queue");
const kv = await Deno.openKv();

type GenericMessageListener = (message: unknown) => void;

enum Actions {
  PrValidation = "validate_pr",
}

interface Message {
  action: Actions;
  prUrl: string;
}

kv.listenQueue(messageListener as GenericMessageListener);

function messageListener(message: Message) {
  debug("received message:", JSON.stringify(message));

  switch (message.action) {
    case Actions.PrValidation:
      void handlePrValidation(message);
      break;

    default:
      error("Unknown action:", message.action);
  }
}

async function handlePrValidation({ prUrl }: Message) {
  info(`validating PR ${prUrl}`);

  const { status, user } = await validatePr(prUrl);

  if (PrValidationResultStatus.Incomplete === status && user) {
    info(`PR ${prUrl} is incomplete, trying to notify ${user}`);

    const { slackId } = await storage.getUserByGitHubUsername(user) ?? {};

    if (!slackId) {
      debug(`user ${user} has no Slack ID, skipping notification`);
    } else {
      await sendMessage(
        `:warning: release checklist is not complete for <${prUrl}|your PR>, ` +
          "please revisit it and make sure all post-release steps are performed :pray:",
        slackId,
      );

      debug(`notified ${user} about incomplete PR ${prUrl}`);
    }
  }
}

export async function enqueuePrValidation(
  prUrl: string,
  delay = PR_VALIDATION_USER_NOTIFICATION_DELAY,
) {
  await kv.enqueue(
    { action: Actions.PrValidation, prUrl },
    { delay },
  );

  debug(`enqueued PR validation for ${prUrl} after ${delay}ms`);
}
