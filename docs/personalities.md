# Personalities (parked idea)

Status: **data only, not wired.** Nothing in the bundle reads
[`data/personalities.yaml`](../data/personalities.yaml) yet. This page records where it
came from and how it might be used, so the idea isn't lost.

## Origin

Copied from `survos-sites/bots` (`config/personalities.yaml`), Tac's first AI
experiment (2025, neuron-ai + Meilisearch RAG). That app is retired; this list was the
one piece worth keeping.

## What's in it

A list under `chatbot_personalities`, each entry with:

| key           | meaning                                                  |
|---------------|----------------------------------------------------------|
| `code`        | stable slug, e.g. `socratic_guide` — usable as an id     |
| `name`        | human label for a picker                                 |
| `description` | a system-prompt fragment that sets tone, written to the model ("You are …") |

Eight personas: Professional & Helpful, Friendly Expert, Dry & Literal, Casual & Witty,
Calm & Compassionate, Socratic Guide, Mysterious Oracle, and a Role-based support rep
(`support_rep`, which has a `[Company Name]` placeholder to fill in).

## Tone, not identity

A personality here is a **tone of voice**, separate from the *agent* (which model,
which RAG index, which tools). `Curator`, `RappNews` etc. are agents; "Socratic" is a
way any of them could talk. Keep the two apart: the bundle's rule is that it never
imports app concepts, and a generic tone layer respects that, since these prompts
mention no app, tenant or schema.

## Ways it could be used someday

1. **Persona suffix in the `model` field.** `PLAN.md` already routes on `model`
   (`curator`, `museado/curator@walters`). A tone could ride along, e.g.
   `curator+socratic_guide`. The completions controller would split off the suffix,
   let the app's `ChatAgentResolverInterface` resolve the agent as usual, and add the
   personality's `description` to the system prompt. `/v1/models` could list each
   combination, so Mattermost Agents shows them as separate bots.

2. **A picker in the browser widget.** `widget.html.twig` could take an optional
   `personalities` list (`code`, `name`) and render a select. The host posts the chosen
   `code` with the question and applies it; the bundle still owns no prompts at
   runtime beyond this shared list.

3. **A small registry service.** Something like `PersonalityRegistry` loads the YAML
   (overridable via bundle config so apps can add or replace entries) and returns
   `get(code): ?Personality`. Symfony AI's system-prompt input processor, or a
   message prepended by the controller, applies it. This is the piece options 1 and 2
   would both need.

4. **Demo and eval fodder.** Running one question through several tones is a quick way
   to show the chat plumbing works, and to check that an agent's RAG answers stay
   factual when the style changes.

## Before wiring it

- Decide the precedence: the app's own system prompt should win on facts and safety;
  the personality only adjusts style. Append it rather than replace.
- `support_rep` needs its placeholder filled by the app (or dropped).
- Move the file to wherever bundle config resources end up if the registry is built;
  `data/` is just a parking spot.
