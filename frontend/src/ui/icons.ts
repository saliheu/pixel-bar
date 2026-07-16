// Tek renk, çizgi stili SVG ikon seti. Emoji yerine kullanılır;
// currentColor ile bulunduğu öğenin rengini alır.

function svg(inner: string, viewBox = '0 0 24 24'): string {
  return `<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

// ---- Emote ikonları ----
export const ICON_WAVE = svg(
  '<path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V11"/><path d="M10 10V5a1.5 1.5 0 0 1 3 0v5"/><path d="M13 10.5V6a1.5 1.5 0 0 1 3 0v6.5a5.5 5.5 0 0 1-5.5 5.5h-.6a5.5 5.5 0 0 1-4.5-2.3L3.6 12.9a1.4 1.4 0 0 1 2.2-1.7L7 12.8"/>',
);
export const ICON_LAUGH = svg(
  '<circle cx="12" cy="12" r="9"/><path d="M8 10l2-1M16 10l-2-1"/><path d="M7.5 13.5a4.8 4.8 0 0 0 9 0z" fill="currentColor" stroke="none"/>',
);
export const ICON_HEART = svg(
  '<path d="M12 20C8.5 17.6 3.9 14 3.1 10.4 2.5 7.4 4.6 4.9 7.3 4.9c1.9 0 3.6 1.1 4.7 2.9 1.1-1.8 2.8-2.9 4.7-2.9 2.7 0 4.8 2.5 4.2 5.5C20.1 14 15.5 17.6 12 20z"/>',
);
export const ICON_PARTY = svg(
  '<path d="M5 21l4-11 6 6z"/><path d="M13 9.5l1.5-1.5M16 12.5l2-.5M14.5 5.5l.5-2M18.5 8.5l2-2"/><circle cx="19" cy="4" r="0.8" fill="currentColor" stroke="none"/><circle cx="21" cy="11" r="0.8" fill="currentColor" stroke="none"/>',
);
export const ICON_SURPRISE = svg(
  '<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="15" r="2"/>',
);
export const ICON_DANCE = svg(
  '<circle cx="13" cy="4.5" r="2"/><path d="M13 7l-2 5 1 7"/><path d="M11 12l4 2 1 5"/><path d="M13 8.5l4-2 3 1"/><path d="M11.5 9L7 8 5 10"/>',
);

// ---- Taş / Kağıt / Makas ----
export const ICON_ROCK = svg(
  '<path d="M6 14l1.5-6a2 2 0 0 1 2-1.5h5a2 2 0 0 1 2 1.6L18 14a6 6 0 0 1-12 0z" />',
);
export const ICON_PAPER = svg(
  '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M9.5 12h5M9.5 15.5h5"/>',
);
export const ICON_SCISSORS = svg(
  '<circle cx="6.5" cy="7" r="2.5"/><circle cx="6.5" cy="17" r="2.5"/><path d="M8.7 8.4L20 19M8.7 15.6L20 5"/>',
);

// ---- Hafıza kartı şekilleri: 8 ayırt edici sembol, kendi renkleriyle ----
function shape(inner: string, color: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}
export const MEMORY_SHAPES = [
  shape('<circle cx="12" cy="12" r="7" fill="#38bdf8" fill-opacity="0.25"/>', '#38bdf8'),
  shape('<rect x="6" y="6" width="12" height="12" rx="2" fill="#f472b6" fill-opacity="0.25"/>', '#f472b6'),
  shape('<path d="M12 5l8 14H4z" fill="#fbbf24" fill-opacity="0.25"/>', '#fbbf24'),
  shape('<path d="M12 4l7 8-7 8-7-8z" fill="#4ade80" fill-opacity="0.25"/>', '#4ade80'),
  shape('<path d="M12 4l2.4 4.8 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8z" fill="#b39ddb" fill-opacity="0.3"/>', '#b39ddb'),
  shape('<path d="M12 4l6.9 4v8L12 20l-6.9-4V8z" fill="#ff8a80" fill-opacity="0.25"/>', '#ff8a80'),
  shape('<path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5z" fill="#80cbc4" fill-opacity="0.25"/>', '#80cbc4'),
  shape('<path d="M17 14.5A7 7 0 1 1 9.5 7a5.5 5.5 0 0 0 7.5 7.5z" fill="#fde047" fill-opacity="0.25"/>', '#fde047'),
];
// kapalı kart yüzü: kokteyl bardağı
export const ICON_COCKTAIL = svg('<path d="M5 4h14l-7 8z"/><path d="M12 12v6M8.5 20h7"/><path d="M15.5 4l1.5-2"/>');

// ---- HUD ----
export const ICON_DOOR = svg('<rect x="5" y="3" width="11" height="18" rx="1.5"/><circle cx="13" cy="12" r="1" fill="currentColor" stroke="none"/><path d="M16 7h3v14h-3"/>');
export const ICON_NOTE = svg('<path d="M9 18V6l10-2v11"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="15" r="2.5"/>');
export const ICON_SOUND_ON = svg('<path d="M4 10v4h3l5 4V6l-5 4z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>');
export const ICON_SOUND_OFF = svg('<path d="M4 10v4h3l5 4V6l-5 4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>');

// ---- Şapkalar (giriş ekranı seçimi) ----
export const HAT_ICONS = [
  svg('<circle cx="12" cy="12" r="8" stroke-dasharray="2.5 3.5"/>'), // yok
  svg('<path d="M5 13a7 7 0 0 1 14 0v1H5z"/><path d="M12 6V4.5"/><path d="M19 14h2.5"/>'), // kasket
  svg('<path d="M5 17l-1-8 4.5 3L12 6l3.5 6L20 9l-1 8z"/><circle cx="12" cy="4.5" r="0.9" fill="currentColor" stroke="none"/>'), // taç
  svg('<path d="M6 12l-1.5-7L11 9M18 12l1.5-7L13 9"/><path d="M6 12a6 6 0 0 1 12 0"/>'), // kedi kulağı
  svg('<path d="M12 3l5 14H7z"/><circle cx="12" cy="3" r="1.2" fill="currentColor" stroke="none"/><path d="M9.5 10h5M8.3 14h7.4"/>'), // parti konisi
];

// ---- Diğer ----
export const ICON_CHAT = svg('<path d="M4 5h16v11H9l-4 4V5z"/><path d="M8.5 9.5h7M8.5 12h4.5"/>');
export const ICON_GAMEPAD = svg('<rect x="3" y="8" width="18" height="9" rx="4.5"/><path d="M8 11v3M6.5 12.5h3"/><circle cx="15.5" cy="11.5" r="0.9" fill="currentColor" stroke="none"/><circle cx="17.8" cy="13.3" r="0.9" fill="currentColor" stroke="none"/>');
export const ICON_SEND = svg('<path d="M4 12h13M13 6l6 6-6 6"/>');
export const ICON_MONITOR = svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/>');
export const ICON_TROPHY = svg('<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 5H5a3 3 0 0 0 3 4M16 5h3a3 3 0 0 1-3 4"/><path d="M12 13v4M8.5 20h7M10 17h4"/>');
export const ICON_MOON = svg('<path d="M17 14.5A7 7 0 1 1 9.5 7a5.5 5.5 0 0 0 7.5 7.5z"/>');
export const ICON_STAR = svg('<path d="M12 4l2.4 4.8 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8z"/>');
