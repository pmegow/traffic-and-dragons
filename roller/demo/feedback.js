import { VERSION } from '../src/version.js';

// TnD's public Google Apps Script receiver; its user-report envelope stores and emails both kinds.
export const REPORT_URL = 'https://script.google.com/macros/s/AKfycbzivwUvDUoEX6tFDnFy16DAj9gwehAkIaLv1XDSYcL-JChkeBEdt84eCvJJeuZv2lNvjQ/exec';
export const REPORT_TYPES = Object.freeze({ bug: 'Bug report', feature: 'Feature request' });
export const REPORT_LIMIT = 3800;
const SHOT_LIMIT = 1500000;
const DELIVERY_PARTS = { sheet: 'Report record', email: 'Email notification', screenshot: 'Screenshot storage' };

export function reportPayload({ type, text, context = '', screenshot = null, url, ua, online }) {
  if (!Object.prototype.hasOwnProperty.call(REPORT_TYPES, type)) throw Error('Choose a report type.');
  const description = String(text || '').trim();
  if (!description) throw Error('Please describe the bug or feature you would like.');
  if (description.length > REPORT_LIMIT) throw Error('Please keep the description under 3800 characters.');
  if (screenshot && (!/^data:image\/jpeg;base64,/.test(screenshot) || screenshot.length > SHOT_LIMIT)) {
    throw Error('The screenshot is too large or unreadable. Uncheck it to send a text-only report.');
  }
  const address = new URL(url);
  return {
    kind: 'user-report', app: 'Dice ' + VERSION,
    report: `[Dice ${REPORT_TYPES[type]}] ${description}`,
    context: 'Dice Simulator\n' + String(context).slice(0, 19000), screenshot,
    url: address.origin + address.pathname, ua, online, ts: new Date().toISOString()
  };
}

export async function sendReport(fields, { fetcher = globalThis.fetch, timeoutMs = 20000 } = {}) {
  const payload = reportPayload(fields), controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => { reject(Error('Delivery could not be confirmed: request timed out.')); controller.abort(); }, timeoutMs);
  });
  try {
    return await Promise.race([timeout, (async () => {
      // A plain string body avoids an OPTIONS preflight, which Apps Script cannot answer.
      const response = await fetcher(REPORT_URL, { method: 'POST', body: JSON.stringify(payload), signal: controller.signal });
      if (!response.ok) throw Error('Report service answered HTTP ' + response.status + '.');
      let body;
      try { body = JSON.parse(await response.text()); } catch { throw Error('The service did not confirm delivery.'); }
      if (!body || typeof body.ok !== 'boolean') throw Error('The service did not confirm delivery.');
      const warnings = Object.entries(DELIVERY_PARTS).filter(([key]) => body[key]).map(([key, label]) => label + ': ' + body[key]);
      const emailOnly = body.sheet && body.email === null;
      if ((body.ok === false && !emailOnly) || (body.sheet && body.email)) {
        throw Error(body.error || warnings.join('; ') || 'The service refused the report.');
      }
      return { warnings };
    })()]);
  } finally { clearTimeout(timer); }
}
