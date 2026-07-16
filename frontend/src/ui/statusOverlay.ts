import type { ConnectionStatus } from '../net/socket.js';

let overlayEl: HTMLDivElement;
let textEl: HTMLDivElement;

export function initStatusOverlay(root: HTMLElement): void {
  overlayEl = document.createElement('div');
  overlayEl.className = 'status-overlay hidden';

  const logo = document.createElement('div');
  logo.className = 'neon-logo neon-logo--small';
  logo.innerHTML = '<span class="neon-logo__word neon-logo__word--cyan">PİKSEL</span> <span class="neon-logo__word neon-logo__word--pink">BAR</span>';
  overlayEl.appendChild(logo);

  const spinner = document.createElement('div');
  spinner.className = 'status-overlay__spinner';
  for (let i = 0; i < 3; i++) spinner.appendChild(document.createElement('span'));
  overlayEl.appendChild(spinner);

  textEl = document.createElement('div');
  textEl.className = 'status-overlay__text';
  overlayEl.appendChild(textEl);

  root.appendChild(overlayEl);
}

export function updateStatusOverlay(status: ConnectionStatus): void {
  if (status === 'open') {
    overlayEl.classList.add('hidden');
    return;
  }
  overlayEl.classList.remove('hidden');
  textEl.textContent = status === 'connecting' ? 'Bara bağlanılıyor...' : 'Bağlantı koptu, yeniden bağlanılıyor...';
}
