export const APP_NAME = Deno.env.get("APP_NAME") || "prmoji";
export const APP_DISPLAY_NAME = Deno.env.get("APP_DISPLAY_NAME") || "Prmoji";
export const GITHUB_ACCESS_TOKEN = Deno.env.get("GITHUB_ACCESS_TOKEN");
export const NOTIFICATIONS_CHANNEL_ID = Deno.env.get(
  "NOTIFICATIONS_CHANNEL_ID",
);

export const RX_PR_URL_PARTS =
  /https:\/\/github.com\/([\w-]+)\/([\w-]+)\/pull\/(\d+)/;
export const RX_PR_URL_MULTI = new RegExp(RX_PR_URL_PARTS.source, "g");

export const RELEASE_CHECKLIST_HEADING = "## Release checklist";
export const PR_VALIDATION_USER_NOTIFICATION_DELAY = 60 * 60 * 1000;
export const PR_VALIDATION_USER_NOTIFICATION_MESSAGE =
  ":warning: release checklist is not complete for <%s|your PR>, " +
  "please revisit it and make sure all post-release steps are performed :pray:";

export enum Actions {
  CREATED = "created",
  COMMENTED = "commented",
  APPROVED = "approved",
  CHANGES_REQUESTED = "changes_requested",
  SUBMITTED = "submitted",
  MERGED = "merged",
  CLOSED = "closed",
}

export const PrActionEmojiMap = {
  [Actions.COMMENTED]: "speech_balloon",
  [Actions.APPROVED]: "white_check_mark",
  [Actions.CHANGES_REQUESTED]: "no_entry",
  [Actions.MERGED]: "merged",
  [Actions.CLOSED]: "wastebasket",

  [Actions.CREATED]: null,
  [Actions.SUBMITTED]: null,
} as const;

export const MessageEmojiMap = new Map([
  [/^A new customer has just signed up/, "rocket_colossyan"],
  [/A new corporate payment has been made/, "rocket_colossyan"],
  [/New deal won!/, "rocket_colossyan"],
]);

export const IGNORED_COMMENTERS = ["sonarcloud", "github-actions", "linear"];

export const MERGE_NOTIFICATION_MESSAGE = "Merged: <%s|%s #%d %s> (by %s)";

export const PR_ACTION_USER_NOTIFICATION_MESSAGES = {
  [Actions.CREATED]: "%s created <%s|PR> :heavy_plus_sign:",
  [Actions.COMMENTED]: "%s commented on <%s|your PR> :speech_balloon:",
  [Actions.APPROVED]: "%s approved <%s|your PR> :white_check_mark:",
  [Actions.CHANGES_REQUESTED]:
    "%s requested changes on <%s|your PR> :no_entry:",
  [Actions.SUBMITTED]: "%s submitted <%s|your PR> :rocket:",
  [Actions.MERGED]: "%s merged <%s|your PR> :merged:",
  [Actions.CLOSED]: "%s closed <%s|your PR> :wastebasket:",
  DEFAULT: "%s did something to <%s|your PR> :question:",
};

export const UNKNOWN_USER_MESSAGE =
  `I don't know you :crycat:. Type \`/${APP_NAME} ghuser <username>\` to set your GitHub username.`;

export const UNKNOWN_COMMAND_MESSAGE =
  `I don't understand that :crycat:. Type \`/${APP_NAME} help\` to see the list of supported commands.`;

export const HELP_MESSAGE = `
Hi there! I'm ${APP_DISPLAY_NAME}, a bot that adds emojis to PRs when they are merged or closed. \
I can also notify you about those events via direct messages.

Supported commands:
\`/${APP_NAME} ghuser\` - returns your GitHub username
\`/${APP_NAME} ghuser <username>\` - sets your GitHub username
\`/${APP_NAME} subscribe\` - enables all notifications about your PRs via DMs
\`/${APP_NAME} subscribe <event>\` - get notified only about specified \`<event>\` which is one of
 • \`approved\`,
 • \`created\`,
 • \`commented\`,
 • \`changes_requested\`,
 • \`submitted\`,
 • \`merged\`,
 • \`closed\`,
 • \`all\`
 • or a comma-separated list of those
\`/${APP_NAME} unsubscribe\` - disables all notifications about your PRs via DMs
\`/${APP_NAME} unsubscribe <event>\` - disables notifications about your PRs via DMs for the specified event
\`/${APP_NAME} subscriptions\` - shows your current PR event subscriptions
\`/${APP_NAME} cleanup\` - deletes all merged PRs with no release checklist or with a completed one
\`/${APP_NAME} help\` - shows this message

If you want to know more, check out my GitHub repository: https://schwarzkopfb.codes/prmoji
`;
