# survos/ai-chat-bundle

Expose a Survos app's **Symfony AI agents** to chat platforms over an
OpenAI-compatible endpoint, so a chat client (first: **Mattermost** via its Agents
plugin) can `@`-mention them — with optional shared browser chat and voice controls. See `PLAN.md`.

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

Extends `Survos\Kit\AbstractUxBundle`; the `mm:post` command auto-registers.

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

## Shared browser composer

Include `@SurvosAiChat/widget.html.twig` with `messages` (`role`, `text`),
`action` (POST URL), `token` (CSRF value), and `samples` (`label`, `question`).
Optional `placeholder` and `maxLength` customize the composer. The widget uses
Bootstrap classes and escapes all messages; it does not render model-generated HTML.

The `chat` Stimulus controller fills/focuses a sample question without submitting,
supports Ctrl/⌘+Enter, announces pending work, and prevents duplicate submissions.
The host owns authorization, CSRF validation, rate limits, retrieval, models,
conversation persistence, reset, and error handling. It works with ordinary POST
and redirect flows; it does not assume a newspaper, article, or database schema.
Enable `chat` under `@survos/ai-chat-bundle` in the application's controllers.json
when testing a locally linked checkout; published installs use Flex UX discovery.

Mastheads is the initial consumer. FF's RappNews composer informed the interaction;
FF has not been migrated to this template.

## Voice conversations and source links

The bundle now extends `AbstractUxBundle`. The optional `voice` controller wraps
an existing asynchronous question form. FF's Ask Rapp is the first voice consumer.
No provider keys, retrieval logic or newspaper-specific prompts live in the bundle.

Resolve its identifier with `survos_stimulus('ai-chat-bundle', 'voice')` and attach
it using `stimulus_controller`. Values: `url` (transcription POST), `speechUrl`
(speech POST), `token` (CSRF), `rate` (playback speed, 0.75–1.75, default 1), `name` (spoken assistant label), and `captureUrl`
(`asset('@survos/ai-chat-bundle/src/audio/capture_processor.js')`). Include
`@SurvosAiChat/voice_controls.html.twig` inside that element, and attach the
controller's `form` and `input` targets to the host form/question field.
The optional `review` template variable defaults true; turning review off enables
a continuous conversation with automatic submission, spoken replies and interruption.

Wire host events to `questionStarted`, `answerReceived`, and `answerFailed` with
`stimulus_action`. `answerReceived` expects `event.detail = {text, mode}`; `mode`
is `voice` for conversational prose or `text` for an answer needing spoken adaptation.
The host should read `element.dataset.answerMode` when submitting its question.
Wire `visibilitychange@document` to `visibilityChanged` to pause in the background.
For replay, put `data-voice-answer` and `data-answer-mode` on the answer wrapper,
`data-voice-text` on its text, and a `play` target / `readAnswer` click action on
its button. These markers are independent of the generated controller identifier.

Transcription receives multipart `audio` (16 kHz mono WAV, up to 55 seconds,
under 1.8 MB) and `_token`, returning JSON `{text}` or `{error}`. Speech receives
form fields `text`, `mode`, `_token`, returning browser-playable audio or JSON
`{error}`. The host owns authentication, validation, rate limits and providers.
An input's `maxlength` and browser validity rules are respected.

Hands-free playback monitors an echo-cancelled microphone. Sustained input stops
the reply and keeps 400 ms of pre-roll, preserving the first syllable. Brief noises
do not trigger an interruption. Stop/disconnect/backgrounding releases the microphone
and cancels pending playback. This requires HTTPS (or localhost), AudioWorklet and
microphone permission. Acoustic echo suppression depends on the device/browser;
real speakerphone/car testing is still needed. It is not a full-duplex realtime API.

Attach the optional `links` controller to an answer/history region to open HTTP(S)
sources in a new tab with `noopener noreferrer` and an `icon-external` SVG. It handles
restored history and streamed DOM additions; fragment links remain in-page.

Run the audio/lifecycle tests with `node --test bu/ai-chat-bundle/tests/js/*.test.mjs`
from the monorepo root.

### Clear conversation

Pass `resetAction` (a POST endpoint) and `resetToken` (its CSRF token) to the shared
widget to show a **Clear conversation** button. `resetLabel` optionally changes
the label. The host must validate CSRF and clear both displayed turns and the
agent memory for the selected conversation, then redirect to the empty chat.
Omitting `resetAction` preserves existing consumers unchanged. The reset form is
separate from the question form, so clearing does not require a question.

## MCP connect page

`@SurvosAiChat/mcp_connect.html.twig` is the "Connect your own AI agent" page for an
app with a public, read-only MCP server (symfony/mcp-bundle): connect by URL
(Streamable HTTP, no authentication), Claude custom connector steps, ChatGPT custom
MCP server steps, `claude mcp add`, a local stdio `mcpServers` configuration for
`bin/console mcp:server <server>`, the tool list, a sample prompt and a connection check.

The bundle serves it at `/ask/connect` (route `survos_ai_chat_connect`); the app only
configures it and links the route from its menu:

```yaml
# config/packages/survos_ai_chat.yaml -- the fragment's variables (table below)
survos_ai_chat:
    connect:
        name: Kid Pan Alley
        server: kpa
        lead: Search the songs … from your own AI assistant.
        back: {url: /ask, label: Ask the catalog}
```

```php
$this->add($menu, 'survos_ai_chat_connect', label: 'Connect your assistant', icon: 'tabler:plug-connected');
```

The endpoint defaults to the request's host plus `/mcp` (set `url` or `endpoint` to change it).
Without `name` the route answers 404. For another layout or HTML in the blocks below, override `templates/bundles/SurvosAiChatBundle/connect_page.html.twig`, or keep
your own route and template and embed the fragment:

```twig
{% extends 'base.html.twig' %}
{% block body %}
    {% embed '@SurvosAiChat/mcp_connect.html.twig' with {
        name: 'Kid Pan Alley',
        endpoint: publicUrl ~ '/mcp',
        server: 'kpa',
        checkout: 'KPA',
        back: {url: path('ask'), label: 'Ask the catalog'},
        lead: 'Search the songs … from your own AI assistant.',
        hidden_tools: ['agent_calls'],
        tool_descriptions: {find_songs: 'Find songs by meaning …'},
        prompt: 'Use Kid Pan Alley to find three songs about winter …',
    } %}
        {% block check %}<p>For a quick connection check, ask your agent to call <code>get_song</code> …</p>{% endblock %}
    {% endembed %}
{% endblock %}
```

| Variable | Meaning |
|---|---|
| `name` | Service name shown to people and suggested as the connector name. Required. |
| `endpoint` | The public MCP URL. Or give `url` (the site's public base URL) and `/mcp` is appended. |
| `server` | The `mcp.servers` key: the stdio command's argument and where the tool list comes from. Without it there is no local-checkout section. |
| `connector_id` | Name used by `claude mcp add` and as the `mcpServers` key. Default: `server`. |
| `console`, `app_name`, `checkout` | Console path in the stdio example (default `/absolute/path/to/<app_name>/bin/console`) and the checkout's name in its sentence. |
| `title`, `back` (`{url, label}`), `lead`, `intro` | Optional heading, back link and introduction. |
| `tools` | Optional list of `{name, description}`. Omit it to read the tools from the server's MCP registry (`mcp_tools(server)`), so the page can't name a tool the server lacks or miss a new one. |
| `hidden_tools` | Tool names left off the page (admin or diagnostic tools). |
| `tool_descriptions` | `{tool: html}` overrides of the registry's model-oriented descriptions with text for people. Rendered as HTML: write it in the app, never from user input. An override for a tool the server no longer has is not shown. |
| `tools_note`, `prompt`, `check`, `footnotes` (list) | Plain text after the tool list: what the tools may not do, a prompt to try, a connection check and caveats. |
| `claude_code_prompt` | Optional example question after the `claude mcp add` line. |
| `claude`, `chatgpt`, `claude_code` | Set to `false` to leave out a section. |
| `section_class`, `body_class` | Wrapper classes of each section; default Bootstrap `card mb-3` / `card-body`. |

Blocks, for HTML (`{% embed %}`): `intro`, `url_note`, `local_note`, `tools_note`,
`check`, `footnotes`, `extra_sections`.

The Twig functions `mcp_tools(server)` (`{name, title, description, readOnly}` per tool)
and `mcp_server_exists(server)` read `Survos\AiChatBundle\Mcp\McpToolCatalog`, which
builds the server the way `debug:mcp` does. Without symfony/mcp-bundle the catalog is
empty and `tools` must be passed.
