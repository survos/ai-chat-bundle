# PLAN — survos/ai-chat-bundle

Status: **comms-first scaffold.** Mattermost `mm:post` demo built; OpenAI-compatible
completions endpoint + resolver are designed here, not yet wired. This file is the
canonical committed design (don't rely on machine-local agent memory — it doesn't
travel between computers).

## Goal

Expose a Survos app's Symfony AI agents to chat platforms (first: Mattermost via its
**Agents** plugin) without hand-rolling a bot client or a chat UI. A chat client
speaks the OpenAI protocol to us; we resolve a persona, run the app's agent (RAG +
tools), and answer. See `survos-sites/scanseum#7`.

```
@Curator …  →  Mattermost Agents plugin  →  POST {app}/v1/chat/completions  →  resolve persona → run agent → reply
```

## Architecture (decided): comms in the bundle, callback in the app

The OpenAI request/response mapping, bearer auth, persona/tenant routing and (later)
SSE streaming are **identical in every app** — that's the bundle. The only per-app
thing is *which agent answers*, so each app ships one thin service.

- **Bundle owns:** `POST /v1/chat/completions` (+ `/v1/models`) controller, auth,
  the OpenAI schema mapping, routing from the `model` field, error envelopes.
- **App provides:** one `ChatAgentResolverInterface` implementation
  (`src/Contract/ChatAgentResolverInterface.php`) mapping `model` → a
  `Symfony\AI\Agent\AgentInterface`. The bundle never imports app concepts
  (folio, museado, personas). zm's resolver maps `curator` → the existing
  `ai.agent.folio` agent + `FolioChatTools` + `CuratorChatMemoryProvider`.

## v1 scope

1. **Comms proof (done):** `mm:post` command (`src/Service/MattermostService.php`)
   posts to Mattermost over the **Symfony Mattermost notifier**, proving the wiring
   before any AI. Get the chat working, then wire the agent.
2. **Completions endpoint (next):** the controller + `ChatAgentResolverInterface`,
   non-streaming first.

### Decisions

- Base class: **`Survos\Kit\AbstractSurvosBundle`** (not plain `AbstractBundle`).
  No assets → not `AbstractUxBundle`.
- Commands are `#[AsCommand]` **methods on a service class** (CONVENTIONS.md), never
  `extends Command`.
- `symfony/ai` **^0.10** for now. Streaming lands in symfony/ai v0.11 (demo already on
  `main`); not important yet — wire non-streaming, upgrade later.
- **The Mattermost notifier hardcodes `https://`** (`MattermostTransport.php:62`), so
  it can't reach a plain-http local docker. Resolution: deploy `survos-sites/mattermost`
  to Dokku as **chat.survos.com** (https, live) and point `MATTERMOST_DSN` there.
  (Not `chat.museado.org`: zm owns the `*.museado.org` Dokku wildcard for tenants like
  `nara.museado.org`, so chat lives under survos.com to avoid colliding.)

## v2 — MCP tools (after symfony/ai 0.11)

A second transport: expose the app's `#[AsTool]` services as MCP tools so an
MCP-capable client (Mattermost Agents has an embedded MCP server; Claude Desktop)
runs its own loop and calls our tools.

- **Watch / for inspiration:** `symfony/ai#2237` — *[MCP Bundle] Add MCP Apps support
  (`#[AsMcpApp]` / `#[AsMcpAppTool]`)*. Still in dev; the attribute-driven MCP-app shape
  is likely how we'll expose tools here. <https://github.com/symfony/ai/pull/2237>
- Relates to **`survos/mcp-bundle`** (mcp/sdk + symfony/ai-mate). Decide whether MCP
  tools live here or there before building.

## Demo

- Now: `bin/console mm:post "Hello, Mattermost!" <channel>` (see README).
- Later (cooler): a **TUI** chat client instead of a one-shot post — posts and listens
  in a terminal UI. Comms first, TUI second.

## Open questions

- Persona/tenant scoping: the OpenAI payload carries no Mattermost channel/team/thread
  ids, so encode persona in the `model` field and/or register one Agents service per
  persona/path.
- `survos/ai-chat-bundle` vs graduating pieces into existing bundles.
