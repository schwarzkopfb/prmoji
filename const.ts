export const RX_PR_URL =
  /https:\/\/github.com\/([\w-]+)\/([\w-]+)\/pull\/(\d+)/;

export const RELEASE_CHECKLIST_HEADING = "## Release checklist";
export const PR_VALIDATION_NOTIFICATION_DELAY = 2 * 60 * 60 * 1000;

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
};

export const MessageEmojiMap = new Map([
  [/^A new customer has just signed up/, "rocket_colossyan"],
  [/A new corporate payment has been made/, "rocket_colossyan"],
  [/New deal won!/, "rocket_colossyan"],
]);

export const IGNORED_COMMENTERS = ["sonarcloud"];

// repositories to watch for notifications
// empty array means watching all repositories
export const WATCHED_REPOSITORIES: string[] = [];
// labels to watch for notifications
// empty array means watching all labels
export const WATCHED_LABELS: string[] = [];

export const APP_NAME = Deno.env.get("APP_NAME") || "prmoji";
export const APP_DISPLAY_NAME = Deno.env.get("APP_DISPLAY_NAME") || "Prmoji";
export const GITHUB_ACCESS_TOKEN = Deno.env.get("GITHUB_ACCESS_TOKEN");

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
\`/${APP_NAME} cleanup\` - deletes all stored PRs *from all users* :warning:
\`/${APP_NAME} cleanup <days>\` - deletes stored PRs older than the specified number of days *from all users* :warning:
\`/${APP_NAME} help\` - shows this message

If you want to know more, check out my GitHub repository: https://schwarzkopfb.codes/prmoji
`;
