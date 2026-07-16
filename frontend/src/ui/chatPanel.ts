import { sendMessage } from '../net/socket.js';
import { CHAT_MAX_LENGTH, AVATAR_PALETTE } from '../config.js';
import { displayName, playerColor, type ChatEntry } from '../state/store.js';

let panelEl: HTMLDivElement;
let messagesEl: HTMLDivElement;
let inputEl: HTMLInputElement;
let titleEl: HTMLDivElement;
let restartBtn: HTMLButtonElement;

const KIND_TITLES: Record<string, string> = {
  rps: 'Taş-Kağıt-Makas',
  pong: 'Retro Pong',
  memory: 'Hafıza Kartı',
  chat: 'Sohbet Masası',
  reflex: 'Refleks Düellosu',
};

export function initChatPanel(root: HTMLElement): void {
  panelEl = document.createElement('div');
  panelEl.className = 'chat-panel hidden';

  const header = document.createElement('div');
  header.className = 'chat-panel__header';

  titleEl = document.createElement('div');
  titleEl.className = 'chat-panel__title';
  header.appendChild(titleEl);

  const btnRow = document.createElement('div');
  btnRow.className = 'chat-panel__actions';

  restartBtn = document.createElement('button');
  restartBtn.type = 'button';
  restartBtn.className = 'chat-panel__restart hidden';
  restartBtn.textContent = 'Yeniden Başla';
  restartBtn.addEventListener('click', () => {
    sendMessage({ type: 'game_restart', payload: {} });
  });
  btnRow.appendChild(restartBtn);

  const leaveBtn = document.createElement('button');
  leaveBtn.type = 'button';
  leaveBtn.className = 'chat-panel__leave';
  leaveBtn.textContent = 'Ayrıl';
  leaveBtn.addEventListener('click', () => {
    sendMessage({ type: 'room_leave', payload: {} });
  });
  btnRow.appendChild(leaveBtn);
  header.appendChild(btnRow);

  panelEl.appendChild(header);

  messagesEl = document.createElement('div');
  messagesEl.className = 'chat-panel__messages';
  panelEl.appendChild(messagesEl);

  const form = document.createElement('form');
  form.className = 'chat-panel__form';

  inputEl = document.createElement('input');
  inputEl.type = 'text';
  inputEl.maxLength = CHAT_MAX_LENGTH;
  inputEl.placeholder = 'Mesaj yaz...';
  inputEl.autocomplete = 'off';
  form.appendChild(inputEl);

  const sendBtn = document.createElement('button');
  sendBtn.type = 'submit';
  sendBtn.textContent = 'Gönder';
  form.appendChild(sendBtn);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = inputEl.value.trim();
    if (!text) return;
    sendMessage({ type: 'chat_send', payload: { text } });
    inputEl.value = '';
  });

  panelEl.appendChild(form);
  root.appendChild(panelEl);
}

export function showChatPanel(kind: string): void {
  titleEl.textContent = KIND_TITLES[kind] ?? 'Sohbet';
  messagesEl.innerHTML = '';
  panelEl.classList.remove('hidden');
}

export function hideChatPanel(): void {
  panelEl.classList.add('hidden');
  inputEl.value = '';
  setRestartVisible(false);
}

// Oyun bitince görünen "Yeniden Başla" butonu (hafıza + pong).
export function setRestartVisible(visible: boolean): void {
  restartBtn.classList.toggle('hidden', !visible);
}

export function addChatMessage(entry: ChatEntry, selfId: string | null): void {
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble' + (entry.from === selfId ? ' chat-bubble--self' : '');
  const who = document.createElement('span');
  who.className = 'chat-bubble__who';
  who.textContent = displayName(entry.from);
  const colorIdx = playerColor(entry.from);
  if (colorIdx !== null && AVATAR_PALETTE[colorIdx] !== undefined) {
    who.style.color = `#${AVATAR_PALETTE[colorIdx].toString(16).padStart(6, '0')}`;
  }
  const text = document.createElement('span');
  text.className = 'chat-bubble__text';
  text.textContent = entry.text;
  bubble.appendChild(who);
  bubble.appendChild(text);
  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
