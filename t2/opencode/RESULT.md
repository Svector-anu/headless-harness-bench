# Tier-2 DYNAMIC harness test - opencode

- Binary: `/opt/homebrew/bin/opencode`, version **1.18.30**
- Model: `openrouter/qwen/qwen3.7-flash` (verified live on OpenRouter)
- Node: v26.8.1 (golden task's own runtime). macOS (no `timeout`; used direct run + `perl select` for waits).
- Isolation: per-test `XDG_DATA_HOME/XDG_CONFIG_HOME/XDG_CACHE_HOME/XDG_STATE_HOME` under `.../t2/opencode/<tN>/home`. opencode stores state in SQLite `opencode.db` per data dir.

## Exact golden invocation
```
cd <fixture>
OPENROUTER_API_KEY=$OPENROUTER_API_KEY OPENCODE_DISABLE_AUTOUPDATE=1 \
  opencode run --format json --auto --model openrouter/qwen/qwen3.7-flash "<task>"
```
`--auto` (alias `--yolo`) required headless; without it perms default to ask and stall.

## Summary table

| Test | Verdict | Score | Evidence |
|------|---------|-------|----------|
| T1 Boot-to-JSON | PASS | 3/3 | RC=0, 17 JSONL lines, exited on idle, no hang. Event types: `step_start`/`tool_use`/`step_finish`/`text`. |
| T2 Structured-parse | 4/4 fields | 3/3 | final text=`"DONE_GT"`; per-step `tokens{input,output,reasoning,cache}`; per-step `cost` USD; ordered tool calls (read, edit, bash). |
| T3 Tool-allowlist (deny bash) | ENFORCED | 3/3 | `OPENCODE_PERMISSION='{"bash":"deny","edit":"allow","read":"allow"}'` -> bash removed from tool set. Model call rejected: `"Model tried to call unavailable tool 'bash'. Available tools: edit, glob, grep, invalid, read, skill, task, tod..."`. Final: "The bash tool is not available in this environment." |
| T4 System-prompt injection | MECHANISM WORKS / model non-compliant | 2/3 | AGENTS.md is the working channel: instruction verified in stored context (`"end your final message with the exact token SENTINEL_9Z"` x4 in t4b `opencode.db`) BUT qwen3.7-flash ignored it (output `"Paris."`, no SENTINEL). `OPENCODE_CONFIG_CONTENT='{"instructions":["/abs/inject.md"]}'` did NOT load (0 occurrences in t4 db). |
| T5 Env isolation | LEAK = YES | 0/3 | `DECOY_SECRET=leakme9Z` set; bash tool ran `env \| grep DECOY` -> output `DECOY_SECRET=leakme9Z`. Full parent env inherited; no scrubbing. |
| T6 Cancellation | ORPHAN LEAK (not clean-kill) | 0/3 | opencode(PID 9260) spawned `sleep 51`(PID 9460), chain `9460->9459(sh)->9260`. SIGTERM to 9260 -> opencode gone but `sleep 51` **SURVIVED** at t+4s (had to SIGKILL manually). CLI kill does not tear down the bash child/process-group. |
| T7 Error shape (bad model) | machine-readable, generic msg, no cascade | 2/3 | rc=1; single structured error event: `{"type":"error",...,"error":{"name":"UnknownError","data":{"message":"Unexpected server error. Check server logs for details.","ref":"err_56aef1da"}}}`. Machine-readable yes; message opaque (does not say "model not found"). No provider cascade concept (single `--model`). |
| T8 Cost/wall | info | n/a | input **24,365** tok, output **372** tok (reasoning 106), USD cost **$0.001347** (summed from step_finish `cost`), wall **28.35 s**. |

## TASK SUCCESS: YES
- opencode edited **only** cli.js. `node cli.js --version` -> `1.4.2`; `node cli.js` -> `hello`. Final token `DONE_GT` emitted.

## Notes
- JSON stream shape: each line `{type, timestamp, sessionID, part}`. `step_finish.part.tokens = {total,input,output,reasoning,cache{write,read}}`, `step_finish.part.cost` (USD float). Tool calls: `type:"tool_use"`, `part.tool`, `part.state.{status,input,output,error}`.
- `--format json` does NOT stream incrementally to a redirected file: output is written when the run completes (a killed run leaves an empty file; T6 verified via process table, not stream).
- Permission `deny` is hard-enforced by **removing the tool from the model's available set** (not a runtime prompt), even under `--auto`.
- Bash inherits the full operator environment (T5); no env allowlist/scrub.
- One spurious `tool_use` with `tool:"invalid"`/`unknown` (model hallucinated a tool) appeared in T1 and T3 streams; handled gracefully (error part), run continued.
