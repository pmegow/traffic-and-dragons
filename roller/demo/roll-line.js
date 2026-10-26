// demo/roll-line.js — the roll written for the bottom of the view: each die, then the total at the end, in bold (owner
// 2026-10-26). Pure, so node tests it; the toy paints the total as a <b> between the two texts.
//   rollParts([{ type: 'd6', value: 3 }, { type: 'd20', value: 11 }]) → { lead: 'd6: 3 · d20: 11 = ', total: '14', tail: '' }
//   rollParts([{ type: 'd20', value: 17 }])                            → { lead: 'd20: ', total: '17', tail: '' }   (one die: its face is the total)
// A forced die carries a star, or "(forced)" after the total when it is the only one. The spaces inside an entry and
// before the total are non-breaking: a long roll wraps between dice, never inside one ("d12:" / "10" on a phone).

const NB = '\u00a0';

/** The line for a list of { type, value, forced? } dice, in the order given, as the text before the total, the total and
 *  the text after it (null when there are no dice). */
export function rollParts(dice) {
  if (!dice.length) return null;
  if (dice.length === 1) return { lead: dice[0].type + ':' + NB, total: String(dice[0].value), tail: dice[0].forced ? NB + '(forced)' : '' };
  const total = dice.reduce((s, d) => s + d.value, 0);
  return { lead: dice.map((d) => d.type + ':' + NB + d.value + (d.forced ? '*' : '')).join(' · ') + NB + '=' + NB, total: String(total), tail: '' };
}
