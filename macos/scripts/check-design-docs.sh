#!/usr/bin/env bash
# Keeps the design harness small enough to load card by card: byte budgets for
# macos/design/harness/, every rule card listed in its INDEX.md with an id matching its
# filename, and generated colour tokens in sync with DESIGN.md.
# Adapted from Project Icarus scripts/check-doc-size.sh.
# Usage: macos/scripts/check-design-docs.sh   (exit 1 on violation)

set -eu
cd "$(dirname "$0")/.." || exit 1

fail=0
HARNESS=design/harness
while IFS= read -r f; do
  size=$(wc -c <"$f" | tr -d ' ')
  case "$f" in
    "$HARNESS/INDEX.md") limit=2500 ;;
    "$HARNESS/taste/principles.md") limit=4000 ;;
    "$HARNESS/taste/examples/"*) limit=6000 ;;
    *) limit=3000 ;;
  esac
  if [ "$size" -gt "$limit" ]; then
    echo "over budget: $f is $size bytes (limit $limit). Split the card or link out detail." >&2
    fail=1
  fi
done < <(find "$HARNESS" -name '*.md' | sort)

for f in docs/design/DESIGN.md docs/design/voice.md; do
  size=$(wc -c <"$f" | tr -d ' ')
  if [ "$size" -gt 20000 ]; then
    echo "over budget: $f is $size bytes (limit 20000)." >&2
    fail=1
  fi
done

while IFS= read -r f; do
  # Contract: INDEX links each card exactly as "(rules/<file>.md)", with no anchor.
  grep -qF "(rules/$(basename "$f"))" "$HARNESS/INDEX.md" || {
    echo "not in index: $f is missing from $HARNESS/INDEX.md" >&2
    fail=1
  }
  fm_id=$(awk 'NR==1 && !/^---[[:space:]]*$/ {exit} NR>1 && /^---[[:space:]]*$/ {exit}
    /^id:/ {sub(/^id:[[:space:]]*/, ""); sub(/[[:space:]]+$/, ""); print; exit}' "$f")
  [ "$fm_id" = "$(basename "$f" .md)" ] || {
    echo "id mismatch: $f needs front matter 'id: $(basename "$f" .md)'" >&2
    fail=1
  }
done < <(find "$HARNESS/rules" -name '*.md' | sort)

python3 scripts/design-tokens.py --check >/dev/null || fail=1

[ "$fail" -eq 0 ] && echo "design docs ok"
exit "$fail"
