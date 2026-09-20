const express = require('express');
const router = express.Router();
const db = require('../db');
const mailer = require('../mailer');

// Middleware to verify API Key for incoming website requests
function verifyApiKey(req, res, next) {
  const apiKey =
    req.headers['x-api-key'] ||
    (req.headers['authorization'] ? req.headers['authorization'].replace('Bearer ', '') : null) ||
    req.query.api_key ||
    (req.body && req.body.api_key);

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Missing API Key. Provide it via "x-api-key" header or Bearer token.'
    });
  }

  const validKey = db.validateApiKey(apiKey);
  if (!validKey) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Invalid or inactive API Key.'
    });
  }

  req.apiKey = validKey;
  next();
}

// Health & Quota status endpoint
router.get('/health', (req, res) => {
  const stats = db.getStats();
  res.json({
    status: 'online',
    service: 'SMTP OTP Gateway',
    timestamp: new Date().toISOString(),
    remainingDailyQuota: stats.remainingDailyQuota,
    totalDailyQuota: stats.totalDailyQuota,
    activeAccounts: stats.activeAccountsCount
  });
});

// Dedicated OTP Sending Endpoint
router.post('/send-otp', verifyApiKey, async (req, res) => {
  try {
    const { to, otpCode, appName, expiresInMinutes, subject, recipientName } = req.body;

    if (!to || !otpCode) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: "to" and "otpCode" are required.'
      });
    }

    const emailSubject = subject || `${otpCode} is your ${appName || 'Verification'} Code`;
    const htmlContent = mailer.buildOtpEmailHtml({
      otpCode,
      appName: appName || 'Web App',
      expiresInMinutes: expiresInMinutes || 10,
      recipientName
    });

    const result = await mailer.sendMail({
      to,
      subject: emailSubject,
      html: htmlContent,
      type: 'otp',
      apiKeyName: req.apiKey.name
    });

    res.json({
      success: true,
      message: 'OTP email sent successfully',
      data: {
        recipient: to,
        accountUsed: result.accountUsed,
        quotaRemaining: result.quotaRemaining,
        messageId: result.messageId
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// General Custom Email Endpoint
router.post('/send-email', verifyApiKey, async (req, res) => {
  try {
    const { to, subject, html, text } = req.body;

    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: "to", "subject", and ("html" or "text") are required.'
      });
    }

    const result = await mailer.sendMail({
      to,
      subject,
      html: html || `<p>${text}</p>`,
      text,
      type: 'email',
      apiKeyName: req.apiKey.name
    });

    res.json({
      success: true,
      message: 'Email sent successfully',
      data: {
        recipient: to,
        accountUsed: result.accountUsed,
        quotaRemaining: result.quotaRemaining,
        messageId: result.messageId
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
