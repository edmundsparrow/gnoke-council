// ═══════════════════════════════════════════════════════
//  state.js — Gnoke Council (Manual)
//  Constants, shared state, context logic, copy bar,
//  pure utils (no DOM except copy bar).
// ═══════════════════════════════════════════════════════

const AIS      = ["You","Claude","Gemini","GPT-4o","Grok"];
const INITIALS = { You:"You", Claude:"Cl", Gemini:"Ge", "GPT-4o":"GP", Grok:"Gr" };

let activeAI    = "Claude";
let msgCount    = 0;
let pendingFile = null;        // set/cleared by attach.js
const thread    = [];

// ── Time ───────────────────────────────────────────────
function getTime() {
  const d = new Date();
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// ── HTML escape ────────────────────────────────────────
function escHtml(s) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ── File utils (shared by attach.js and copy) ──────────
function fmtBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
}

function fileExt(name) {
  return name.includes('.') ? name.split('.').pop().toLowerCase() : '';
}

// ── Context: messages this AI hasn't seen yet ──────────
// First-time AI → full thread (catch-up).
// Returning AI  → only messages since it last spoke.
// You           → full thread always.
function contextFor(ai) {
  if (ai === "You") return thread;
  const lastIdx = [...thread].map(m => m.ai).lastIndexOf(ai);
  if (lastIdx === -1) return thread;
  return thread.slice(lastIdx + 1);
}

// ── Copy bar ───────────────────────────────────────────
function updateCopyBar() {
  const label = document.getElementById("copyLabel");
  const btn   = document.getElementById("copyBtn");
  const msgs  = contextFor(activeAI);
  if (!msgs.length) {
    label.textContent = thread.length
      ? `${activeAI} has nothing new to read`
      : "No messages yet";
    btn.disabled = true;
  } else {
    const senders = [...new Set(msgs.map(m => m.ai))].join(" + ");
    label.textContent = activeAI === "You"
      ? `Full thread — ${msgs.length} message${msgs.length > 1 ? "s" : ""}`
      : `For ${activeAI}: ${msgs.length} new msg${msgs.length > 1 ? "s" : ""} from ${senders}`;
    btn.disabled = false;
  }
}