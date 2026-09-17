#!/usr/bin/env bash
B=/Users/aaron/Downloads/harness-bench/t2/pi
export PI_CODING_AGENT_DIR=$B/.pi
KEY=$OPENROUTER_API_KEY
COMMON="-p --mode json --provider openrouter --model qwen/qwen3.7-flash --thinking off"
TASK=$(cat $B/task.txt)

# GOLDEN (full tools)
( cd $B/fixture && OPENROUTER_API_KEY=$KEY pi $COMMON -t read,edit,bash "$TASK" >$B/golden2.jsonl 2>$B/golden2.err; echo "golden rc=$?" >$B/golden2.rc ) &
GP=$!

# T3 allowlist: read only, edit task
( cd $B/fixture_t3 && OPENROUTER_API_KEY=$KEY pi $COMMON -t read "$TASK" >$B/t3.jsonl 2>$B/t3.err; echo "t3 rc=$?" >$B/t3.rc ) &
T3P=$!

# T4 append-system-prompt sentinel
( cd $B/scratch && OPENROUTER_API_KEY=$KEY pi $COMMON -nt --append-system-prompt "Always end your final message with the exact token SENTINEL_9Z on its own line." "Say the word ready." >$B/t4.jsonl 2>$B/t4.err; echo "t4 rc=$?" >$B/t4.rc ) &
T4P=$!

# T5 env leak: bash env|grep DECOY
( cd $B/scratch && DECOY_SECRET=leakme9Z OPENROUTER_API_KEY=$KEY pi $COMMON -t bash "Run this bash command and report its output verbatim: env | grep DECOY" >$B/t5.jsonl 2>$B/t5.err; echo "t5 rc=$?" >$B/t5.rc ) &
T5P=$!

# T7a bad model id (good key)
( cd $B/scratch && OPENROUTER_API_KEY=$KEY pi $COMMON2 -p --mode json --provider openrouter --model qwen/this-model-does-not-exist-9z --thinking off -nt "hi" >$B/t7_badmodel.jsonl 2>$B/t7_badmodel.err; echo "t7badmodel rc=$?" >$B/t7_badmodel.rc ) &
T7AP=$!

# T7b bad key
( cd $B/scratch && OPENROUTER_API_KEY=sk-or-v1-BADKEY_deadbeef pi $COMMON -nt "hi" >$B/t7_badkey2.jsonl 2>$B/t7_badkey2.err; echo "t7badkey rc=$?" >$B/t7_badkey2.rc ) &
T7BP=$!

wait $GP $T3P $T4P $T5P $T7AP $T7BP
echo "ALL_DONE"
