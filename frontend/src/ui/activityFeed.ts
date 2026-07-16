// Salon aktivite şeridi: katılım/ayrılma ve oyun sonuçları sağ altta
// kısa süreliğine akar; bar kalabalık olmasa bile canlı hissettirir.

const MAX_ITEMS = 4;
const ITEM_LIFETIME_MS = 8000;

let feedEl: HTMLDivElement;

export function initActivityFeed(root: HTMLElement): void {
  feedEl = document.createElement('div');
  feedEl.className = 'activity-feed';
  root.appendChild(feedEl);
}

export function pushActivity(text: string, accent: 'win' | 'info' = 'info'): void {
  if (!feedEl) return;
  const item = document.createElement('div');
  item.className = `activity-feed__item activity-feed__item--${accent}`;
  item.textContent = text;
  feedEl.appendChild(item);

  while (feedEl.children.length > MAX_ITEMS) {
    feedEl.firstElementChild?.remove();
  }

  setTimeout(() => {
    item.classList.add('activity-feed__item--leaving');
    item.addEventListener('animationend', () => item.remove(), { once: true });
    setTimeout(() => item.remove(), 600); // animationend gelmezse güvence
  }, ITEM_LIFETIME_MS);
}
