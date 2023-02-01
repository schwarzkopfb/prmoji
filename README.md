# prmoji

A tiny web service that puts emojis on your Slack message when your PR is
approved, commented etc.

![prmoji-approved-and-merged-emoji](./prmoji.png)

This is a [Deno](https://deno.land) port of
[Marcell Endrey's Node.js implementation](https://github.com/endreymarcell/prmoji).

## How does it work?

If you invite the `prmoji` bot to your channel, it'll start listening to your
messages. Whenever someone posts a GitHub pull request URL, `prmoji` saves that
into the database (URL, message channel, message timestamp).

## Setup

It requires the latest
[Deno CLI](https://deno.land/manual/getting_started/installation).

Run `deno task start` to start the service.

Integrates seamlessly with [Deno Deploy](https://deno.com/deploy).

### Database

You'll need a PostgreSQL database with the following table:

```
                                            Table "public.pr_messages"
      Column       |            Type             | Collation | Nullable |                 Default
-------------------+-----------------------------+-----------+----------+-----------------------------------------
 id                | smallint                    |           | not null | nextval('pr_messages_id_seq'::regclass)
 inserted_at       | timestamp without time zone |           |          | now()
 pr_url            | character varying           |           | not null |
 message_channel   | character varying           |           |          |
 message_timestamp | character varying           |           |          |
Indexes:
    "pr_messages_pkey" PRIMARY KEY, btree (id)
```

```
                                                 Table "public.users"
    Column     |            Type             | Collation | Nullable | Default | Storage  | Stats target | Description 
---------------+-----------------------------+-----------+----------+---------+----------+--------------+-------------
 slack_id      | character varying(12)       |           | not null |         | extended |              | 
 inserted_at   | timestamp without time zone |           |          | now()   | plain    |              | 
 gh_username   | character varying(39)       |           |          |         | extended |              | 
 subscriptions | character varying(68)       |           |          |         | extended |              | 
Indexes:
    "users_pkey" PRIMARY KEY, btree (slack_id)
```

For ease of setup here are pre-cooked SQL queries to initialize those tables:

```SQL
CREATE TABLE pr_messages(id SERIAL PRIMARY KEY, inserted_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(), pr_url VARCHAR(50) NOT NULL, message_channel VARCHAR(30), message_timestamp VARCHAR(20));
```

```SQL
CREATE TABLE users(slack_id VARCHAR(12) PRIMARY KEY, inserted_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(), gh_username VARCHAR(39), subscriptions VARCHAR(68));
```

### Service

Run: `deno task start`

Optionally you can specify the log level with `deno task start -- --loglevel=X`
where X is one of: `silent`, `error`, `info`, `debug`, `silly`. (Default is
`info`.)

You'll have to set the following env vars:

- `SLACK_TOKEN` - for communicating with Slack
- `DATABASE_URL` - the PostgreSQL DB URL including credentials

The port can be overwritten with the `PORT` var, defult is `5000`.

#### Optional merge notifications from all users in a given channel

Also if `NOTIFICATIONS_CHANNEL_ID` is set, Prmoji will send updates to that
channel when a tracked PR gets merged. Note: this feature requires `chat:write`
or `chat:write.public` scope to be configured in Slack for the app.

#### Customise bot user appearance

Set `APP_NAME` and `APP_DISPLAY_NAME` env vars to update the bot user's name.
It's recommended to use the same values that you configured in Slack.

### Slack

Note: this only has to be done once. Note2: this guide is a bit otdated (Slack
updated it's UI) but the main steps are same, so you should succeed with it.

- Go to https://api.slack.com/apps/
- Click Your apps
- Click Create New App
- Enter "prmoji" and select your workspace
- On the next page, under Add features and functionality
- Select Event subscriptions
- Click Enable Events
- Add https://<project_name>.deno.dev/event/slack as the URL
- Go to "Slash commands" section to setup `/prmoji` command. The url should be
  `https://<project_name>.deno.dev/event/slack/command`.
- Navigate to Bot Users
- Click Add a Bot User, then without changing anything click the Add a Bot User
  below the form
- Navigate back to Event Subscriptions
- Click Enable Events
- Fill out the URL with the same value as above
- Under Subscribe to bot events, select `message.channels` and `message.groups`
- Click Install App
- Click Add app to your workspace
- Copy the Bot access token and expose it for the service as an env var called
  `SLACK_TOKEN`

### GitHub

Note: this has to be done for every repository you wish to watch.

- Go to https://github.com/YOUR-USER/YOUR-REPO/settings/hooks
- Click Add webhook
- Add https://<project_name>.deno.dev/event/github as the URL
- Change the content type to application/json
- Click Let me select individual events
- Tick Issue comments, Pull requests, Pull request reviews, and Pull request
  review comments
- Click Add webhook

## Development

The project is aligned with Deno's philosophy, styling guide and based on the
built-in tools like `deno lint`, `deno fmt` and `deno test`, etc.

You have to set up at least the `SLACK_TOKEN` and `DATABASE_URL` env vars in
your shell then run `deno task dev` to start the service and listen to source
file changes and auto-restart.

## License

[GNU GPLv3](./LICENSE)
