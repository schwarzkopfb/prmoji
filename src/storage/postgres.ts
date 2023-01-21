import { delay } from "std/async/delay.ts";
import { Client } from "postgres";
import * as logger from "../utils/logger.ts";
import PrRecord from "../models/PrRecord.ts";
import { getDateStringForDeletion } from "../utils/helpers.ts";
import { Actions } from "../const.ts";

export class PostgresStorage {
  client: Client | undefined;
  connected = false;

  constructor(connectionString: string) {
    this.client = new Client(connectionString);

    void (async () => {
      try {
        await this.client?.connect();
        this.connected = true;
        logger.info("[storage] Successfully connected to the database");
      } catch (error) {
        logger.error(
          "[storage] Error while connecting to the database:",
          error.message,
        );
      }
    })();
  }

  async waitForConnection() {
    while (!(this.client && this.connected)) {
      await delay(1000);
    }
  }

  async execute<T>(query: string): Promise<T[]> {
    logger.debug("[storage] executing query:", query);

    try {
      await this.waitForConnection();

      const response = await this.client?.queryObject({
        camelcase: true,
        text: query,
      });
      const rows = (response?.rows ?? []) as T[];
      const result = JSON.stringify(rows);

      logger.debug(
        "[storage] DB returned:",
        result.length > 0 ? result : "none",
      );

      return rows;
    } catch (error) {
      logger.error("[storage]", error);
      throw error;
    }
  }

  store(prUrl: string, messageChannel: string, messageTimestamp: string) {
    logger.debug(
      "[storage] storing",
      JSON.stringify({ prUrl, messageChannel, messageTimestamp }),
    );
    return this.execute(
      `INSERT INTO pr_messages VALUES (default, default, '${prUrl}', '${messageChannel}', '${messageTimestamp}')`,
    );
  }

  get(prUrl: string) {
    logger.debug("[storage] getting", prUrl);
    return this.execute<PrRecord>(
      `SELECT message_channel, message_timestamp FROM pr_messages WHERE pr_url = '${prUrl}'`,
    );
  }

  deleteByPrUrl(prUrl: string) {
    logger.debug("[storage] deleting", prUrl);
    return this.execute(`DELETE FROM pr_messages WHERE pr_url = '${prUrl}'`);
  }

  deleteBeforeDays(numDays: number) {
    logger.debug("[storage] deleting rows older than", numDays, "days");
    const now = new Date();
    const dateString = getDateStringForDeletion(now, numDays);
    return this.execute(
      `DELETE FROM pr_messages WHERE inserted_at < '${dateString}'::date`,
    );
  }

  deleteAll() {
    logger.debug("[storage] deleting all entries");
    return this.execute("DELETE FROM pr_messages");
  }

  setGitHubUsername(userId: string, username: string) {
    logger.debug(
      "[storage] setting GitHub username",
      username,
      "for user",
      userId,
    );

    return this.execute(
      `INSERT INTO users (slack_id, gh_username) VALUES ('${userId}', '${username}') ON CONFLICT (slack_id) DO UPDATE SET gh_username = EXCLUDED.gh_username;`,
    );
  }

  async getGitHubUsername(userId: string): Promise<string | null> {
    logger.debug("[storage] getting GitHub username for user", userId);

    const [row] = await this.execute(
      `SELECT gh_username FROM users WHERE slack_id = '${userId}'`,
    ) as { ghUsername: string }[];

    return row?.ghUsername || null;
  }

  async getSubscriptions(userId: string): Promise<Set<Actions>> {
    logger.debug("[storage] getting subscriptions for user", userId);

    const [row] = await this.execute(
      `SELECT subscriptions FROM users WHERE slack_id = '${userId}'`,
    ) as { subscriptions: string }[];

    return new Set(
      (row?.subscriptions || "").split(/\s+|,+/g).filter(Boolean) as Actions[],
    );
  }

  setSubscriptions(userId: string, subscriptions: Set<Actions>) {
    const subscriptionsstr = Array.from(subscriptions).join(",");

    logger.debug(
      "[storage] setting subscriptions",
      subscriptionsstr,
      "for user",
      userId,
    );

    return this.execute(
      `INSERT INTO users (slack_id, subscriptions) VALUES ('${userId}', '${subscriptionsstr}') ON CONFLICT (slack_id) DO UPDATE SET subscriptions = EXCLUDED.subscriptions;`,
    );
  }
}
