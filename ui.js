// ═══════════════════════════════════════════════════════
//  ui.js — Gnoke Council (Manual)
//  Identity switching, message render, send, copy.
//  Depends on: state.js → attach.js → ui.js (load order)
// ═══════════════════════════════════════════════════════

// ── Identity ───────────────────────────────────────────
function switchIdentity(ai) {
  activeAI = ai;
  document.querySelectorAll(".id-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.ai === ai)
  );
  document.getElementById("youChip").textContent =
    ai === "You" ? "Posting as yourself" : `You are ${ai}`;
  document.getElementById("chatInput").placeholder =
    ai === "You" ? "Say something…" : `Post as ${ai}…`;
  document.getElementById("inputWrap").dataset.ai = ai;
  document.getElementById("sendBtn").dataset.ai   = ai;
  updateCopyBar();
}

// ── Render: message bubble ─────────────────────────────
function postMessage(ai, text, file) {
  document.getElementById("emptyState")?.remove();
  msgCount++;
  if (msgCount === 1) {
    const div = document.createElement("div");
    div.className = "day-divider";
    div.innerHTML = `<span>Today</span>`;
    document.getElementById("messages").appendChild(div);
  }
  thread.push({ ai, text, file: file || null });
  const isMe  = ai === "You";
  const msgs  = document.getElementById("messages");
  const group = document.createElement("div");
  group.className = `msg-group ${isMe ? "from-me" : ""}`;
  const time  = getTime();
  let content = text ? escHtml(text) : '';
  if (file) content += renderAttachCard(file);   // from attach.js
  group.innerHTML = isMe
    ? `<div class="msg-col">
         <div class="bubble from-me" data-ai="${ai}">${content}</div>
         <div class="bubble-time">${time}</div>
       </div>
       <div class="msg-avatar" data-ai="${ai}">You</div>`
    : `<div class="msg-avatar" data-ai="${ai}">${INITIALS[ai]}</div>
       <div class="msg-col">
         <div class="msg-sender" data-ai="${ai}">${ai}</div>
         <div class="bubble from-other">${content}</div>
         <div class="bubble-time">${time}</div>
       </div>`;
  msgs.appendChild(group);
  msgs.scrollTop = msgs.scrollHeight;
  updateCopyBar();
}

// ── Send ───────────────────────────────────────────────
function send() {
  const input = document.getElementById("chatInput");
  const text  = input.value.trim();
  if (!text && !pendingFile) return;
  postMessage(activeAI, text, pendingFile);
  input.value = "";
  input.style.height = "auto";
  clearAttachment();                             // from attach.js
}

// ── Copy context ───────────────────────────────────────
document.getElementById("copyBtn").addEventListener("click", () => {
  const msgs = contextFor(activeAI);
  if (!msgs.length) return;
  const compiled = msgs.map(m => {
    let block = `[${m.ai}]`;
    if (m.text) block += `\n${m.text}`;
    if (m.file) block += `\n\n${serializeFileForCopy(m.file)}`; // from attach.js
    return block;
  }).join('\n\n---\n\n');
  navigator.clipboard.writeText(compiled).then(() => {
    const btn = document.getElementById('copyBtn');
    btn.classList.add('done');
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"/></svg> Copied`;
    setTimeout(() => {
      btn.classList.remove('done');
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg> Copy context`;
      updateCopyBar();
    }, 2000);
  });
});

// ── Identity bar ───────────────────────────────────────
document.querySelector(".identity-bar").addEventListener("click", e => {
  const btn = e.target.closest(".id-btn");
  if (btn) switchIdentity(btn.dataset.ai);
});

// ── Send events ────────────────────────────────────────
document.getElementById("sendBtn").addEventListener("click", send);

document.getElementById("chatInput").addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
});

document.getElementById("chatInput").addEventListener("input", function () {
  this.style.height = "auto";
  this.style.height = Math.min(this.scrollHeight, 120) + "px";
});

// ── Init ───────────────────────────────────────────────
switchIdentity("Claude");

// ── Persistence: Gnoke Spirit ──────────────────────────
// ── Persistence: Gnoke Spirit ──────────────────────────
(async () => {
  const DB_NAME = 'gnoke:council';
  const openDB  = () => new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = e => e.target.result.createObjectStore('session');
    r.onsuccess = e => res(e.target.result);
    r.onerror   = e => rej(e.target.error);
  });

  const db = await openDB();
  const put = (k, v) => new Promise((res, rej) => {
    const r = db.transaction('session','readwrite').objectStore('session').put(v, k);
    r.onsuccess = res; r.onerror = e => rej(e.target.error);
  });
  const get = (k) => new Promise((res, rej) => {
    const r = db.transaction('session','readonly').objectStore('session').get(k);
    r.onsuccess = e => res(e.target.result); r.onerror = e => rej(e.target.error);
  });

  // Restore thread
  const saved = await get('thread');
  if (saved?.length) saved.forEach(m => postMessage(m.ai, m.text, m.file));

  // Restore draft
  const draft = await get('draft');
  if (draft) {
    const el = document.getElementById('chatInput');
    el.value = draft;
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  // Save draft on every keystroke
  document.getElementById('chatInput').addEventListener('input', () =>
    put('draft', document.getElementById('chatInput').value)
  );

  // Save thread + clear draft after send (capture phase runs before send clears input)
  const persist = () => setTimeout(() => {
    put('thread', [...thread]);
    put('draft', '');
  }, 50);

  document.getElementById('sendBtn').addEventListener('click', persist, true);
  document.getElementById('chatInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) persist();
  }, true);

  // Final save on tab hide
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      put('thread', [...thread]);
      put('draft', document.getElementById('chatInput').value);
    }
  });
})();