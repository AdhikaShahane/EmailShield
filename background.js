// ============================================================
// EmailShield — Background Service Worker
// Mock Analysis Engine (replace analyzeEmail() with real API)
// ============================================================

// ── Fraud Signals ──────────────────────────────────────────
const FRAUD_KEYWORDS = [
  'urgent', 'immediate action', 'verify your account', 'suspended',
  'click here now', 'confirm your identity', 'unusual activity',
  'your account will be closed', 'act now', 'limited time',
  'you have been selected', 'congratulations you won', 'wire transfer',
  'send money', 'gift card', 'western union', 'bitcoin payment',
  'tax refund', 'irs notice', 'password expired', 'reset immediately',
  'unauthorized login', 'security alert', 'update billing'
];

const SUSPICIOUS_DOMAINS = [
  'paypa1.com', 'arnazon.com', 'g00gle.com', 'micros0ft.com',
  'apple-support.net', 'secure-login.xyz', 'account-verify.info',
  'bankofamerica-secure.com', 'netflix-billing.net'
];

const TRUSTED_DOMAINS = [
  'google.com', 'gmail.com', 'microsoft.com', 'apple.com',
  'amazon.com', 'paypal.com', 'github.com', 'linkedin.com',
  'salesforce.com', 'dropbox.com', 'slack.com', 'zoom.us'
];

// ── Main Analysis Engine ────────────────────────────────────
// TO INTEGRATE A REAL ML MODEL:
// Replace this function body with a fetch() call to your API.
// The returned object shape must match exactly:
// { score, verdict, dotColor, reasons, checks }
function analyzeEmail(emailData) {
  const reasons = [];
  let riskPoints = 0;
  const MAX_POINTS = 100;

  const checks = {
    header: { label: 'Header Analysis', status: 'pass', detail: '' },
    spf:    { label: 'SPF Record',      status: 'pass', detail: '' },
    dkim:   { label: 'DKIM Signature',  status: 'pass', detail: '' },
    dmarc:  { label: 'DMARC Policy',    status: 'pass', detail: '' },
    body:   { label: 'Content Scan',    status: 'pass', detail: '' },
    links:  { label: 'Link Integrity',  status: 'pass', detail: '' }
  };

  // ── 1. HEADER ANALYSIS (Spoofing Detection) ─────────────
  const fromDomain  = extractDomain(emailData.from);
  const replyDomain = emailData.replyTo ? extractDomain(emailData.replyTo) : fromDomain;

  if (fromDomain && replyDomain && fromDomain !== replyDomain) {
    riskPoints += 30;
    checks.header.status = 'fail';
    checks.header.detail = `From domain (${fromDomain}) doesn't match Reply-To (${replyDomain})`;
    reasons.push({ severity: 'high', text: `Sender spoofing detected: Display address uses "${fromDomain}" but replies go to "${replyDomain}".` });
  } else if (SUSPICIOUS_DOMAINS.includes(fromDomain)) {
    riskPoints += 40;
    checks.header.status = 'fail';
    checks.header.detail = `Lookalike domain detected: ${fromDomain}`;
    reasons.push({ severity: 'high', text: `Lookalike domain: "${fromDomain}" mimics a well-known brand.` });
  } else {
    checks.header.detail = 'From and Reply-To domains match — no spoofing detected.';
  }

  // ── 2. SPF/DKIM/DMARC SIMULATION ────────────────────────
  // In production: parse email headers or call a real DNS/auth API
  const isTrustedDomain = TRUSTED_DOMAINS.includes(fromDomain);
  const authScore = isTrustedDomain
    ? Math.random() > 0.05  // 95% pass rate for trusted domains
    : Math.random() > 0.55; // 45% pass rate for unknown domains

  if (!authScore) {
    const spfFailed  = Math.random() > 0.5;
    const dkimFailed = Math.random() > 0.5;

    if (spfFailed) {
      riskPoints += 15;
      checks.spf.status = 'fail';
      checks.spf.detail = 'SPF record not found or does not authorize this sender.';
      reasons.push({ severity: 'medium', text: 'SPF check failed: This server is not authorized to send mail for this domain.' });
    } else {
      checks.spf.detail = 'SPF record found and authorized.';
    }

    if (dkimFailed) {
      riskPoints += 15;
      checks.dkim.status = 'fail';
      checks.dkim.detail = 'DKIM signature missing or invalid — email may have been tampered with.';
      reasons.push({ severity: 'medium', text: 'DKIM signature is missing or invalid — email integrity cannot be confirmed.' });
    } else {
      checks.dkim.detail = 'DKIM signature is valid and verified.';
    }

    if (spfFailed && dkimFailed) {
      riskPoints += 10;
      checks.dmarc.status = 'fail';
      checks.dmarc.detail = 'DMARC policy failed — domain owner has not authenticated this email.';
      reasons.push({ severity: 'high', text: 'DMARC policy failed: The sending domain explicitly does not authorize this email.' });
    } else {
      checks.dmarc.detail = 'DMARC policy check passed.';
    }
  } else {
    checks.spf.detail   = 'SPF record found and authorized.';
    checks.dkim.detail  = 'DKIM signature verified and intact.';
    checks.dmarc.detail = 'DMARC policy passed.';
  }

  // ── 3. CONTENT BODY ANALYSIS ────────────────────────────
  const bodyLower = (emailData.body || '').toLowerCase();
  const subjectLower = (emailData.subject || '').toLowerCase();
  const combined = bodyLower + ' ' + subjectLower;

  const foundKeywords = FRAUD_KEYWORDS.filter(kw => combined.includes(kw));
  if (foundKeywords.length >= 4) {
    riskPoints += 20;
    checks.body.status = 'fail';
    checks.body.detail = `${foundKeywords.length} high-risk phrases detected in email content.`;
    reasons.push({ severity: 'high', text: `High-urgency language detected: "${foundKeywords.slice(0, 3).join('", "')}" and ${foundKeywords.length - 3} more red-flag phrases.` });
  } else if (foundKeywords.length >= 1) {
    riskPoints += foundKeywords.length * 4;
    checks.body.status = 'warn';
    checks.body.detail = `Suspicious phrases found: "${foundKeywords.join('", "')}"`;
    reasons.push({ severity: 'low', text: `Caution: Email contains ${foundKeywords.length} potentially manipulative phrase(s): "${foundKeywords.join('", "')}".` });
  } else {
    checks.body.detail = 'No high-risk phrases or urgency language detected.';
  }

  // ── 4. LINK ANALYSIS ────────────────────────────────────
  const links = emailData.links || [];
  const suspiciousLinks = links.filter(link => {
    const domain = extractDomain(link);
    return SUSPICIOUS_DOMAINS.includes(domain) ||
           (link.includes('http://') && !link.startsWith('https://')) ||
           /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(link); // raw IP
  });

  if (suspiciousLinks.length > 0) {
    riskPoints += 20;
    checks.links.status = 'fail';
    checks.links.detail = `${suspiciousLinks.length} suspicious link(s) found — insecure or lookalike URLs.`;
    reasons.push({ severity: 'high', text: `${suspiciousLinks.length} dangerous link(s) detected — clicking may redirect to phishing sites.` });
  } else if (links.length === 0) {
    checks.links.detail = 'No external links present in this email.';
  } else {
    checks.links.detail = `All ${links.length} link(s) use HTTPS and appear legitimate.`;
  }

  // ── FINAL SCORING ────────────────────────────────────────
  const riskScore   = Math.min(riskPoints, MAX_POINTS);
  const safeScore   = 100 - riskScore;

  let verdict, dotColor, scoreLabel;
  if (riskScore >= 60) {
    verdict    = 'FRAUD';
    dotColor   = 'red';
    scoreLabel = `${riskScore}% High Risk`;
  } else if (riskScore >= 30) {
    verdict    = 'SUSPICIOUS';
    dotColor   = 'orange';
    scoreLabel = `${riskScore}% Suspicious`;
  } else {
    verdict    = 'SAFE';
    dotColor   = 'green';
    scoreLabel = `${safeScore}% Safe`;
  }

  if (reasons.length === 0) {
    reasons.push({ severity: 'none', text: 'No fraud indicators detected. All authentication checks passed.' });
  }

  return { score: safeScore, riskScore, verdict, dotColor, scoreLabel, reasons, checks };
}

// ── Utility ──────────────────────────────────────────────────
function extractDomain(emailOrUrl) {
  if (!emailOrUrl) return '';
  if (emailOrUrl.includes('@')) return emailOrUrl.split('@')[1]?.toLowerCase().trim() || '';
  try {
    return new URL(emailOrUrl).hostname.replace('www.', '').toLowerCase();
  } catch {
    return emailOrUrl.toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  }
}

// ── Message Handler ──────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ANALYZE_EMAIL') {
    // ── INTEGRATION POINT ──
    // To use a real API, replace this block:
    //
    // fetch('https://your-api.com/analyze', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(message.emailData)
    // })
    // .then(r => r.json())
    // .then(result => sendResponse({ success: true, result }))
    // .catch(err => sendResponse({ success: false, error: err.message }));
    // return true; // keep channel open for async
    //
    // ────────────────────────────────
    try {
      const result = analyzeEmail(message.emailData);
      sendResponse({ success: true, result });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  }

  if (message.type === 'STORE_RESULT') {
    chrome.storage.local.set({ lastAnalysis: message.data });
    sendResponse({ success: true });
  }

  if (message.type === 'GET_RESULT') {
    chrome.storage.local.get(['lastAnalysis'], (data) => {
      sendResponse({ success: true, data: data.lastAnalysis || null });
    });
    return true;
  }

  return true;
});