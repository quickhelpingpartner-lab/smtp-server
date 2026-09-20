const nodemailer = require('nodemailer');
const db = require('./db');

// Cache transporters by account ID
const transporters = new Map();

function getTransporter(account) {
  // Passwords might contain spaces, e.g. "fibo cglz wxuo ymsr" -> sanitize
  const cleanPass = (account.pass || '').replace(/\s+/g, '');
  
  // Return cached if unchanged
  const cacheKey = `${account.id}_${account.email}_${cleanPass}`;
  if (transporters.has(cacheKey)) {
    return transporters.get(cacheKey);
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // use TLS/SSL
    auth: {
      user: account.email,
      pass: cleanPass
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateLimit: 10 // 10 msgs per sec max to stay safe
  });

  transporters.set(cacheKey, transporter);
  return transporter;
}

// Test SMTP connection for an account
async function verifyAccountConnection(account) {
  try {
    const transporter = getTransporter(account);
    await transporter.verify();
    return { success: true, message: 'SMTP connection verified successfully!' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// Select the next eligible account (load balanced & quota aware)
function getEligibleAccounts() {
  const accounts = db.getAccounts();
  return accounts.filter(acc => {
    return (
      acc.active &&
      acc.sentToday < acc.maxDaily &&
      acc.status !== 'error' &&
      acc.status !== 'quota_exceeded'
    );
  });
}

// Core mail dispatch with automatic rotation & failover
async function sendMail({ to, subject, html, text, type = 'email', apiKeyName = 'Master' }) {
  let eligibleAccounts = getEligibleAccounts();

  if (eligibleAccounts.length === 0) {
    // Retry looking at active accounts that might have recovered or reset status
    const allAccounts = db.getAccounts().filter(a => a.active && a.sentToday < a.maxDaily);
    if (allAccounts.length > 0) {
      eligibleAccounts = allAccounts;
    } else {
      const errorMsg = 'All Gmail accounts have reached their daily quota limit (1,000 mails max/day) or are inactive.';
      db.addLog({
        recipient: to,
        subject,
        status: 'failed',
        accountUsed: 'None',
        type,
        error: errorMsg,
        apiKeyName
      });
      throw new Error(errorMsg);
    }
  }

  // Sort eligible accounts to prioritize the one with lower percentage usage today
  eligibleAccounts.sort((a, b) => (a.sentToday / a.maxDaily) - (b.sentToday / b.maxDaily));

  let lastError = null;

  for (const account of eligibleAccounts) {
    try {
      const transporter = getTransporter(account);
      const mailOptions = {
        from: `"${account.email.split('@')[0]}" <${account.email}>`,
        to,
        subject,
        text: text || html.replace(/<[^>]*>?/gm, ''),
        html
      };

      const info = await transporter.sendMail(mailOptions);

      // Record successful dispatch
      db.updateAccountQuota(account.id, 1, null);
      db.addLog({
        recipient: to,
        subject,
        status: 'success',
        accountUsed: account.email,
        type,
        error: null,
        apiKeyName
      });

      return {
        success: true,
        messageId: info.messageId,
        accountUsed: account.email,
        quotaRemaining: Math.max(0, account.maxDaily - (account.sentToday + 1))
      };
    } catch (err) {
      console.error(`Error sending via ${account.email}:`, err.message);
      db.updateAccountQuota(account.id, 0, err.message);
      lastError = err;
      // Continue loop to try next eligible account
    }
  }

  // If all attempts failed
  const finalErrorMsg = lastError ? lastError.message : 'Failed to send email across all SMTP accounts.';
  db.addLog({
    recipient: to,
    subject,
    status: 'failed',
    accountUsed: 'All Failed',
    type,
    error: finalErrorMsg,
    apiKeyName
  });

  throw new Error(`Email dispatch failed: ${finalErrorMsg}`);
}

// Beautiful OTP Template Generator
function buildOtpEmailHtml({ otpCode, appName = 'Your App', expiresInMinutes = 10, recipientName }) {
  const brandName = appName || 'Web App';
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Code - ${brandName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #0f172a;
      color: #f8fafc;
      margin: 0;
      padding: 0;
    }
    .email-container {
      max-width: 520px;
      margin: 30px auto;
      background: #1e293b;
      border-radius: 16px;
      border: 1px solid #334155;
      overflow: hidden;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .header {
      background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
      padding: 32px 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      color: #ffffff;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    .content {
      padding: 32px 28px;
    }
    .greeting {
      font-size: 16px;
      color: #cbd5e1;
      margin-bottom: 16px;
    }
    .message {
      font-size: 15px;
      line-height: 1.6;
      color: #94a3b8;
      margin-bottom: 24px;
    }
    .otp-card {
      background: #0f172a;
      border: 2px dashed #6366f1;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      margin: 24px 0;
    }
    .otp-code {
      font-family: 'Courier New', Courier, monospace;
      font-size: 38px;
      font-weight: 800;
      letter-spacing: 10px;
      color: #38bdf8;
      margin: 0;
      display: inline-block;
    }
    .otp-expiry {
      font-size: 13px;
      color: #94a3b8;
      margin-top: 10px;
    }
    .warning {
      background: rgba(239, 68, 68, 0.1);
      border-left: 4px solid #ef4444;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 13px;
      color: #fca5a5;
      margin-top: 24px;
    }
    .footer {
      border-top: 1px solid #334155;
      padding: 20px 28px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      background: #111827;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>${brandName}</h1>
    </div>
    <div class="content">
      <div class="greeting">Hello${recipientName ? ' ' + recipientName : ''},</div>
      <div class="message">
        Use the One-Time Password (OTP) below to authenticate your request on <strong>${brandName}</strong>.
      </div>
      
      <div class="otp-card">
        <div class="otp-code">${otpCode}</div>
        <div class="otp-expiry">⏱️ Valid for <strong>${expiresInMinutes} minutes</strong></div>
      </div>

      <div class="warning">
        🔒 <strong>Security Warning:</strong> Never share this code with anyone. Our support team will never ask for your verification code.
      </div>
    </div>
    <div class="footer">
      This is an automated message sent via your self-hosted SMTP Gateway.
    </div>
  </div>
</body>
</html>
  `;
}

module.exports = {
  verifyAccountConnection,
  sendMail,
  buildOtpEmailHtml
};
