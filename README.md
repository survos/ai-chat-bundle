# survos/ai-chat-bundle

Expose a Survos app's **Symfony AI agents** to chat platforms over an
OpenAI-compatible endpoint, so a chat client (first: **Mattermost** via its Agents
plugin) can `@`-mention them — no bot client, no chat UI to build. See `PLAN.md`.

```
@Curator …  →  Mattermost Agents plugin  →  POST {app}/v1/chat/completions  →  resolve persona → run agent → reply
```

The bundle owns the **communications** (OpenAI transport, auth, persona routing);
each app supplies one thin `ChatAgentResolverInterface`. Comms first — this release
ships the Mattermost wiring and an `mm:post` proof; the completions endpoint + agent
wiring come next.

## Install

```bash
composer require survos/ai-chat-bundle
```

Extends `Survos\Kit\AbstractSurvosBundle`; the `mm:post` command auto-registers.

## Demo — prove the chat plumbing (`mm:post`)

The demo lives in [`demo/`](demo/) — a tiny console app that posts to a Mattermost
instance through the **Symfony Mattermost notifier**.

1. **Have a Mattermost over https.** The notifier hardcodes `https://`, so it can't
   reach a plain-http local docker. Use the deployed server:
   **`https://chat.survos.com`** (the `survos-sites/mattermost` repo on Dokku).
2. In Mattermost: create a **bot** (or personal access token) and grab the target
   **channel id** (the 26-char id in the channel URL, or via the API).
3. Configure the demo:
   ```bash
   cd demo
   cp .env.example .env.local
   # set MATTERMOST_DSN=mattermost://<TOKEN>@chat.survos.com?channel=<CHANNEL_ID>
   composer install
   ```
4. Post:
   ```bash
   bin/console mm:post "Hello, Mattermost!"
   bin/console mm:post "Hi there" <channel_id>     # override the default channel
   ```

A cooler demo (later): a **TUI** that posts *and* listens, instead of a one-shot post.

## Roadmap

- **v1 (next):** `POST /v1/chat/completions` controller + `ChatAgentResolverInterface`
  (non-streaming; `symfony/ai` ^0.10).
- **v2:** MCP tools — watch `symfony/ai#2237` (`#[AsMcpApp]` / `#[AsMcpAppTool]`);
  relates to `survos/mcp-bundle`.

See `PLAN.md` for the full design and decisions.
