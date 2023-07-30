import { delay } from "std/async/delay.ts";
import { Client } from "postgres";
import { createLabeledLogger } from "./utils/logger.ts";
import PrRecord from "./models/pr_record.ts";
import User from "./models/user.ts";
import { getDateStringForDeletion } from "./utils/helpers.ts";
import { Actions } from "./const.ts";

const CONNECTION_STRING = Deno.env.get("DATABASE_URL");
const { info, debug, error } = createLabeledLogger("storage");

if (!CONNECTION_STRING) {
  error("DATABASE_URL environment variable not set");
  Deno.exit(1);
}

export class PostgresStorage {
  client: Client | undefined;
  connected = false;

  constructor(connectionString: string) {
    this.client = new Client(connectionString);

    void (async () => {
      try {
        await this.client?.connect();
        this.connected = true;
        info("successfully connected to the database");
      } catch (err) {
        error("error while connecting to the database:", err.message);
      }
    })();
  }

  async waitForConnection() {
    while (!(this.client && this.connected)) {
      await delay(1000);
    }
  }

  async execute<T>(query: string): Promise<T[]> {
    debug("executing query:", query);

    try {
      await this.waitForConnection();

      const response = await this.client?.queryObject({
        camelcase: true,
        text: query,
      });
      const rows = (response?.rows ?? []) as T[];
      const result = JSON.stringify(rows);

      debug("DB returned:", result.length > 0 ? result : "none");
      return rows;
    } catch (err) {
      error(err);
      throw err;
    }
  }

  store(prUrl: string, messageChannel: string, messageTimestamp: string) {
    debug(
      "storing",
      JSON.stringify({ prUrl, messageChannel, messageTimestamp }),
    );
    return this.execute(
      `INSERT INTO pr_messages VALUES (default, default, '${prUrl}', '${messageChannel}', '${messageTimestamp}')`,
    );
  }

  get(prUrl: string) {
    debug("getting", prUrl);
    return this.execute<PrRecord>(
      `SELECT message_channel, message_timestamp, pr_url FROM pr_messages WHERE pr_url = '${prUrl}'`,
    );
  }

  deleteByPrUrl(prUrl: string) {
    debug("deleting", prUrl);
    return this.execute(`DELETE FROM pr_messages WHERE pr_url = '${prUrl}'`);
  }

  deleteBeforeDays(numDays: number) {
    debug("deleting rows older than", numDays, "days");
    const now = new Date();
    const dateString = getDateStringForDeletion(now, numDays);
    return this.execute(
      `DELETE FROM pr_messages WHERE inserted_at < '${dateString}'::date`,
    );
  }

  deleteAll() {
    debug("deleting all entries");

    return this.execute("DELETE FROM pr_messages");
  }

  setGitHubUsername(userId: string, username: string) {
    debug("setting GitHub username", username, "for user", userId);

    return this.execute(
      `INSERT INTO users (slack_id, gh_username) VALUES ('${userId}', '${username}') ON CONFLICT (slack_id) DO UPDATE SET gh_username = EXCLUDED.gh_username;`,
    );
  }

  async getGitHubUsername(userId: string): Promise<string | null> {
    debug("getting GitHub username for user", userId);

    const [row] = (await this.execute(
      `SELECT gh_username FROM users WHERE slack_id = '${userId}'`,
    )) as { ghUsername: string }[];

    return row?.ghUsername || null;
  }

  async getSubscriptionsByUserId(userId: string): Promise<Set<Actions>> {
    debug("getting subscriptions for user", userId);

    const [row] = (await this.execute(
      `SELECT subscriptions FROM users WHERE slack_id = '${userId}'`,
    )) as { subscriptions: string }[];

    return new Set(
      (row?.subscriptions || "").split(/\s+|,+/g).filter(Boolean) as Actions[],
    );
  }

  setSubscriptionsByUserId(userId: string, subscriptions: Set<Actions>) {
    const subscriptionsstr = Array.from(subscriptions).join(",");

    debug("setting subscriptions", subscriptionsstr, "for user", userId);

    return this.execute(
      `INSERT INTO users (slack_id, subscriptions) VALUES ('${userId}', '${subscriptionsstr}') ON CONFLICT (slack_id) DO UPDATE SET subscriptions = EXCLUDED.subscriptions;`,
    );
  }

  async getUserByGitHubUsername(username: string): Promise<User | null> {
    debug("getting metadata for GH user", username);

    const [row] = (await this.execute(
      `SELECT slack_id, subscriptions, inserted_at FROM users WHERE gh_username = '${username}'`,
    )) as { slackId: string; subscriptions: string; insertedAt: string }[];

    if (!row) {
      return null;
    }

    const subscriptions = new Set(
      (row?.subscriptions || "").split(/\s+|,+/g).filter(Boolean) as Actions[],
    );

    return {
      slackId: row.slackId,
      subscriptions,
      insertedAt: row.insertedAt,
      ghUsername: username,
    } as User;
  }

  async getAllPrs(): Promise<PrRecord[]> {
    debug("getting all PR urls");

    const rows = await this.execute<PrRecord>("SELECT * FROM pr_messages");

    return rows;
  }
}

export const storage = new PostgresStorage(CONNECTION_STRING);
export default storage;
