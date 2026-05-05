
// ═══════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════
const AI_LIST   = ['Claude','Gemini','GPT-4o','Grok'];
const INITIALS  = { You:'You', Claude:'Cl', Gemini:'Ge', 'GPT-4o':'GP', Grok:'Gr' };
const TIMEOUT   = 30000;

const SYSTEM = {
  Claude:  `You are Claude (Anthropic) in a live multi-AI council discussion with Gemini, GPT-4o, and Grok. A human has sent a message and each AI responds in turn — you can see what the others said before you. Be direct, add genuine value, build on or challenge what came before. Conversational length, not essay.`,
  Gemini:  `You are Gemini (Google DeepMind) in a live multi-AI council with Claude, GPT-4o, and Grok. Respond to the human's message. You can see prior AI responses in this round — engage with them. Be analytical and clear. Keep it conversational.`,
  'GPT-4o':`You are GPT-4o (OpenAI) in a live multi-AI council with Claude, Gemini, and Grok. The human sent a message and other AIs may have already responded. Read the thread and add something genuinely useful — agree, challenge, extend. Conversational, not verbose.`,
  Grok:    `You are Grok (xAI) in a live multi-AI council with Claude, Gemini, and GPT-4o. The human asked something. You see what others said. Be sharp and direct — don't repeat, don't pad. If something's wrong or missing, say so.`
};

// ═══════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════
const apiKeys   = { Claude:'', Gemini:'', 'GPT-4o':'', Grok:'' };
let thread      = [];     // { ai, text, role, ts }
let roundNum    = 0;
let roundActive = false;
let stopFlag    = false;
let msgCount    = 0;
let typingEl    = null;

// ── Session / History ──────────────────────────────────
// Each session: { id, title, ts, thread }
// Stored in IndexedDB. Keys sorted descending by ts.
const DB_NAME  = 'gnoke:council-auto';
const DB_STORE = 'sessions';
let _db        = null;
let currentSessionId = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = e => e.target.result.createObjectStore(DB_STORE, { keyPath: 'id' });
    r.onsuccess = e => { _db = e.target.result; res(_db); };
    r.onerror   = e => rej(e.target.error);
  });
}

async function dbPut(record) {
  try {
    const db = await openDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).put(record);
      tx.onsuccess = () => res(); tx.onerror = e => rej(e.target.error);
    });
  } catch(_) {}
}

async function dbGetAll() {
  try {
    const db = await openDB();
    return await new Promise((res, rej) => {
      const tx = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).getAll();
      tx.onsuccess = e => res(e.target.result); tx.onerror = e => rej(e.target.error);
    });
  } catch(_) { return []; }
}

async function dbDelete(id) {
  try {
    const db = await openDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).delete(id);
      tx.onsuccess = () => res(); tx.onerror = e => rej(e.target.error);
    });
  } catch(_) {}
}

// ── Persist current session ────────────────────────────
async function saveSession() {
  if (!thread.length) return;
  const title = thread.find(m => m.ai === 'You')?.text?.slice(0, 55) || 'Untitled';
  const record = { id: currentSessionId, title, ts: Date.now(), thread: JSON.parse(JSON.stringify(thread)) };
  await dbPut(record);
  renderSidebar();
}

// ── Render sidebar from DB ─────────────────────────────
async function renderSidebar() {
  const all = await dbGetAll();
  all.sort((a, b) => b.ts - a.ts);
  const list = document.getElementById('chatList');
  list.innerHTML = '';
  if (!all.length) {
    list.innerHTML = '<div style="padding:10px 14px;font-size:11px;color:var(--muted2);font-family:var(--mono);">No saved sessions yet.</div>';
    return;
  }
  all.forEach(s => {
    const el = document.createElement('div');
    el.className = 'chat-item' + (s.id === currentSessionId ? ' active' : '');
    el.dataset.id = s.id;
    const d = new Date(s.ts);
    const meta = `${d.toLocaleDateString(undefined,{month:'short',day:'numeric'})} · ${s.thread.length} msgs`;
    el.innerHTML = `
      <div class="chat-item-icon" style="background:rgba(91,110,245,.12);">
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </div>
      <div class="chat-item-body">
        <div class="chat-item-title">${esc(s.title)}</div>
        <div class="chat-item-meta">${meta}</div>
      </div>
      <button class="chat-item-del" data-id="${s.id}" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`;
    list.appendChild(el);
  });
}

// ── Load session into view ─────────────────────────────
async function loadSession(id) {
  const all = await dbGetAll();
  const s   = all.find(x => x.id === id);
  if (!s) return;
  currentSessionId = s.id;
  thread   = s.thread;
  msgCount = 0;
  roundNum = 0;
  const msgs = document.getElementById('messages');
  msgs.innerHTML = '';
  document.getElementById('topbarTitle').textContent = s.title;
  // Replay render
  let lastRound = null;
  s.thread.forEach(m => {
    const r = m.round || 0;
    if (r !== lastRound && r > 0) {
      addRoundSep(r); lastRound = r;
    }
    renderMessage(m.ai, m.text, false);
  });
  renderSidebar();
  // Mobile: close sidebar
  closeSidebarMobile();
}

// ── New session ────────────────────────────────────────
function newSession() {
  if (roundActive) return;
  currentSessionId = 'sess-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  thread = []; msgCount = 0; roundNum = 0;
  const msgs = document.getElementById('messages');
  msgs.innerHTML = `<div class="empty-state" id="emptyState">
    <div class="empty-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    </div>
    <div class="empty-title">Council Auto</div>
    <div class="empty-sub">Add API keys, then send a message. All armed AIs respond automatically — one by one, in order, reading each other's answers as they come in.</div>
    <div class="empty-arms">
      <span class="empty-chip" data-ai="Claude">Claude</span>
      <span class="empty-chip" data-ai="Gemini">Gemini</span>
      <span class="empty-chip" data-ai="GPT-4o">GPT-4o</span>
      <span class="empty-chip" data-ai="Grok">Grok</span>
    </div>
  </div>`;
  document.getElementById('topbarTitle').textContent = 'New session';
  updateEmptyChips();
  renderSidebar();
  closeSidebarMobile();
}

// ═══════════════════════════════════════════════════════
//  SAVE NATIVE — File System Access API + fallback
// ═══════════════════════════════════════════════════════
async function saveNative() {
  if (!thread.length) { showNotice('Nothing to save yet.'); return; }
  const title = thread.find(m => m.ai === 'You')?.text?.slice(0, 40) || 'council-session';
  const safe  = title.replace(/[^a-z0-9\-_ ]/gi, '').trim().replace(/\s+/g, '-').toLowerCase();
  const fname = `gnoke-council-${safe}-${new Date().toISOString().slice(0,10)}.md`;
  const md    = buildMarkdownExport();

  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fname,
        types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(md);
      await writable.close();
      showNotice('Saved ✓ ' + fname);
      return;
    } catch (e) {
      if (e.name === 'AbortError') return; // user cancelled
      // fall through to download
    }
  }
  // Fallback: trigger download
  const blob = new Blob([md], { type: 'text/markdown' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = fname; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  showNotice('Downloaded ✓ ' + fname);
}

function buildMarkdownExport() {
  const title = thread.find(m => m.ai === 'You')?.text?.slice(0, 60) || 'Council Session';
  const date  = new Date().toLocaleString();
  let out = `# Gnoke Council Auto — Export\n\n**${title}**  \n_${date}_\n\n---\n\n`;
  let lastRound = null;
  thread.forEach(m => {
    if (m.round && m.round !== lastRound) {
      out += `\n## Round ${m.round}\n\n`;
      lastRound = m.round;
    }
    out += `**${m.ai}**\n\n${m.text}\n\n---\n\n`;
  });
  return out;
}

// ═══════════════════════════════════════════════════════
//  API KEY UI
// ═══════════════════════════════════════════════════════
function hasKey(ai) { return !!apiKeys[ai]; }
function armedAIs() { return AI_LIST.filter(a => hasKey(a)); }

function updateKeyBtn() {
  const n   = armedAIs().length;
  const btn = document.getElementById('keyBtn');
  if (n === 0) {
    btn.classList.remove('set');
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg> Keys`;
  } else {
    btn.classList.add('set');
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg> ${n}/4`;
  }
}

function updatePips() {
  document.querySelectorAll('.ai-pip').forEach(p => {
    p.classList.toggle('armed', hasKey(p.dataset.ai));
  });
  updateEmptyChips();
}

function updateEmptyChips() {
  document.querySelectorAll('.empty-chip').forEach(c => {
    c.classList.toggle('armed', hasKey(c.dataset.ai));
  });
}

document.getElementById('keyBtn').addEventListener('click', () => {
  document.getElementById('keyDrawer').classList.toggle('open');
});
document.querySelectorAll('.key-save').forEach(btn => {
  btn.addEventListener('click', () => {
    const ai  = btn.dataset.ai;
    const val = document.getElementById(`key-${ai}`).value.trim();
    if (!val) return;
    apiKeys[ai] = val;
    document.getElementById(`key-${ai}`).value = '';
    document.getElementById(`badge-${ai}`).style.display = 'inline';
    updateKeyBtn(); updatePips();
  });
});
document.querySelectorAll('.key-field').forEach(f => {
  f.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.querySelector(`.key-save[data-ai="${f.dataset.ai}"]`).click();
  });
});

// ═══════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════
function getTime() {
  const d = new Date();
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function renderMd(text) {
  try { return marked.parse(text, { breaks: true, gfm: true }); }
  catch (_) { return esc(text).replace(/\n/g,'<br>'); }
}
function scrollDown() {
  const m = document.getElementById('messages');
  m.scrollTop = m.scrollHeight;
}
function showNotice(msg, ms = 3000) {
  const bar = document.getElementById('noticeBar');
  bar.textContent = msg;
  bar.classList.add('show');
  setTimeout(() => bar.classList.remove('show'), ms);
}
function fetchWithTimeout(url, opts) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// ═══════════════════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════════════════
function removeEmpty() { document.getElementById('emptyState')?.remove(); }

function addRoundSep(n) {
  const msgs = document.getElementById('messages');
  const s    = document.createElement('div');
  s.className = 'round-sep';
  s.innerHTML = `<div class="round-sep-line"></div><span>Round ${n}</span><div class="round-sep-line"></div>`;
  msgs.appendChild(s);
}

function renderMessage(ai, text, animate = true) {
  removeEmpty();
  msgCount++;
  const msgs = document.getElementById('messages');
  if (msgCount === 1) {
    const d = document.createElement('div');
    d.className = 'day-divider'; d.innerHTML = '<span>Today</span>';
    msgs.appendChild(d);
  }
  const isMe  = ai === 'You';
  const group = document.createElement('div');
  group.className = `msg-group${isMe ? ' from-me' : ''}${animate ? '' : ''}`;
  group.dataset.ai = ai;
  if (!animate) group.style.animation = 'none';
  group.innerHTML = isMe
    ? `<div class="msg-col">
         <div class="bubble from-me">${renderMd(text)}</div>
         <div class="bubble-time">${getTime()}</div>
       </div>
       <div class="msg-avatar" data-ai="You">You</div>`
    : `<div class="msg-avatar" data-ai="${ai}">${INITIALS[ai]}</div>
       <div class="msg-col">
         <div class="msg-sender" data-ai="${ai}">${ai}</div>
         <div class="bubble from-other" data-ai="${ai}">${renderMd(text)}</div>
         <div class="bubble-time">${getTime()}</div>
       </div>`;
  msgs.appendChild(group);
  scrollDown();
}

function postError(ai, msg) {
  const el = document.createElement('div');
  el.className = 'error-msg';
  el.textContent = `${ai}: ${msg}`;
  document.getElementById('messages').appendChild(el);
  scrollDown();
}

// ── Typing indicator ───────────────────────────────────
function showTyping(ai) {
  removeEmpty();
  const msgs  = document.getElementById('messages');
  const group = document.createElement('div');
  group.className = 'msg-group';
  group.dataset.ai = ai;
  group.id = 'typingEl';
  group.innerHTML = `
    <div class="msg-avatar" data-ai="${ai}">${INITIALS[ai]}</div>
    <div class="msg-col">
      <div class="msg-sender" data-ai="${ai}">${ai}</div>
      <div class="typing-bubble">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>`;
  msgs.appendChild(group);
  typingEl = group;
  scrollDown();
}
function removeTyping() { typingEl?.remove(); typingEl = null; }

// ═══════════════════════════════════════════════════════
//  QUEUE STRIP
// ═══════════════════════════════════════════════════════
function updateQueue(queue, currentAI) {
  const strip  = document.getElementById('queueStrip');
  const chips  = document.getElementById('qChips');
  const armed  = armedAIs();
  if (!armed.length) { strip.classList.remove('visible'); return; }
  strip.classList.add('visible');
  chips.innerHTML = '';
  armed.forEach(ai => {
    const done = queue.indexOf(ai) === -1 && ai !== currentAI;
    const live = ai === currentAI;
    const chip = document.createElement('span');
    chip.className = `q-chip${live ? ' live' : done ? ' done' : ''}`;
    chip.dataset.ai = ai;
    chip.textContent = ai;
    chips.appendChild(chip);
  });
}
function hideQueue() {
  document.getElementById('queueStrip').classList.remove('visible');
}

// ── Progress bar ───────────────────────────────────────
function setProgress(done, total) {
  const pct = total > 0 ? (done / total) * 100 : 0;
  document.getElementById('roundFill').style.width = pct + '%';
  const bar = document.getElementById('roundBar');
  bar.classList.toggle('active', done < total);
}
function resetProgress() {
  document.getElementById('roundFill').style.width = '0%';
  document.getElementById('roundBar').classList.remove('active');
}

// ═══════════════════════════════════════════════════════
//  API CALLS — each provider
// ═══════════════════════════════════════════════════════
function buildContext(ai) {
  // All messages in current round so far (including other AIs that already responded)
  // + the original user message
  const visible = thread.filter(m => m.ai !== ai);
  const lines   = visible.length
    ? ['Conversation so far:', ...visible.map(m => `${m.ai}: ${m.text}`)]
    : [];
  return {
    system: SYSTEM[ai] + (lines.length ? '\n\n' + lines.join('\n') : ''),
    messages: [{ role: 'user', content: 'Your turn.' }]
  };
}

async function callClaude() {
  const { system, messages } = buildContext('Claude');
  const res  = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKeys.Claude,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, system, messages })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content?.[0]?.text?.trim() || '(No response)';
}

async function callGemini() {
  const { system } = buildContext('Gemini');
  const body = {
    contents: [
      { role: 'user',  parts: [{ text: system }] },
      { role: 'model', parts: [{ text: 'Ready.' }] },
      { role: 'user',  parts: [{ text: 'Your turn.' }] }
    ]
  };
  const res  = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKeys.Gemini}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || data.error.status);
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '(No response)';
}

async function callGPT() {
  const { system, messages } = buildContext('GPT-4o');
  const res  = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKeys['GPT-4o']}` },
    body: JSON.stringify({ model: 'gpt-4o', max_tokens: 1000, messages: [{ role: 'system', content: system }, ...messages] })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content?.trim() || '(No response)';
}

async function callGrok() {
  const { system, messages } = buildContext('Grok');
  const res  = await fetchWithTimeout('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKeys.Grok}` },
    body: JSON.stringify({ model: 'grok-3-latest', max_tokens: 1000, messages: [{ role: 'system', content: system }, ...messages] })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content?.trim() || '(No response)';
}

const CALLERS = { Claude: callClaude, Gemini: callGemini, 'GPT-4o': callGPT, Grok: callGrok };

// ═══════════════════════════════════════════════════════
//  ROUND RUNNER — the core auto logic
//  Sequential: each AI waits for the previous to finish.
//  Context grows as each responds — later AIs see earlier ones.
// ═══════════════════════════════════════════════════════
async function runRound() {
  const queue = armedAIs();
  if (!queue.length) { showNotice('Add at least one API key first.'); return; }

  roundActive = true;
  stopFlag    = false;

  document.getElementById('sendBtn').disabled      = true;
  document.getElementById('chatInput').disabled    = true;
  document.getElementById('inputWrap').classList.add('busy');
  document.getElementById('stopBtn').classList.add('visible');

  // Pip all to live
  document.querySelectorAll('.ai-pip').forEach(p => {
    if (queue.includes(p.dataset.ai)) p.classList.add('live');
  });

  const total = queue.length;
  let done    = 0;

  for (const ai of queue) {
    if (stopFlag) break;

    updateQueue([...queue].slice(done), ai);
    setProgress(done, total);

    // Mark current pip
    document.querySelectorAll('.ai-pip').forEach(p => {
      if (p.dataset.ai === ai) { p.classList.add('live'); }
      else                     { p.classList.remove('live'); }
    });

    showTyping(ai);

    try {
      const text = await CALLERS[ai]();
      removeTyping();
      if (stopFlag) break;
      thread.push({ ai, text, role: 'ai', ts: Date.now(), round: roundNum });
      renderMessage(ai, text);
    } catch (err) {
      removeTyping();
      if (err.name === 'AbortError') {
        postError(ai, 'timed out (30s)');
      } else {
        postError(ai, err.message);
      }
    }

    done++;
    setProgress(done, total);
  }

  // Round complete
  roundActive = false;
  stopFlag    = false;

  document.querySelectorAll('.ai-pip').forEach(p => p.classList.remove('live'));
  document.getElementById('sendBtn').disabled   = false;
  document.getElementById('chatInput').disabled = false;
  document.getElementById('inputWrap').classList.remove('busy');
  document.getElementById('stopBtn').classList.remove('visible');
  hideQueue();
  resetProgress();

  await saveSession();
}

// ═══════════════════════════════════════════════════════
//  SEND
// ═══════════════════════════════════════════════════════
function send() {
  const input = document.getElementById('chatInput');
  const text  = input.value.trim();
  if (!text || roundActive) return;
  if (!armedAIs().length) { showNotice('No API keys set — open Keys to add one.'); return; }

  roundNum++;
  if (thread.length > 0) addRoundSep(roundNum);

  thread.push({ ai: 'You', text, role: 'user', ts: Date.now(), round: roundNum });
  renderMessage('You', text);

  input.value = ''; input.style.height = 'auto';

  runRound();
}

document.getElementById('sendBtn').addEventListener('click', send);
document.getElementById('chatInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
});
document.getElementById('chatInput').addEventListener('input', function () {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

document.getElementById('stopBtn').addEventListener('click', () => {
  stopFlag = true;
  showNotice('Stopping after current response…');
});

// ═══════════════════════════════════════════════════════
//  SIDEBAR INTERACTIONS
// ═══════════════════════════════════════════════════════
document.getElementById('newChatBtn').addEventListener('click', newSession);

document.getElementById('chatList').addEventListener('click', e => {
  // Delete button
  const del = e.target.closest('.chat-item-del');
  if (del) {
    e.stopPropagation();
    dbDelete(del.dataset.id).then(renderSidebar);
    if (del.dataset.id === currentSessionId) newSession();
    return;
  }
  // Load session
  const item = e.target.closest('.chat-item');
  if (item) loadSession(item.dataset.id);
});

document.getElementById('saveBtn').addEventListener('click', saveNative);

document.getElementById('clearAllBtn').addEventListener('click', async () => {
  if (!confirm('Delete all saved sessions? This cannot be undone.')) return;
  const all = await dbGetAll();
  for (const s of all) await dbDelete(s.id);
  newSession();
  renderSidebar();
});

// ── Sidebar toggle ─────────────────────────────────────
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebarOverlay');

function closeSidebarMobile() {
  sidebar.classList.remove('open');
  overlay.classList.remove('show');
}

document.getElementById('sidebarToggle').addEventListener('click', () => {
  if (window.innerWidth <= 640) {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show', sidebar.classList.contains('open'));
  } else {
    sidebar.classList.toggle('collapsed');
  }
});
overlay.addEventListener('click', closeSidebarMobile);

// ═══════════════════════════════════════════════════════
//  MOBILE VIEWPORT
// ═══════════════════════════════════════════════════════
function fixVH() { document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`); }
window.addEventListener('resize', fixVH); fixVH();

// ═══════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════
currentSessionId = 'sess-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
renderSidebar();
updateKeyBtn();
updatePips();


