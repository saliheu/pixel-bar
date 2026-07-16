let containerEl: HTMLDivElement;

const TOAST_DURATION_MS = 4000;

export function initToasts(root: HTMLElement): void {
  containerEl = document.createElement('div');
  containerEl.className = 'toast-container';
  root.appendChild(containerEl);
}

export function showToast(message: string, kind: 'error' | 'info' = 'info'): void {
  if (!containerEl) return;
  const toast = document.createElement('div');
  toast.className = `toast toast--${kind}`;
  toast.textContent = message;
  containerEl.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast--leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), 600); // animationend gelmezse güvence
  }, TOAST_DURATION_MS);
}
