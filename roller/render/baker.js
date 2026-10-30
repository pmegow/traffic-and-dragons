// render/baker.js — where a roll is baked (TODO row 3, owner 2026-10-30: "Build 3"): in a Web Worker
// (render/bake-worker.js), so a big roll never stalls the page's frames, or — when no worker can be had — on the page.
// Pure apart from the worker it is given, so node tests it with a fake one.
//
//   const baker = createBaker();
//   const result = await baker.roll(request);   // a full roll() request; resolves with its RollResult, rejects with a refusal
//   baker.mode                                  // 'worker', or 'page' once a worker could not be had
//
// A browser that cannot make a module worker (Firefox 108-113, inside the toy's floor) throws as it is made or fails as
// it loads: the rolls are then baked on the page — any already sent too — and it is said once, with the reason (never
// silently). A worker is made at the first roll.

import { roll as rollOnPage } from '../src/roll.js';

/** A module worker running render/bake-worker.js. */
export function bakeWorker() {
  return new Worker(new URL('./bake-worker.js', import.meta.url), { type: 'module' });
}

export function createBaker({ makeWorker = bakeWorker, inline = rollOnPage, warn = (m) => console.warn(m) } = {}) {
  let worker = null, mode = 'worker', next = 0;
  const pending = new Map();   // id → { request, resolve, reject }
  const onPage = (request) => new Promise((resolve, reject) => {
    try { resolve(inline(request)); } catch (e) { reject(e); }
  });
  const giveUp = (reason) => {
    if (mode === 'page') return;
    mode = 'page';
    warn('dice-sim: rolls are baked on the page, not in a worker (' + reason + '): a big roll may hold a frame');
    if (worker) { try { worker.terminate(); } catch { /* gone already */ } }
    worker = null;
    const sent = [...pending.values()];
    pending.clear();
    for (const job of sent) onPage(job.request).then(job.resolve, job.reject);
  };
  const ensure = () => {
    if (worker || mode === 'page') return;
    try {
      worker = makeWorker();
    } catch (e) {
      giveUp((e && e.message) || String(e));
      return;
    }
    worker.addEventListener('message', (e) => {
      const job = pending.get(e.data.id);
      if (!job) return;
      pending.delete(e.data.id);
      if (e.data.error !== undefined) job.reject(new Error(e.data.error));
      else job.resolve(e.data.result);
    });
    worker.addEventListener('error', (e) => giveUp((e && e.message) || 'the worker failed to load'));
  };
  return {
    get mode() { return mode; },
    /** Ends the worker; a roll still in it is refused (the view it was for is gone). */
    close() {
      if (worker) { try { worker.terminate(); } catch { /* gone already */ } }
      worker = null;
      mode = 'page';
      for (const job of pending.values()) job.reject(new Error('the baker was closed'));
      pending.clear();
    },
    roll(request) {
      ensure();
      if (mode === 'page') return onPage(request);
      const id = ++next;
      return new Promise((resolve, reject) => {
        pending.set(id, { request, resolve, reject });
        worker.postMessage({ id, request });
      });
    },
  };
}
