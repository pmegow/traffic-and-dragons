// src/notation.js — dice notation ("2d6 + d20") to a dice list for roll().

import { DIE_TYPES } from './dice.js';

const TERM = /(\d*)\s*d\s*(\d+)/gi;

/** "2d6 + d20" → ['d6', 'd6', 'd20']. Anything that is not a term or a separator is refused. */
export function parseNotation(text) {
  const src = String(text || '');
  const leftover = src.replace(TERM, '').replace(/[\s+,]/g, '');
  if (leftover) throw new Error('parseNotation: cannot read "' + leftover + '" in "' + src + '" (write terms like 2d6 + d20)');
  const dice = [];
  for (const m of src.matchAll(TERM)) {
    const count = m[1] === '' ? 1 : parseInt(m[1], 10);
    const type = 'd' + parseInt(m[2], 10);
    if (!DIE_TYPES[type]) throw new Error('parseNotation: no ' + type + ' (known: ' + Object.keys(DIE_TYPES).join(', ') + ')');
    if (!(count >= 1)) throw new Error('parseNotation: "' + m[0] + '" rolls no dice');
    for (let i = 0; i < count; i++) dice.push(type);
  }
  if (!dice.length) throw new Error('parseNotation: no dice in "' + src + '"');
  return dice;
}
