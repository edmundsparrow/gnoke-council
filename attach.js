// ═══════════════════════════════════════════════════════
//  attach.js — Gnoke Council (Manual)
//  File attachment: staging, clearing, card render,
//  copy serialisation, drag-drop + input events.
//  Depends on: state.js (pendingFile, escHtml, fmtBytes, fileExt)
// ═══════════════════════════════════════════════════════

// Accepted text-readable formats
const ACCEPT_TYPES = [
  '.txt','.md','.html','.htm',
  '.css','.js','.jsx','.ts','.tsx',
  '.json','.php','.py','.java',
  '.c','.cpp','.cs','.xml',
  '.yaml','.yml','.sql','.sh',
  '.rb','.go','.rs','.swift',
  '.vue','.svelte','.toml',
  '.env','.gitignore','.csv'
].join(',');

// ── Stage a file into pendingFile ─────────────────────
function stageFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    pendingFile = {
      name:    file.name,
      size:    file.size,
      content: e.target.result
    };
    document.getElementById('chipName').textContent = file.name;
    document.getElementById('chipSize').textContent = fmtBytes(file.size);
    document.getElementById('attachStrip').classList.add('visible');
  };
  reader.onerror = () => {
    showAttachError('Could not read file.');
  };
  reader.readAsText(file);
}

// ── Clear staged file ──────────────────────────────────
function clearAttachment() {
  pendingFile = null;
  document.getElementById('fileInput').value = '';
  document.getElementById('attachStrip').classList.remove('visible');
}

// ── Inline error inside strip ──────────────────────────
function showAttachError(msg) {
  const strip = document.getElementById('attachStrip');
  strip.classList.add('visible');
  document.getElementById('chipName').textContent = '⚠ ' + msg;
  document.getElementById('chipSize').textContent = '';
}

// ── Render attach card inside a bubble ────────────────
function renderAttachCard(file) {
  const lines   = file.content.split('\n').length;
  const preview = file.content.slice(0, 120).replace(/</g, '&lt;');
  const ext     = fileExt(file.name);
  return `<div class="attach-card">
    <div class="attach-card-head">
      <span class="attach-card-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" width="13" height="13">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      </span>
      <span class="attach-card-name">${escHtml(file.name)}</span>
      <span class="attach-card-meta">${ext ? '.' + ext + ' · ' : ''}${lines} lines · ${fmtBytes(file.size)}</span>
    </div>
    <div class="attach-card-preview">${preview}${file.content.length > 120 ? '…' : ''}</div>
  </div>`;
}

// ── Serialise a file for copy-context export ──────────
function serializeFileForCopy(file) {
  const ext = fileExt(file.name);
  return `[attachment: ${file.name}]\n\`\`\`${ext}\n${file.content}\n\`\`\``;
}

// ── Guard: reject non-text / oversized files ──────────
const MAX_SIZE = 500 * 1024; // 500 KB

function validateFile(file) {
  if (file.size > MAX_SIZE) {
    showAttachError(`File too large (max 500 KB).`);
    return false;
  }
  const ext = '.' + fileExt(file.name);
  if (!ACCEPT_TYPES.includes(ext)) {
    showAttachError(`Unsupported type: ${ext || 'unknown'}`);
    return false;
  }
  return true;
}

// ── Events ─────────────────────────────────────────────
document.getElementById('attachBtn').addEventListener('click', () => {
  document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file && validateFile(file)) stageFile(file);
});

document.getElementById('attachClear').addEventListener('click', clearAttachment);

// Drag and drop onto input wrap
document.getElementById('inputWrap').addEventListener('dragover', e => {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
});

document.getElementById('inputWrap').addEventListener('dragleave', e => {
  e.currentTarget.classList.remove('drag-over');
});

document.getElementById('inputWrap').addEventListener('drop', e => {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && validateFile(file)) stageFile(file);
});