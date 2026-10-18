#!/usr/bin/env bash
# Fault checks for campaign saving (docs/SAVE_CHECKS.md). Drives graphium-mcp against
# throwaway campaigns and fails if a write is lost or a campaign.json is left half-written:
#   1. several servers adding tokens to one campaign at once
#   2. the server killed (-9) at random points while it saves
#   3. a full disk
# Run on a Mac from macos/:  bash scripts/save-fault-checks.sh [path/to/graphium-mcp]
# CI runs it too (.github/workflows/macos-native.yml). Needs jq and hdiutil.
set -euo pipefail
cd "$(dirname "$0")/.."

BIN="${1:-}"
if [ -z "$BIN" ]; then
  swift build -c release --product graphium-mcp >/dev/null
  BIN="$(swift build -c release --product graphium-mcp --show-bin-path)/graphium-mcp"
fi
WORK="$(mktemp -d)"
DISK=""
cleanup() {
  if [ -n "$DISK" ]; then hdiutil detach -quiet -force "$DISK" || true; fi
  rm -rf "$WORK"
}
trap cleanup EXIT
fail() { echo "FAIL: $*" >&2; exit 1; }

# An MCP session: initialize, then `count` add_tokens calls on `campaign`, or `tool` alone.
session() {
  local campaign="$1" count="$2" label="$3"
  printf '%s\n' \
    '{"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"save-fault-checks","version":"1"}}}' \
    '{"jsonrpc":"2.0","method":"notifications/initialized"}'
  for i in $(seq 1 "$count"); do
    printf '{"jsonrpc":"2.0","id":%d,"method":"tools/call","params":{"name":"add_tokens","arguments":{"campaign":"%s","tokens":[{"name":"%s %d","position":[1,1]}]}}}\n' \
      "$i" "$campaign" "$label" "$i"
  done
}
call() {
  local root="$1" name="$2" arguments="$3"
  printf '%s\n' \
    '{"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"save-fault-checks","version":"1"}}}' \
    "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"$name\",\"arguments\":$arguments}}" \
    | "$BIN" --root "$root" 2>/dev/null | jq -c 'select(.id == 1)'
}
tokens() { jq '[.campaign.maps[].tokens[]] | length' "$1/campaign.json"; }
successes() { cat "$@" | jq -s '[.[] | select(.id != 0 and .result.isError == false)] | length'; }
failures() { cat "$@" | jq -s '[.[] | select(.id != 0 and .result.isError == true)] | length'; }

# 1. Concurrent writers: every call that reported success must be in the file.
ROOT="$WORK/race" && mkdir -p "$ROOT"
call "$ROOT" create_campaign '{"path":"Race","name":"Race"}' | jq -e '.result.isError == false' >/dev/null || fail "create_campaign"
for n in 1 2 3 4; do
  session Race 25 "writer $n" | "$BIN" --root "$ROOT" >"$WORK/race-$n.jsonl" 2>/dev/null &
done
wait
ok=$(successes "$WORK"/race-*.jsonl)
errors=$(failures "$WORK"/race-*.jsonl)
saved=$(tokens "$ROOT/Race.graphiumcampaign")
[ "$saved" -eq "$ok" ] || fail "concurrent writers: $ok calls succeeded but the file holds $saved tokens"
if [ "$errors" -gt 0 ]; then
  cat "$WORK"/race-*.jsonl | jq -r 'select(.result.isError == true) | .result.content[0].text' | grep -qv "kept changing" \
    && fail "concurrent writers: a call failed for a reason other than the file changing"
fi
echo "ok   concurrent writers: $ok calls saved, $errors gave up cleanly, none lost"

# 2. Killed mid-save: campaign.json always parses and opens.
ROOT="$WORK/kill" && mkdir -p "$ROOT"
call "$ROOT" create_campaign '{"path":"Kill","name":"Kill"}' >/dev/null
for round in $(seq 1 20); do
  session Kill 400 "round $round" | "$BIN" --root "$ROOT" >/dev/null 2>&1 &
  pid=$!
  sleep "0.$(( (RANDOM % 9) + 1 ))"
  kill -9 "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  jq -e . "$ROOT/Kill.graphiumcampaign/campaign.json" >/dev/null || fail "kill round $round left campaign.json unreadable"
  call "$ROOT" get_campaign '{"campaign":"Kill"}' | jq -e '.result.isError == false' >/dev/null \
    || fail "kill round $round: get_campaign failed"
done
echo "ok   killed mid-save 20 times: campaign.json always whole ($(tokens "$ROOT/Kill.graphiumcampaign") tokens)"

# 3. Full disk: failed saves leave the last good file, and saving works again once there's room.
DISK="$WORK/small"
hdiutil create -quiet -size 8m -fs HFS+ -volname GraphiumFull "$WORK/small.dmg"
hdiutil attach -quiet -nobrowse -mountpoint "$DISK" "$WORK/small.dmg"
ROOT="$DISK"
call "$ROOT" create_campaign '{"path":"Full","name":"Full"}' | jq -e '.result.isError == false' >/dev/null || fail "create on small disk"
before=$(tokens "$ROOT/Full.graphiumcampaign")
dd if=/dev/zero of="$DISK/filler" bs=4096 2>/dev/null || true
session Full 10 "full" | "$BIN" --root "$ROOT" >"$WORK/full.jsonl" 2>/dev/null
ok=$(successes "$WORK/full.jsonl")
jq -e . "$ROOT/Full.graphiumcampaign/campaign.json" >/dev/null || fail "full disk left campaign.json unreadable"
after=$(tokens "$ROOT/Full.graphiumcampaign")
[ "$after" -eq $((before + ok)) ] || fail "full disk: $ok calls succeeded but tokens went $before → $after"
rm -f "$DISK/filler"
call "$ROOT" add_tokens '{"campaign":"Full","tokens":[{"name":"after","position":[1,1]}]}' \
  | jq -e '.result.isError == false' >/dev/null || fail "saving didn't recover after freeing space"
echo "ok   full disk: $((10 - ok)) saves refused, file intact, saving recovered"
