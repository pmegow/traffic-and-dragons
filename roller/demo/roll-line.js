// demo/roll-line.js — the roll written for the bottom of the view: each die, then the total at the end (owner
// 2026-10-26). Pure, so node tests it.
//   rollLine([{ type: 'd6', value: 3 }, { type: 'd20', value: 11 }]) → 'd6: 3 · d20: 11 = 14'
//   rollLine([{ type: 'd20', value: 17 }])                            → 'd20: 17'   (one die: its face is the total)
// A forced die carries a star, or "(forced)" when it is the only one. The spaces inside an entry and before the total are
// non-breaking: a long roll wraps between dice, never inside one ("d12:" / "10" on a phone).

const NB = '\u00a0';

/** The line for a list of { type, value, forced? } dice, in the order given ('' when empty). */
export function rollLine(dice) {
  if (!dice.length) return '';
  if (dice.length === 1) return dice[0].type + ':' + NB + dice[0].value + (dice[0].forced ? NB + '(forced)' : '');
  const total = dice.reduce((s, d) => s + d.value, 0);
  return dice.map((d) => d.type + ':' + NB + d.value + (d.forced ? '*' : '')).join(' · ') + NB + '=' + NB + total;
}
