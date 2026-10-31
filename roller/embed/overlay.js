// embed/overlay.js — dice-sim inside a host page: dice rolled over the host's own content, their faces
// decided by the host (Traffic and Dragons: the GM's check and the attack's damage; owner 2026-10-25,
// "roll it into TnD").
//
//   const dice = createDiceOverlay({ container });     // once: the host's own element, over its content
//   await dice.present([{ type: 'd20' }]);            // the dice laid at rest along the bottom edge, ready to roll (2026-10-31)
//   const result = await dice.roll([{ type: 'd20', value: 17 }]);   // resolves when the dice rest; presented dice are thrown from where they lie
//   dice.setExit('smoke');                            // how they leave (render/exit-table.js; 'none' by default)
//   await dice.dismiss();                             // the host's dismiss (a click, say): they leave by it, heard
//   dice.clear();                                     // or at once, silently
//
// The container is the host's: it places, sizes, shows and hides it (a roll needs it visible and sized,
// since the screen's edges are the dice's walls — render/framing.js ▸ screenBounds). One view, one
// WebGL context and one sound engine for the overlay's whole life, however many rolls; dispose() ends
// them. A transparent view: no tray, only the dice and their shadows over whatever is behind.
//
// PRESENT (owner 2026-10-30, with TnD's check modal: "it would be cool if the die (dice) that will be rolled appeared at
// the bottom of the screen ready to roll"). present(dice) drops the dice onto a strip of floor along the bottom edge
// (embed/present.js ▸ edgeStrip; core drop, so they lie as a settled roll lies, on honest faces that promise nothing),
// silently, and lays them out at rest. They stay until a roll, a dismiss, a clear or another present takes them. A roll
// of the same die then lifts it into a hand (view.lift: toward the camera, so nothing moves on screen) and throws it up
// the screen toward the middle of the table as the app's tap throw goes from the bottom edge (edgeToss), tumbling. The
// face: a die thrown from the pose on screen keeps its printing — turning it would change the numerals on a die that has
// not moved — so the core lands the value asked by the throw itself, drawing the toss again until the physics shows it
// (src/roll.js ▸ AIMED THROWS: a `shown` state; about `sides` throws, measured in dev/aim-probe.js). Every frame is a
// real throw. ONE die is thrown so (present.js ▸ THROWN_FROM_REST): a handful thrown together meets in the air, and landing
// every die's face is then a search over them all at once — a handful is laid out all the same, and its roll comes in
// from the edge. A roll of other dice than those laid out, or with nothing laid out, is the roll as it always was, byte
// for byte.

import { DiceView, VIEW_DEFAULTS } from '../render/index.js';
import { DiceAudio } from '../audio/index.js';
import { samplePose } from '../src/index.js';
import { EXIT_TABLE } from '../render/exit-table.js';
import { edgeStrip, edgeFence, edgeToss, typesOf, sameDice, THROWN_FROM_REST } from './present.js';

const NO_SPIN = { x: 0, y: 0, z: 0 };

/** How long a roll waits for its sound (ms): the click bank loading, the browser unlocking audio. */
export const SOUND_WAIT_MS = { bank: 1500, unlock: 250 };

/** How long a roll waits for a vendored numeral font to load (ms), so the first roll is painted in it; painted sooner, the dice are repainted when it arrives. */
export const FONT_WAIT_MS = 1500;
/** How long a roll waits at most for the dice's pipeline (view.warmTable), readied as the overlay is made and for each look. */
export const WARM_WAIT_MS = 1500;

/** A promise's value, or false if it has not settled within ms. */
const soon = (promise, ms) => Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(false), ms))]);

/** How an overlay looks unless the host says otherwise: a steep view and a small stage, so the dice read big. */
export const OVERLAY_DEFAULTS = { tilt: 68, tray: { width: 0.15, depth: 0.10 } };

/**
 * container: the host's element (required). look: a die style {body, ink, finish, font}, or a bag of them to deal
 * each die one of ({ bag: [styles] }, render/die-looks.js: the mixed bag; DiceSim.presetStyle gives either) (default the
 * view's). sound: false for none. context: the host's own AudioContext, so the dice share its unlock
 * and its output. exit: how dismiss() takes the dice away (an EXIT_TABLE name; 'none', at once). tilt,
 * tray: the view's (OVERLAY_DEFAULTS).
 */
export function createDiceOverlay({ container, look = VIEW_DEFAULTS.dieStyle, sound = true, context = null, exit = 'none', tilt = OVERLAY_DEFAULTS.tilt, tray = OVERLAY_DEFAULTS.tray } = {}) {
  if (!container) throw new Error('createDiceOverlay: a container element is required');
  const view = new DiceView({ container, transparent: true, tilt, tray, dieStyle: look && look.bag ? look.bag[0] : look });
  if (look && look.bag) view.setDieBag(look).catch((e) => console.error('dice-sim: the mixed bag could not be put on the dice:', e));
  const audio = sound ? new DiceAudio({ context }) : null;
  const loading = audio ? audio.load().catch((e) => { console.warn('dice-sim: the dice sound is off: ' + e.message); return null; }) : Promise.resolve(null);
  let current = 0;   // the newest roll wins: an older one still playing is abandoned
  let laid = null;   // the dice presented and lying there, by type in order (present); null when the table is not a presentation
  const checkExit = (name) => {
    if (!EXIT_TABLE[name]) throw new Error('createDiceOverlay: no exit "' + name + '" (known: ' + Object.keys(EXIT_TABLE).join(', ') + ')');
    return name;
  };
  let leaveBy = checkExit(exit);
  // An exit compiles shaders the first time it plays (a burn's first frame stalled 6.9 s on glass, measured
  // 2026-10-25): they are readied while the dice rest, and for a new look — never in the middle of a dismiss.
  const warm = () => { view.warmTable(); if (leaveBy !== 'none') view.warmExits(); };
  // The look's own pipeline is readied as the overlay is made (a host makes it ahead of the first roll: the first die
  // drawn before it was built stalled 0.6 s in the air after a reload, 2026-10-28), and the exit's shaders with it.
  warm();
  // An exit's sounds (a spider's steps) play only once the sound is up: the bank loaded and the context running
  // (a step on a sleeping clock would wait for it and then sound with all the rest at once).
  const exitSound = (s) => { if (audio.buffer && audio.ctx && audio.ctx.state === 'running') audio.playExitSound(s.kind, { ...s, pan: 0.7 * s.pan }); };
  /** The moments a roll gives its sound, its font and its pipeline before the dice go (never longer): whether the sound is on. */
  const readied = async (unlocking) => {
    // Sound never holds the dice back. Outside a user gesture a browser leaves the AudioContext's resume() pending
    // until the next one, so waiting on it hung the roll (found in TnD's browser suite, 2026-10-25): a moment for
    // the unlock and the bank, then the dice go, silent if the sound is not ready.
    const withSound = (await soon(loading, SOUND_WAIT_MS.bank)) && (await soon(unlocking, SOUND_WAIT_MS.unlock));
    // The look's font too (a vendored one loads from a file): a moment, so the first roll is painted in it.
    await soon(view.readyFonts().catch(() => false), FONT_WAIT_MS);
    // And the dice's pipeline (warmTable): built as the overlay was made, or for the first roll after a look, now.
    await soon(view.warmTable(), WARM_WAIT_MS);
    return withSound;
  };
  const playWithSound = (result, withSound, fromTable = 0) => view.play(result, {
    fromTable,
    onStart: ({ timeScale }) => {
      if (withSound) audio.scheduleRoll(result, { timeScale, pan: (i, t) => 0.7 * view.panFor(samplePose(result, i, t).position) });
    },
  });

  return {
    view,
    audio,
    /**
     * Rolls dice = [{ type: 'd20', value: 17 }, …] (a value the die shows; leave it out for an honest
     * roll). Resolves with the roll's result when the dice rest, or null when a newer roll or clear()
     * took over. Call it from inside the user's gesture when you can: browsers start sound only there.
     * The one die present() laid out (the same type) is thrown from where it lies (PRESENT above); a handful laid
     * out, other dice, or none, roll in from the edge as always.
     */
    async roll(dice) {
      const mine = ++current;
      if (audio) audio.stop();
      const unlocking = audio ? audio.unlock().catch(() => false) : Promise.resolve(false);
      const fromRest = sameDice(laid, dice) && laid.length <= THROWN_FROM_REST;
      if (laid && laid.length && !sameDice(laid, dice)) console.warn('dice-sim: the dice rolled (' + typesOf(dice).join(', ') + ') are not the dice laid out (' + laid.join(', ') + '), so they roll in from the edge');
      laid = null;
      if (fromRest) return this.throwLaid(dice, mine, unlocking);
      view.resize();                 // the container is showing now: the screen's edges come from its size
      view.clear();
      const result = await view.bakeAsync({ dice });   // off the page (TODO row 3)
      const withSound = await readied(unlocking);
      if (mine !== current) return null;
      await playWithSound(result, withSound);
      if (mine === current) warm();
      return mine === current ? result : null;
    },
    /**
     * Lays dice = [{ type: 'd20' }, …] (strings or { type }; a value given here is ignored — the faces they rest on
     * promise nothing) at rest along the bottom edge of the overlay, silently, ready for roll(): dropped onto that
     * strip of floor (PRESENT above) in the current look, with no result highlighted. Resolves true when they are
     * placed, or null when a newer roll, present or clear() took over; a roll in progress is abandoned. They stay
     * until a roll, a dismiss, a clear or another present takes them. Refused by name for dice the core cannot roll.
     */
    async present(dice) {
      const mine = ++current;
      laid = null;
      if (audio) audio.stop();
      if (view.playing) view.playing.cancel();   // a roll under way is abandoned: the newest call wins, as with roll()
      view.resize();                 // the container is showing now: the strip lies along its bottom edge
      view.clear();
      const types = typesOf(dice), edges = view.screenEdges(), readUp = view.readUp;
      // Dropped onto the strip, fenced for the drop so they stay by the edge; the screen's edges stay their other walls.
      const result = await view.bakeAsync({ dice: types, throw: { drop: { resting: [] } }, tray: { area: edgeStrip(edges, readUp, types.length), bounds: [...edges.planes, edgeFence(edges, readUp)] } });
      await soon(view.readyFonts().catch(() => false), FONT_WAIT_MS);
      await soon(view.warmTable(), WARM_WAIT_MS);
      if (mine !== current) return null;
      view.show(result);
      laid = result.dice.map((d) => d.type);
      warm();
      return true;
    },
    /**
     * roll() of the die present() laid out: lifted into a hand (view.lift) and thrown from there toward the middle of
     * the table (edgeToss, tumbling), the throw itself landing the face asked (core AIMED THROWS: a `shown` state),
     * the mesh carrying on from where it lay. A roll the core cannot land (said by name on the console) rolls in from
     * the edge instead, as a roll with nothing laid out does.
     */
    async throwLaid(dice, mine, unlocking) {
      const { states: lifted, done } = view.lift();
      const velocities = edgeToss(lifted.map((s) => s.position), view.screenEdges(), view.readUp, view.cameraTarget);
      // Spun by nothing of the overlay's: the core tumbles each throw afresh (AIM.tumble) — spun only as a hand's toss
      // spins (render/hand.js ▸ tossSpin, a forward roll) a die reached a band of faces, and the search ran long.
      const states = lifted.map((s, i) => ({ ...s, velocity: { x: velocities[i].x, y: 0, z: velocities[i].z }, angularVelocity: NO_SPIN, shown: true }));
      let result;
      try {
        result = await view.bakeAsync({ dice, throw: { states } });
      } catch (e) {
        if (mine !== current) return null;
        console.warn('dice-sim: the presented dice could not be thrown from where they lie (' + e.message + '), so they roll in from the edge');
        view.clear();
        result = await view.bakeAsync({ dice });
        const withSound = await readied(unlocking);
        if (mine !== current) return null;
        await playWithSound(result, withSound);
        if (mine === current) warm();
        return mine === current ? result : null;
      }
      const withSound = await readied(unlocking);
      await done;
      if (mine !== current) return null;
      await playWithSound(result, withSound, states.length);
      if (mine === current) warm();
      return mine === current ? result : null;
    },
    /**
     * The host's dismiss: the dice leave by the overlay's exit (setExit), its sounds through the overlay's audio,
     * a roll in progress abandoned. Resolves when the last has gone — with 'none', at once (clear()). A roll may
     * start while they leave: the new dice come in as the old go.
     */
    dismiss() {
      if (leaveBy === 'none') { this.clear(); return Promise.resolve(); }
      current++;
      laid = null;
      if (audio) audio.stop();
      if (view.playing) view.playing.cancel();
      return view.clear({ exit: leaveBy, onSound: audio ? exitSound : null });
    },
    /** How dismiss() takes the dice away from now on (an EXIT_TABLE name); an unknown one is refused. */
    setExit(name) { leaveBy = checkExit(name); warm(); },
    get exit() { return leaveBy; },
    /** The dice present() laid out and still lying there, by type in order; null when the table is not a presentation. */
    get presented() { return laid ? laid.slice() : null; },
    /** Takes the dice away (presented or rolled) and stops their sound; a roll in progress resolves null. */
    clear() {
      current++;
      laid = null;
      if (audio) audio.stop();
      if (view.playing) view.playing.cancel();
      view.clear();
      view.render();
    },
    /** The dice's look for the next roll (and the dice now showing): a die style, or a bag ({ bag: [styles] }) to deal each die one of. */
    setLook(look) { return (look && look.bag ? view.setDieBag(look) : view.setDieStyle(look)).then(() => warm()); },
    setMuted(muted) { if (audio) audio.setMuted(muted); },
    /** Ends the overlay: its WebGL context and its sound engine go (the engine closes the audio context it made; one the host lent stays the host's). */
    dispose() {
      this.clear();
      if (audio) audio.dispose();
      view.dispose();
    },
  };
}
