// ============================================================
// EmailShield — Content Script
// Gmail DOM Parser + Inbox Dot Injector
// ============================================================

(function () {
  'use strict';

  let currentObserver = null;
  let inboxObserver   = null;
  let lastEmailId     = null;

  // ── Gmail Selectors (update these if Gmail changes its DOM) ─
  const SELECTORS = {
    // Open email view
    emailSubject:  'h2.hP',
    senderName:    '.gD',
    senderEmail:   '.go',
    replyTo:       '[data-hovercard-id]',
    emailBody:     '.a3s.aiL',
    emailLinks:    '.a3s.aiL a',

    // Inbox list rows
    inboxRow:      'tr.zA',
    inboxSender:   '.yW span[email]',
    inboxSubject:  '.y6 > span:not(.T6):not(.Zt)'
  };

  // ── Init ─────────────────────────────────────────────────────
  function init() {
    observeInbox();
    observeEmailOpen();
    console.log('[EmailShield] Content script initialized');
  }

  // ── INBOX: Watch for email rows and inject dots ──────────────
  function observeInbox() {
    inboxObserver = new MutationObserver(debounce(() => {
      document.querySelectorAll(SELECTORS.inboxRow).forEach(row => {
        if (row.dataset.shieldProcessed) return;
        row.dataset.shieldProcessed = 'true';
        processInboxRow(row);
      });
    }, 400));

    inboxObserver.observe(document.body, { childList: true, subtree: true });

    // Process already-rendered rows
    document.querySelectorAll(SELECTORS.inboxRow).forEach(row => {
      if (!row.dataset.shieldProcessed) {
        row.dataset.shieldProcessed = 'true';
        processInboxRow(row);
      }
    });
  }

  function processInboxRow(row) {
    const senderEl  = row.querySelector(SELECTORS.inboxSender);
    const subjectEl = row.querySelector(SELECTORS.inboxSubject);
    if (!senderEl && !subjectEl) return;

    const senderEmail = senderEl?.getAttribute('email') || '';
    const senderName  = senderEl?.getAttribute('name') || senderEl?.textContent || '';
    const subject     = subjectEl?.textContent || '';

    // Quick lightweight pre-screen for inbox badges
    const quickData = { from: senderEmail || senderName, subject, body: '', links: [] };

    chrome.runtime.sendMessage({ type: 'ANALYZE_EMAIL', emailData: quickData }, (resp) => {
      if (!resp?.success) return;
      const { dotColor, verdict } = resp.result;
      injectInboxDot(row, subjectEl || senderEl, dotColor, verdict, resp.result);
    });
  }

  function injectInboxDot(row, targetEl, dotColor, verdict, fullResult) {
    // Remove old dot if re-analyzed
    row.querySelector('.email-shield-dot')?.remove();

    const dot = document.createElement('span');
    dot.className = 'email-shield-dot';
    dot.dataset.verdict = verdict;
    dot.dataset.color   = dotColor;
    dot.title = `EmailShield: ${verdict} — click extension icon for details`;

    dot.addEventListener('mouseenter', (e) => showTooltip(e, fullResult));
    dot.addEventListener('mouseleave', hideTooltip);

    if (targetEl?.parentNode) {
      targetEl.parentNode.insertBefore(dot, targetEl);
    } else {
      row.appendChild(dot);
    }
  }

  // ── EMAIL OPEN: Parse full email for popup analysis ──────────
  function observeEmailOpen() {
    currentObserver = new MutationObserver(debounce(() => {
      const subjectEl = document.querySelector(SELECTORS.emailSubject);
      if (!subjectEl) return;

      const emailId = subjectEl.textContent?.trim();
      if (emailId === lastEmailId) return;
      lastEmailId = emailId;

      analyzeOpenEmail();
    }, 600));

    currentObserver.observe(document.body, { childList: true, subtree: true });
  }

  function analyzeOpenEmail() {
    const emailData = extractEmailData();
    if (!emailData.from && !emailData.subject) return;

    chrome.runtime.sendMessage({ type: 'ANALYZE_EMAIL', emailData }, (resp) => {
      if (!resp?.success) return;

      // Store result for popup to consume
      chrome.runtime.sendMessage({
        type: 'STORE_RESULT',
        data: { ...resp.result, emailData, timestamp: Date.now() }
      });
    });
  }

  function extractEmailData() {
    // Subject
    const subject = document.querySelector(SELECTORS.emailSubject)?.textContent?.trim() || '';

    // Sender
    const senderEl    = document.querySelector(SELECTORS.senderName);
    const senderName  = senderEl?.textContent?.trim() || '';
    const senderEmail = senderEl?.getAttribute('email') ||
                        document.querySelector(SELECTORS.senderEmail)?.getAttribute('email') || '';

    // Reply-To (Gmail stores it in hidden spans)
    let replyTo = '';
    document.querySelectorAll(SELECTORS.replyTo).forEach(el => {
      const hc = el.getAttribute('data-hovercard-id');
      if (hc && hc !== senderEmail && hc.includes('@')) {
        replyTo = hc;
      }
    });

    // Body text
    const bodyEl  = document.querySelector(SELECTORS.emailBody);
    const bodyText = bodyEl?.innerText?.substring(0, 3000) || '';

    // Links
    const linkEls = document.querySelectorAll(SELECTORS.emailLinks);
    const links = Array.from(linkEls)
      .map(a => a.href)
      .filter(href => href && !href.startsWith('mailto:'));

    return {
      subject,
      from:    senderEmail || senderName,
      replyTo: replyTo || '',
      body:    bodyText,
      links:   [...new Set(links)]
    };
  }

  // ── Hover Tooltip ─────────────────────────────────────────────
  let tooltipEl = null;

  function showTooltip(event, result) {
    hideTooltip();
    const { verdict, scoreLabel, reasons } = result;

    tooltipEl = document.createElement('div');
    tooltipEl.className = 'email-shield-tooltip';
    tooltipEl.innerHTML = `
      <div class="est-header est-header--${result.dotColor}">
        <span class="est-verdict">${verdict}</span>
        <span class="est-score">${scoreLabel}</span>
      </div>
      <ul class="est-reasons">
        ${reasons.slice(0, 2).map(r =>
          `<li class="est-reason est-reason--${r.severity}">${r.text}</li>`
        ).join('')}
        ${reasons.length > 2 ? `<li class="est-reason est-more">+${reasons.length - 2} more — click icon for full report</li>` : ''}
      </ul>
    `;

    document.body.appendChild(tooltipEl);
    positionTooltip(event, tooltipEl);
  }

  function positionTooltip(event, tip) {
    const rect = event.target.getBoundingClientRect();
    const scrollY = window.scrollY;
    tip.style.top  = `${rect.bottom + scrollY + 8}px`;
    tip.style.left = `${Math.max(8, rect.left - 20)}px`;
  }

  function hideTooltip() {
    tooltipEl?.remove();
    tooltipEl = null;
  }

  // ── Utility ───────────────────────────────────────────────────
  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // ── Start ─────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();