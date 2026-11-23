# Telegram X Hero

Telegram X Hero is a Telegram Mini App for private messaging, people discovery and contact management.

## Features

- Telegram Mini App authentication using signed initData
- Automatic profile sync from Telegram
- Search registered users by exact or partial @username and display name
- Private one-to-one conversations
- Message history, editing and deletion
- Unread counts and typing status endpoints
- Contacts and block/report tools
- Owner-only admin overview, user moderation and report review
- Existing Profile page retained

## Stack

- Preact + Vite frontend
- Hono on Cloudflare Workers
- Cloudflare D1 database
- Telegram Bot API for Mini App entry and webhook registration

## Setup

1. Create a Telegram bot with @BotFather.
2. Set the Worker secret `BOT_TOKEN` in Cloudflare. Never commit it to Git.
3. Set `OWNER_IDS` to the Telegram numeric ID(s) allowed to access the admin panel.
4. Connect the repository to Cloudflare Workers and deploy.
5. Apply D1 migrations (the Worker also applies bundled migrations on first request).
6. Set the Mini App URL with @BotFather and configure the bot webhook to `https://YOUR_WORKER_HOST/bot` with the webhook secret derived by this Worker.
7. Start the bot from two Telegram accounts and open the Mini App from each account. Users become searchable after they have started the bot or opened the app at least once.

## Search behavior

Telegram does not provide a bot with a directory of every Telegram account. A user can be found after they have started this bot or authenticated in the Mini App at least once. Search supports usernames with or without the leading `@`, plus display names. A successful lookup opens or reuses the same direct conversation for both users.

## Checks

```sh
npm ci
npm run typecheck
npm test
npm run build
```

## Security

- Keep `BOT_TOKEN` in Worker secrets, never in `wrangler.jsonc` or source control.
- If a token was ever committed, revoke it with @BotFather and create a replacement. Removing it from the current file does not erase it from Git history.
- Admin APIs verify the authenticated Telegram user ID on every request.
