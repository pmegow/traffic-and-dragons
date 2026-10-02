#!/bin/sh
# usage: run4.sh probe.js  — runs a probe against BEFORE (wt-before), PARENT (commit^), AT (the commit), AFTER (wt-rev)
S="C:/Users/hannu/AppData/Local/Temp/claude/C--Projects-traffic-and-dragons/0b524b92-af76-49d1-b6c9-f6ca4673077c/scratchpad"
H="$S/review5/hero"
for t in "BEFORE=$S/wt-before" "PARENT=$H/snap-d6d1939c" "AT=$H/snap-8bf115e8" "AFTER=$S/wt-rev"; do
  n="${t%%=*}"; p="${t#*=}"
  echo "===== $n ($p)"
  node "$H/$1" "$p" 2>&1
done
