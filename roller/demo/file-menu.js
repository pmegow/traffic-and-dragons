import { showFeedback } from './feedback-dialog.js';

export function bindFileMenu() {
  const button = document.getElementById('file-button'), menu = document.createElement('div');
  menu.id = 'file-menu'; menu.hidden = true; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-labelledby', 'file-button');
  const report = document.createElement('button');
  report.id = 'file-report'; report.type = 'button'; report.setAttribute('role', 'menuitem'); report.textContent = 'Report Bug / Feature Request';
  menu.append(report); document.body.append(menu);
  const close = (restore = false) => { menu.hidden = true; button.setAttribute('aria-expanded', 'false'); if (restore) button.focus(); };
  const open = () => {
    document.getElementById('feedback-notice').textContent = '';
    menu.hidden = false; button.setAttribute('aria-expanded', 'true');
    const box = button.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(box.right - menu.offsetWidth, innerWidth - menu.offsetWidth - 8)) + 'px';
    menu.style.top = Math.max(8, Math.min(box.bottom + 4, innerHeight - menu.offsetHeight - 8)) + 'px';
    report.focus();
  };
  button.addEventListener('click', () => menu.hidden ? open() : close(true));
  button.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); open(); } });
  menu.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); close(true); }
    if (e.key === 'Tab') close(true);
    if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) { e.preventDefault(); report.focus(); }
  });
  report.addEventListener('click', () => { close(); showFeedback(button); });
  document.addEventListener('pointerdown', e => { if (!menu.hidden && !menu.contains(e.target) && !button.contains(e.target)) close(); });
  document.getElementById('panel').addEventListener('scroll', () => close());
  window.addEventListener('resize', () => close());
}
