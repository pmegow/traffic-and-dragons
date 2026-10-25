// demo/dice-picker.js — the dice in the toy's next roll, chosen only with the die buttons (owner 2026-10-25: "get rid of
// [the Dice field] as an input ... rely completely on the dice adding buttons ... simplify input while enforcing
// compliance"). A die button adds one, its minus takes one back, × clears; the read-only line shows the roll in grouped
// notation ("2d6 + d20"). Nothing typed, so nothing to misread: every roll is dice the core knows, within its limit.
//
// Pure: counts per die type, in the die types' own order, the total held to `max` (the core's MAX_DICE). Node tests it.
//
//   const p = createDicePicker({ types: dieTypes(), max: MAX_DICE, counts: { d6: 2, d20: 1 } });
//   p.add('d8')       → true, or false when the roll is full
//   p.remove('d6')    → true, or false when there is none to take
//   p.list()          → ['d6', 'd6', 'd8', 'd20']   (what roll() takes)
//   p.notation()      → '2d6 + d8 + d20'             ('' when empty)

export function createDicePicker({ types, max, counts = {} } = {}) {
  if (!Array.isArray(types) || !types.length) throw new Error('createDicePicker: types must be a non-empty list of die types');
  if (!(Number.isInteger(max) && max > 0)) throw new Error('createDicePicker: max must be a positive whole number, got ' + max);
  const n = Object.fromEntries(types.map((t) => [t, 0]));
  let total = 0;
  // Counts from storage are taken as far as they are good: known dice, whole numbers, and no more than max in all.
  for (const t of types) {
    const c = counts && counts[t];
    if (Number.isInteger(c) && c > 0) { const take = Math.min(c, max - total); n[t] = take; total += take; }
  }
  const known = (t) => { if (!(t in n)) throw new Error('dice picker: no die "' + t + '" (known: ' + types.join(', ') + ')'); };
  return {
    get total() { return total; },
    get full() { return total >= max; },
    get max() { return max; },
    count(t) { known(t); return n[t]; },
    counts() { return { ...n }; },
    add(t) { known(t); if (total >= max) return false; n[t]++; total++; return true; },
    remove(t) { known(t); if (!n[t]) return false; n[t]--; total--; return true; },
    clear() { for (const t of types) n[t] = 0; total = 0; },
    list() { return types.flatMap((t) => Array(n[t]).fill(t)); },
    notation() { return types.filter((t) => n[t]).map((t) => (n[t] > 1 ? n[t] : '') + t).join(' + '); },
  };
}
