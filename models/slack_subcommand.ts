export enum SlackSubcommands {
  GITHUB_USERNAME = "ghuser",
  SUBSCRIBE = "subscribe",
  UNSUBSCRIBE = "unsubscribe",
  LIST_SUBSCRIPTIONS = "subscriptions",
  CLEANUP = "cleanup",
  HELP = "help",
}

export interface SlackSubcommand {
  kind: SlackSubcommands;
  args: string[];
}

export default SlackSubcommand;
