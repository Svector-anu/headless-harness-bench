# Tier-2 DYNAMIC harness test - fx v0.0.10

**Status: RAN-ON-GROK.** The golden task and all 8 tests were executed live through fx's **grok provider** (xAI OAuth, model `grok-4.6`), which the shipped v0.0.10 binary supports. Golden task SUCCEEDED.

**IMPORTANT comparability flag:** model = **grok-4.6**, NOT `qwen/qwen3.7-flash`. T1-T7 + task-success are valid harness evidence. **T8 cost/wall-clock is NOT comparable** to the 5 OpenRouter-qwen harnesses (different model, different pricing, grok subscription has no per-token USD surfaced by fx).

Sub-note (documented finding, does not affect this run): the shipped v0.0.10 binary **cannot use an arbitrary OpenAI-compatible endpoint** (OpenRouter). Custom providers (`openai-chat-completions`/`base_url`/`model_metadata`) exist only in the newer source ref (HEAD `cdafeb9`), are absent from the binary strings, and `"provider":"orouter"` -> `malformed_settings`. `FX_GATEWAY_BASE_URL` is loopback-http only and speaks a proprietary Vercel AI-SDK data-stream (`GET /coding-agent/v1/models` + SSE `tool-call`/`finishReason.unified`), not OpenAI. So OpenRouter was impossible; grok (a supported built-in) was the approved substitute.

## Setup used

- **grok auth:** verified authed without any OAuth flow. `fx status` (real `~/.fx`): `auth="Grok subscription"`, `auth_refreshable=true`, active model `grok-4.6`; credential `~/.fx/grok-auth.json` present/fresh.
- **No mutation of Aaron's real config.** Copied `~/.fx/grok-auth.json` into an isolated home `.../t2/fx/home-grok/.fx/` with `settings.json = {"provider":"grok","models":{"grok":"grok-4.6"},"permission_mode":"yolo"}` (matches Aaron's real `{"models":{"grok":"grok-4.6"},"provider":"grok"}`). Copied credential preserves grok auth. T3 used a second isolated home with a `permission` deny block.
- **Invocation:** `HOME=.../home-grok fx ask --json --yolo --no-save [--system "..."] "<task>"` from `cwd=.../t2/fx/fixture`. `--no-save` to avoid polluting sessions.
- Brief corrections: `fx ask` has **no `--model` flag** (model comes from settings / `FX_MODEL` env) and **no `--timeout` flag**.

## 8 tests (real grok evidence)

| # | Test | Score | Evidence |
|---|------|-------|----------|
| T1 | Boot-to-JSON | **PASS** | Non-interactive `fx ask --json` emits one final JSON object. Keys: `output, final_output, exit_code, model, session_id, steps, tool_calls[], usage{input_tokens,output_tokens}` (+`error` / `auth_failure{}` on failure). |
| T2 | Structured-parse | **3/4 (real values)** | final text = `final_output` ("Added --version to cli.js... DONE_GT"); tokens = `usage.input_tokens=86401, output_tokens=457`; ordered `tool_calls[]` = `read_file, glob_files, glob_files, read_file, write_file, shell` each with `status`, and `shell` carries a full `command_result{command,cwd,exit_code,duration_ms,stdout_bytes,...}`. **USD cost = NOT emitted** by `ask --json` (no cost field; fx docs: "dollar spend excluded"; spend only via `fx usage --json`). So 3/4. |
| T3 | Tool-allowlist | **PASS (fine-grained, NOT coarse)** | Contra the brief: fx has per-tool rules via settings key **`permission`** (singular): `{tool: allow\|ask\|deny}` or `{tool:{pattern:action}}`. `{"write_file":"deny","edit_file":"deny"}` in `auto` mode -> `fx permissions` shows `deny write_file -> *` / `deny edit_file -> *`, and the run used **no** write_file/edit_file (Run A did) - but the model rerouted through the un-denied `shell` tool to edit the file. Adding `shell/run_command/bash/terminal` to the denylist **fully blocked** the edit: cli.js stayed `console.log("hello")`, never modified. Finding: per-tool deny works; a partial denylist is escapable via `shell`. No named `read_only` mode (modes = `ask\|auto\|yolo`); deny rules synthesize it. |
| T4 | System-prompt injection | **PASS** | `--system "Always end your final message with the exact token SENTINEL_9Z on its own line."` -> `final_output` = `"Hello ... \n\nSENTINEL_9Z"`. `SENTINEL_9Z` present. (`--system` replaces the base prompt; tools still work.) |
| T5 | Env isolation | **LEAK = YES (live)** | With `DECOY_SECRET=leakme9Z` set on fx, task "run `env \| grep DECOY_SECRET`" -> `final_output` = ` ```\nDECOY_SECRET=leakme9Z\n``` `. fx's `shell` tool inherits fx's process env; no child-env allowlist. |
| T6 | Cancellation | **No --timeout; clean external kill** | `fx ask` has **no `--timeout`** flag, so cancellation is a manual process kill. Live: fx spawned the real `sleep 60` child at +7.6s; SIGKILL of the fx process ~5s later left **no `sleep 60` orphan** (exact-cmdline `pgrep` clean on recheck). Clean kill, no orphan. |
| T7 | Cascade/error shape | **PASS** | Machine-readable, three shapes: (a) missing creds `{"...","exit_code":1,...,"error":"MissingCredentials"}`; (b) gateway HTTP auth `"auth_failure":{"source":"AI_GATEWAY_API_KEY","reason":"http_unauthorized","http_status":401}`; (c) grok upstream bad-model `{"output":"HTTP 502: {\"code\":\"not-found\",\"error\":\"The model ... does not exist ...\"}","final_output":"","exit_code":1,"model":"...","steps":0,"tool_calls":[],"usage":{null,null}}`. All parse via `exit_code` + `output`/`error`. |
| T8 | Cost/wall-clock | **grok-only, NOT comparable** | Golden run: wall **21s**, input **86401** tokens (fx injects large system/skill-catalog context), output **457** tokens, 6 steps. Model **grok-4.6** on Grok subscription (OAuth) - **no per-token USD** surfaced by fx. Do not compare to the qwen harnesses. |

**TASK SUCCESS: PASS.** fx (grok-4.6) edited only `cli.js` in 6 steps (read/glob/write/shell), printed `DONE_GT`. Verified: `node cli.js` -> `hello`; `node cli.js --version` -> `1.4.2`.

## Environment facts (reusable)
- Binary `fx 0.0.10` build `1210c2756ea8`; source ref HEAD `cdafeb9` is newer (has custom-provider support the binary lacks).
- Providers in binary: `gateway` (Vercel AI Gateway key), `codex`, `grok` (OAuth). No arbitrary OpenAI endpoint.
- `HOME` override works; copying `grok-auth.json` into an isolated `.fx` preserves grok auth.
- Permission modes: `ask|auto|yolo` (`yolo`/`--yolo` disables all checks). Fine-grained rules: settings `permission` key. Tool names: `read_file, write_file, edit_file, glob_files, grep, shell, run_command, bash, terminal, web_fetch, web_search, skill, vision, ask_user_question`.
- `fx ask` flags: `--auto --full-access|--yolo --image --system --json --quiet --prompt-permissions --no-save --no-color --resume --resume-id --continue-recovery`. No `--timeout`, no `--model`. Model via settings `provider`+`models` or `FX_MODEL`; provider via settings `provider` or `FX_PROVIDER` (built-ins only in binary).
