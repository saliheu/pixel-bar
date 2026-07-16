import { players } from '../state/players.js';
import { NAME_MIN_LENGTH, NAME_MAX_LENGTH } from '../config.js';

const ADJECTIVES = [
  'Sessiz', 'Hızlı', 'Gizli', 'Neşeli', 'Yorgun', 'Meraklı', 'Uykulu', 'Cesur',
  'Sakin', 'Yaramaz', 'Bilge', 'Şanslı', 'Gölge', 'Parlak', 'Vahşi', 'Nazik',
];

const NOUNS = [
  'Kedi', 'Baykuş', 'Panda', 'Tilki', 'Ejderha', 'Kurt', 'Tavşan', 'Ayı',
  'Balina', 'Kaplan', 'Yunus', 'Şahin', 'Geyik', 'Kartal', 'Aslan', 'Fil',
];

export function generateAnonId(): string {
  let name: string;
  do {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const num = Math.floor(Math.random() * 100);
    name = `${adj}${noun}${num}`;
  } while (isNameTaken(name));
  return name;
}

function isNameTaken(name: string): boolean {
  const lower = name.toLowerCase();
  for (const p of players.values()) {
    if (p.id.toLowerCase() === lower || p.name.toLowerCase() === lower) return true;
  }
  return false;
}

// Kontrol ve görünmez karakterleri (C0/C1, zero-width, yön işaretleri) ayıklar.
function sanitizeControlChars(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) continue;
    if (code >= 0x200b && code <= 0x200f) continue;
    if (code === 0x2028 || code === 0x2029 || code === 0xfeff) continue;
    out += ch;
  }
  return out;
}

// Kullanıcının istediği ismi temizler ve benzersizleştirir.
// Geçersizse (çok kısa / boş) null döner; çağıran generateAnonId'ye düşer.
export function resolveDisplayName(requested: string | null): string | null {
  if (!requested) return null;
  // kontrol karakterleri ve fazla boşluklar temizlenir
  const cleaned = sanitizeControlChars(requested)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX_LENGTH);
  if (cleaned.length < NAME_MIN_LENGTH) return null;
  if (!isNameTaken(cleaned)) return cleaned;
  for (let n = 2; n < 100; n++) {
    const candidate = `${cleaned.slice(0, NAME_MAX_LENGTH - String(n).length - 1)}#${n}`;
    if (!isNameTaken(candidate)) return candidate;
  }
  return null;
}