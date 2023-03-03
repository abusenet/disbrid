# Disbrid

A Discord-based Debrid Application

The application takes a `fetch` command with a remote URL, downloads the
resource and uploads it to a cloud storage. The progress is relayed to the user
in Discord.

All credentials/settings are defined in environment variables.

For Discord:

- `DISCORD_APPLICATION_ID`: (required) to verify Discord interaction signature
- `DISCORD_PUBLIC_KEY`: (required) to verify Discord interaction signature
- `DISCORD_BOT_TOKEN`: to register Discord application command
- `DISCORD_GUILD_ID`: to register Discord application command within that guild
  only

If forwarding to external Debrid service, set `DEBRID_API_KEY`.

Must set up `RCLONE_TARGET` to point to a Rclone's remote to upload files to.

And any environment variables to configure Rclone. The followings are required
if supporting Fshare.vn:

- `RCLONE_FSHARE_APP_KEY`
- `RCLONE_FSHARE_USER_EMAIL`
- `RCLONE_FSHARE_PASSWORD`

## CLI Usage

```shell
deno run --allow-all main.ts
```

## As a library

```ts
import { handler } from "./main.ts";

Deno.serve(handler());
```
