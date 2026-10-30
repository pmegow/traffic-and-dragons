// render/bake-worker.js — the worker a roll is baked in (TODO row 3): a module worker made by render/baker.js. It answers
// each { id, request } with render/bake-job.js, the dice's tracks handed back rather than copied.

import { bakeJob } from './bake-job.js';

self.addEventListener('message', (e) => {
  const { message, transfer } = bakeJob(e.data);
  self.postMessage(message, transfer);
});
