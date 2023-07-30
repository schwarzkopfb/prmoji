import { Actions } from "../const.ts";

export interface User {
  slackId: string;
  ghUsername: string;
  subscriptions: Set<Actions>;
  insertedAt: string;
}

export default User;
