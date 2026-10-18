#!/usr/bin/env bash
# Prints one migration-card row (Markdown) for a component file.
# Usage: bash scripts/migration-card.sh src/components/ConfirmDialog.tsx
set -euo pipefail
f="${1:?usage: scripts/migration-card.sh <file.tsx>}"
PALETTE='\b(bg|text|border|ring)-(white|black|slate|gray|zinc|neutral|blue|red|green|amber|orange|yellow|purple|indigo)(-[0-9]{2,3})?\b'
count() { grep -cE "$1" "$f" || true; }
lines=$(wc -l < "$f" | tr -d ' ')
ui=$(count "from '@/components/ui/")
role=$(count 'role="dialog"')
modal=$(count 'aria-modal')
esc=$(count 'Escape')
owns=$(count 'data-esc-owns')
if [ -f "${f%.tsx}.test.tsx" ]; then test=yes; else test=no; fi
palette=$({ grep -oE "$PALETTE" "$f" || true; } | wc -l | tr -d ' ')
inline=$(count 'style=\{\{')
btn=$(count '\bbtn\b')
legacy=$(count 'sidebar-input|sidebar-token|info-box')
testids=$({ grep -oE 'data-testid="[^"]+"' "$f" || true; } | sort -u | tr '\n' ' ')
echo "| \`$f\` | lines=$lines | ui-imports=$ui | role=$role aria-modal=$modal | Escape=$esc | esc-owns=$owns | test=$test | palette=$palette | inline=$inline | btn=$btn legacy=$legacy | ${testids:-none} |"
