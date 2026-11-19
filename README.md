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
(speech POST), `token` (CSRF), `name` (spoken assistant label), and `captureUrl`
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
