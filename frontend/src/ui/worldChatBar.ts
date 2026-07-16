import { sendMessage } from '../net/socket.js';
import { CHAT_MAX_LENGTH } from '../config.js';
import { ICON_SEND } from './icons.js';

let barEl: HTMLDivElement;
let inputEl: HTMLInputElement;

export function initWorldChatBar(root: HTMLElement): void {
  barEl = document.createElement('div');
  barEl.className = 'world-chat-bar';

  const form = document.createElement('form');
  form.className = 'world-chat-bar__form';

  inputEl = document.createElement('input');
  inputEl.type = 'text';
  inputEl.maxLength = CHAT_MAX_LENGTH;
  inputEl.placeholder = 'Bir şeyler yaz...';
  inputEl.autocomplete = 'off';
  form.appendChild(inputEl);

  const sendBtn = document.createElement('button');
  sendBtn.type = 'submit';
  sendBtn.setAttribute('aria-label', 'Gönder');
  sendBtn.innerHTML = ICON_SEND;
  form.appendChild(sendBtn);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = inputEl.value.trim();
    if (!text) return;
    sendMessage({ type: 'world_chat_send', payload: { text } });
    inputEl.value = '';
    inputEl.blur();
  });

  barEl.appendChild(form);
  root.appendChild(barEl);
}

export function setWorldChatBarVisible(visible: boolean): void {
  barEl.classList.toggle('hidden', !visible);
}
