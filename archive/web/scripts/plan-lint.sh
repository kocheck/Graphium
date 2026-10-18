#!/usr/bin/env bash
# scripts/plan-lint.sh <plan.md> — structural lint for executor plans (plans/CONVENTIONS.md §6).
# Exit 0 only when every "### Step" has all eight labelled fields, every **Check** names a
# mechanical condition on its first line, no forbidden phrase appears outside a prohibition, and
# no angle-quote placeholder (U+2039 / U+203A) remains from the first "### Step" onward.
set -u
file="${1:?usage: plan-lint.sh plans/NNN-*.md}"
fail=0
steps=$(grep -c '^### Step ' "$file")
for label in 'Files' 'Do' 'Do NOT' 'Commands' 'Expected' 'Check' 'If it fails' 'Commit'; do
  n=$(grep -c "^\*\*${label}\*\*:" "$file")
  if [ "$n" -ne "$steps" ]; then
    echo "FAIL: $n '**${label}**' lines for $steps steps"
    fail=1
  fi
done
if ! awk '/^\*\*Check\*\*:/ && $0 !~ /npm run|npx |grep |node |bash |test -f|Status: DECIDED|exits 0/ { print "FAIL: non-mechanical Check at line " NR ": " $0; bad=1 } END { exit bad }' "$file"; then
  fail=1
fi
forbidden='by e[y]e|manual[l]y|visual[l]y|Kyle conf[i]rms|see plan 0[0]' # plan-lint: own pattern
if grep -nE "$forbidden" "$file" | grep -vE "must not|never|Do NOT|no plan may|prohibit|plan-lint"; then
  echo "FAIL: forbidden phrase (above)"
  fail=1
fi
lt=$(printf '\342\200\271')
gt=$(printf '\342\200\272')
if ! awk -v lt="$lt" -v gt="$gt" '/^### Step /{inside=1} inside && (index($0, lt) || index($0, gt)) { print "FAIL: placeholder at line " NR ": " $0; bad=1 } END { exit bad }' "$file"; then
  fail=1
fi
[ "$fail" -eq 0 ] && echo "OK: $steps steps, all eight fields present"
exit "$fail"
