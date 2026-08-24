// ============================================================
// EmailShield — Popup Script
// Renders the analysis report inside popup.html
// ============================================================

const app = document.getElementById('app');

// ── Constants ─────────────────────────────────────────────────
const CIRCUMFERENCE = 2 * Math.PI * 34; // r=34

// ── Detect Platform ───────────────────────────────────────────
function detectPlatform() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0]?.url || '';
    const badge = document.getElementById('badgePlatform');
    if (url.includes('outlook')) badge.textContent = 'Outlook';
    else if (url.includes('gmail')) badge.textContent = 'Gmail';
    else badge.textContent = 'Webmail';
  });
}

// ── Load & Render ─────────────────────────────────────────────
function init() {
  detectPlatform();
  renderLoading();

  chrome.runtime.sendMessage({ type: 'GET_RESULT' }, (resp) => {
    if (resp?.success && resp.data) {
      const age = Date.now() - (resp.data.timestamp || 0);
      if (age < 5 * 60 * 1000) { // fresh within 5 min
        render(resp.data);
        return;
      }
    }
    renderEmpty();
  });
}

// ── Render: Loading ───────────────────────────────────────────
function renderLoading() {
  app.innerHTML = `
    <div class="loading-dots">
      <span></span><span></span><span></span>
    </div>
  `;
}

// ── Render: No Email Open ─────────────────────────────────────
function renderEmpty() {
  app.innerHTML = `
    <div class="state-empty">
      <div class="state-empty-icon">📭</div>
      <div class="state-empty-title">No email selected</div>
      <div class="state-empty-sub">
        Open an email in Gmail and EmailShield will<br>
        automatically analyze it for fraud signals.
      </div>
    </div>
  `;
}

// ── Render: Full Analysis Report ──────────────────────────────
function render(data) {
  const { verdict, scoreLabel, score, riskScore, reasons, checks } = data;

  // Set body class for color theming
  document.body.className = 'verdict-' + verdict.toLowerCase();

  // Ring math
  const displayScore  = verdict === 'SAFE' ? score : riskScore;
  const ringColor     = verdict === 'FRAUD' ? '#ef4444' : verdict === 'SUSPICIOUS' ? '#f59e0b' : '#22c55e';
  const dashOffset    = CIRCUMFERENCE - (displayScore / 100) * CIRCUMFERENCE;
  const verdictLabel  = verdict === 'SAFE' ? '✓ Safe' : verdict === 'FRAUD' ? '⚠ Fraud' : '⚡ Suspicious';

  // Build checks chips
  const checksHTML = Object.entries(checks).map(([key, ch]) => {
    const icon = ch.status === 'pass' ? '✓' : ch.status === 'fail' ? '✕' : '!';
    return `
      <div class="check-chip" title="${escHtml(ch.detail)}">
        <div class="check-icon ${ch.status}">${icon}</div>
        <div class="check-info">
          <div class="check-name">${escHtml(ch.label)}</div>
          <div class="check-status ${ch.status}">${ch.status.toUpperCase()}</div>
        </div>
      </div>
    `;
  }).join('');

  // Build reasons list
  const reasonsHTML = reasons.map(r => `
    <div class="reason-item ${r.severity}">
      <div class="reason-dot"></div>
      <div class="reason-text">${escHtml(r.text)}</div>
    </div>
  `).join('');

  app.innerHTML = `
    <!-- Score Ring + Verdict -->
    <div class="score-section">
      <div class="score-ring-wrap">
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle class="score-ring-track" cx="40" cy="40" r="34" />
          <circle
            class="score-ring-fill"
            cx="40" cy="40" r="34"
            stroke="${ringColor}"
            stroke-dasharray="${CIRCUMFERENCE}"
            stroke-dashoffset="${CIRCUMFERENCE}"
            id="scoreRingFill"
          />
        </svg>
        <div class="score-center">
          <div class="score-number">${displayScore}</div>
          <div class="score-pct">/ 100</div>
        </div>
      </div>

      <div class="score-meta">
        <div class="verdict-label">${verdictLabel}</div>
        <div class="verdict-sub">${scoreLabel}<br>Click a check below for details.</div>
      </div>
    </div>

    <div class="divider"></div>

    <!-- Auth Checks -->
    <div class="section-title">Verification Checks</div>
    <div class="checks-grid">${checksHTML}</div>

    <div class="divider"></div>

    <!-- Why Report -->
    <div class="section-title">Why this verdict?</div>
    <div class="reasons-list">${reasonsHTML}</div>

    <!-- Re-scan button -->
    <button class="scan-btn" id="rescanBtn">↻ Re-Scan Current Email</button>
    <div style="height:14px"></div>
  `;

  // Animate ring
  requestAnimationFrame(() => {
    const fill = document.getElementById('scoreRingFill');
    if (fill) fill.style.strokeDashoffset = dashOffset;
    fill.style.transition = 'stroke-dashoffset 0.9s cubic-bezier(0.34, 1.2, 0.64, 1)';
  });

  // Tooltip on check chips
  document.querySelectorAll('.check-chip').forEach((chip, i) => {
    chip.addEventListener('click', () => {
      const checkKey = Object.keys(checks)[i];
      const detail   = checks[checkKey]?.detail || '';
      showChipDetail(chip, detail);
    });
  });

  // Re-scan
  document.getElementById('rescanBtn').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'RESCAN' }, () => {
          renderLoading();
          setTimeout(init, 1200);
        });
      }
    });
  });
}

// ── Chip Click Tooltip ────────────────────────────────────────
function showChipDetail(chip, detail) {
  document.querySelectorAll('.chip-tooltip').forEach(t => t.remove());
  if (!detail) return;

  const tip = document.createElement('div');
  tip.className = 'chip-tooltip';
  tip.style.cssText = `
    position: absolute;
    background: #1e293b;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 7px;
    padding: 8px 12px;
    font-size: 11px;
    color: #cbd5e1;
    line-height: 1.45;
    z-index: 99;
    max-width: 260px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    left: 50%;
    transform: translateX(-50%);
  `;
  tip.textContent = detail;

  document.body.style.position = 'relative';
  document.body.appendChild(tip);

  const rect = chip.getBoundingClientRect();
  tip.style.top = `${rect.bottom + 6}px`;
  tip.style.left = `${rect.left}px`;
  tip.style.transform = 'none';

  const close = () => tip.remove();
  setTimeout(() => document.addEventListener('click', close, { once: true }), 50);
}

// ── Util ──────────────────────────────────────────────────────
function escHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);