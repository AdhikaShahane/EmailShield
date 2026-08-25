# 🛡️ EmailShield

**EmailShield is a Chrome extension prototype for detecting potentially fraudulent and phishing emails in webmail.**

It analyzes sender information, suspicious domains, email content, links, and email-authentication signals, then presents the result as an explainable risk report.

> **Project Status:** Prototype / Educational Cybersecurity Project  
> The current detection engine is rule-based, and SPF/DKIM/DMARC results are simulated rather than retrieved from live email headers or DNS.

---

## 🎯 Overview

Phishing emails commonly rely on urgency, impersonation, misleading links, and spoofed sender information.

**EmailShield** provides an additional layer of security awareness directly inside the email workflow by identifying potentially suspicious messages and explaining **why** an email received a particular verdict.

The extension is designed to work with Gmail and provides both:

- Risk indicators directly in the inbox
- A detailed security analysis through the browser-extension popup

---

## ✨ Key Features

### 🔍 Email Fraud Detection

Analyzes emails for multiple potential fraud indicators:

- Sender / Reply-To domain mismatch
- Suspicious or lookalike domains
- Fraud-related keywords and phrases
- Suspicious URLs
- Insecure HTTP links
- Raw IP-address links
- Simulated SPF, DKIM and DMARC checks

### 📊 Risk Scoring

Each analyzed email receives a calculated risk assessment:

| Verdict | Meaning |
|---|---|
| 🟢 **SAFE** | Low calculated risk |
| 🟠 **SUSPICIOUS** | Moderate risk indicators detected |
| 🔴 **FRAUD** | High-risk indicators detected |

### 📧 Gmail Integration

EmailShield monitors the Gmail interface and can add a small risk indicator beside emails in the inbox.

Hovering over an indicator provides a quick explanation of the detected risk.

### 🛡️ Security Analysis Dashboard

The browser-extension popup provides:

- Overall risk score
- Security verdict
- Header analysis
- SPF status
- DKIM status
- DMARC status
- Content scan
- Link integrity
- Explanation of detected risk factors

---
<img width="1687" height="816" alt="Image" src="https://github.com/user-attachments/assets/f45a6d25-4cfb-46e6-ab61-8a54a694c61d" />
<img width="462" height="752" alt="Image" src="https://github.com/user-attachments/assets/7bb5e7f7-a468-40dd-a67e-17e636bcfbd3" />
<img width="853" height="793" alt="Image" src="https://github.com/user-attachments/assets/d993faea-00b7-4410-a53d-7653d9560637" />
## 🧠 How It Works

```text
                    ┌──────────────────┐
                    │    Gmail Email   │
                    └────────┬─────────┘
                             │
                             ▼
                  ┌─────────────────────┐
                  │    Content Script   │
                  │                     │
                  │ • Sender            │
                  │ • Subject           │
                  │ • Reply-To          │
                  │ • Email body        │
                  │ • Links             │
                  └──────────┬──────────┘
                             │
                             ▼
                ┌─────────────────────────┐
                │ Background Service      │
                │ Worker                  │
                │                         │
                │ • Spoofing detection    │
                │ • Domain analysis       │
                │ • Keyword analysis      │
                │ • Link analysis         │
                │ • Auth checks           │
                └────────────┬────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │  Risk Scoring  │
                    └───────┬────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
          🟢 SAFE      🟠 SUSPICIOUS   🔴 FRAUD
              │             │             │
              └─────────────┼─────────────┘
                            ▼
                  ┌──────────────────┐
                  │ EmailShield      │
                  │ Security Report  │
                  └──────────────────┘

<img width="853" height="793" alt="Image" src="https://github.com/user-attachments/assets/e0a2eedd-91d5-4b7c-a557-45bd3b865229" />
