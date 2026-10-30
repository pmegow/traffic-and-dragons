// render/die-looks.js — which look each die wears (owner 2026-10-30: "add a 'mixed bag' preset that will randomly assign a
// preset to each die"; rulings: dealt once and kept, built-in and saved presets, the game too). Pure, node-tested.
//
// A LOOK is a bag of die styles ({ body, ink, finish, font }) to deal from: one style is a bag of one, so every die
// wears it; the mixed bag holds every preset's style, and each die is dealt one at random. A die keeps the style it
// was dealt — through rolls, drops, tosses and a cleared table, by its rank among the dice of its type (the wardrobe) —
// until the look changes.

import { presetProblem } from './presets.js';

/** The name the mixed bag goes by, in the toy's preset menu and in DiceSim.presets(). */
export const MIXED_BAG = 'Mixed bag';

/** The bag a look deals from: a style is a bag of one; `{ bag: [styles] }` is its own. Refused by name when empty or malformed. */
export function bagOf(look) {
  const bag = look && Array.isArray(look.bag) ? look.bag : [look];
  if (!bag.length) throw new Error('a look\'s bag holds no styles');
  bag.forEach((s, i) => {
    const problem = presetProblem({ name: 'style ' + i, ...s });
    if (problem) throw new Error('a look\'s ' + problem);
  });
  return bag;
}

/** One style from the bag, at random (`random` returns 0 ≤ x < 1). */
export function deal(bag, random = Math.random) {
  return bag[Math.min(bag.length - 1, Math.floor(random() * bag.length))];
}

/**
 * The style each die of a roll wears, from the WARDROBE (a Map: die type → the looks its 1st, 2nd, … die of that type
 * wear): the k-th die of a type in `types` wears the k-th look, dealt from `bag` — and kept in the wardrobe — the first
 * time there is a k-th one. So a die keeps its look whatever order a host rolls the dice in (the toy's Roll button
 * rolls them grouped by type) and when its table was cleared between rolls (the game's overlay clears its dice after
 * each), both of which dealt matched-against-the-table looks anew (2026-10-30). Fills `wardrobe` as it deals.
 */
export function looksFor(types, wardrobe, bag, random = Math.random) {
  const rank = new Map();
  return types.map((type) => {
    const k = rank.get(type) || 0;
    rank.set(type, k + 1);
    if (!wardrobe.has(type)) wardrobe.set(type, []);
    const looks = wardrobe.get(type);
    while (looks.length <= k) looks.push(deal(bag, random));
    return looks[k];
  });
}

/**
 * A die taken off the table steps aside: `types` the table's dice in play order, `i` the place of the one leaving. Its
 * look moves to the back of its type's looks, so the dice of its type after it keep theirs, and a die of that type put
 * back later wears it again. A die the wardrobe never dressed takes nothing away.
 */
export function retire(wardrobe, types, i) {
  const type = types[i], looks = wardrobe.get(type);
  if (!looks) return;
  const k = types.slice(0, i).filter((t) => t === type).length;
  if (k < looks.length) looks.push(...looks.splice(k, 1));
}

/** Every finish and font pair a bag can put on a die — what the view readies ahead, so no die waits to be drawn. */
export function pairsOf(bag) {
  const seen = new Map();
  for (const s of bag) seen.set(s.finish + '/' + s.font, { finish: s.finish, font: s.font, style: s });
  return [...seen.values()];
}
