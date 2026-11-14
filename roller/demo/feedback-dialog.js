import { REPORT_TYPES, REPORT_LIMIT, sendReport } from './feedback.js';
import { feedbackContext, captureTray } from './feedback-context.js';

export function showFeedback(opener) {
  if (document.getElementById('feedback-dialog')) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'feedback-dialog'; dialog.setAttribute('aria-labelledby', 'feedback-title');
  dialog.innerHTML = `
    <div class="feedback-heading"><h2 id="feedback-title">Report Bug / Feature Request</h2><button id="feedback-x" type="button" aria-label="Close report">&times;</button></div>
    <p class="feedback-help">Tell us what happened, or what you would like to see added.</p>
    <label>Report type<select id="feedback-type"></select></label>
    <label for="feedback-text">Description</label>
    <textarea id="feedback-text" rows="4" maxlength="${REPORT_LIMIT}" placeholder="For a bug, describe what you did, what happened, and what you expected."></textarea>
    <img id="feedback-shot" alt="Dice tray screenshot" hidden>
    <label class="check"><input id="feedback-shot-ok" type="checkbox" checked>Include the tray screenshot</label>
    <p id="feedback-capture-status" class="feedback-help" hidden></p>
    <p class="feedback-help">Uses TnD’s reporting service to email the developer. Includes your description, app version, browser, page address (without query parameters), viewport, current dice, settings, result and status. No saved files, API keys or account tokens are collected.</p>
    <p id="feedback-error" role="alert" hidden></p>
    <div class="feedback-actions"><button id="feedback-close" type="button">Cancel</button><button id="feedback-send" type="button">Send report</button></div>`;
  const el = id => dialog.querySelector('#feedback-' + id);
  for (const [value, label] of Object.entries(REPORT_TYPES)) el('type').add(new Option(label, value));
  let sending = false, screenshot = null, context = '';
  try { context = feedbackContext(); } catch (error) { context = 'Diagnostics unavailable: ' + error.message; console.warn('feedback:', error); }
  try { screenshot = captureTray(); el('shot').src = screenshot; el('shot').hidden = false; }
  catch (error) {
    console.warn('feedback screenshot:', error);
    el('shot-ok').checked = false; el('shot-ok').disabled = true;
    el('capture-status').hidden = false; el('capture-status').textContent = 'Screenshot unavailable: ' + error.message + ' You can still send a text-only report.';
  }
  const close = () => { if (!sending) dialog.close(); };
  el('x').addEventListener('click', close); el('close').addEventListener('click', close);
  dialog.addEventListener('cancel', e => { if (sending) e.preventDefault(); });
  dialog.addEventListener('close', () => { dialog.remove(); opener.focus(); }, { once: true });
  // The app's Enter/Space shortcuts must not roll dice from inside this modal.
  dialog.addEventListener('keydown', e => e.stopPropagation());
  el('send').addEventListener('click', async () => {
    if (sending) return;
    const text = el('text').value.trim();
    el('error').hidden = true;
    if (!text) { el('error').textContent = 'Please describe the bug or feature you would like.'; el('error').hidden = false; el('text').focus(); return; }
    sending = true;
    const controls = ['send', 'close', 'x', 'type', 'text'];
    controls.forEach(id => { el(id).disabled = true; }); el('shot-ok').disabled = true;
    el('send').textContent = 'Sending…';
    try {
      const result = await sendReport({ type: el('type').value, text, context, screenshot: el('shot-ok').checked ? screenshot : null,
        url: location.href, ua: navigator.userAgent, online: navigator.onLine });
      sending = false;
      if (result.warnings.length) {
        console.warn('feedback partial delivery:', result.warnings.join('; '));
        el('error').textContent = 'Your report was received, but some parts failed. ' + result.warnings.join('; ');
        el('error').hidden = false; el('send').hidden = true;
        el('close').disabled = false; el('x').disabled = false; el('close').textContent = 'Close'; el('close').focus();
      } else {
        document.getElementById('feedback-notice').textContent = 'Report sent — thank you.';
        console.info('feedback: report sent'); close();
      }
    } catch (error) {
      console.warn('feedback send failed:', error);
      sending = false; controls.forEach(id => { el(id).disabled = false; }); el('shot-ok').disabled = !screenshot;
      el('send').textContent = 'Send report';
      el('error').textContent = 'Send failed: ' + error.message + ' Your text is preserved; you can try again.'; el('error').hidden = false;
    }
  });
  document.body.append(dialog); dialog.showModal(); el('text').focus();
}
