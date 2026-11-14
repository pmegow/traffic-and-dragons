// Read only the diagnostics disclosed in the dialog; never enumerate storage or account state.
export function feedbackContext() {
  const view = window.__dice?.view;
  const value = id => document.getElementById(id)?.value || '';
  return JSON.stringify({
    viewport: { width: innerWidth, height: innerHeight, pixelRatio: devicePixelRatio },
    dice: view?.dice.map(d => d.die.type) || [],
    look: view?.o.dieStyle || null, tabletop: view?.tableStyle || null,
    controls: { preset: value('preset'), exit: value('exit'), speed: document.getElementById('speed-out')?.textContent || '', tray: view?.tray || null, sound: !!document.getElementById('sound')?.checked },
    result: document.getElementById('result')?.textContent || '',
    status: document.getElementById('status')?.textContent || '',
    graphics: view ? { contextLost: view.renderer.getContext().isContextLost() } : 'unavailable'
  }, null, 2);
}

export function captureTray() {
  const view = window.__dice?.view;
  if (!view || view.renderer.getContext().isContextLost()) throw Error('The 3D view is unavailable.');
  // WebGL clears its drawing buffer after compositing. Copy immediately after an explicit render.
  view.render();
  const source = view.renderer.domElement, scale = Math.min(1, 1200 / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * scale)); canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0f1115'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const screenshot = canvas.toDataURL('image/jpeg', 0.7);
  if (screenshot.length > 1500000) throw Error('The tray screenshot is too large.');
  return screenshot;
}
