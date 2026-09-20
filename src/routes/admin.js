const express = require('express');
const router = express.Router();
const db = require('../db');
const mailer = require('../mailer');

// Dashboard statistics
router.get('/stats', (req, res) => {
  const stats = db.getStats();
  res.json({ success: true, data: stats });
});

// Email Accounts Management
router.get('/accounts', (req, res) => {
  const accounts = db.getAccounts();
  res.json({ success: true, data: accounts });
});

router.post('/accounts', (req, res) => {
  const { id, email, pass, maxDaily } = req.body;
  if (!email || !pass) {
    return res.status(400).json({ success: false, error: 'Email and App Password are required.' });
  }

  const updatedAccounts = db.saveAccount({ id, email, pass, maxDaily });
  res.json({ success: true, message: 'Account saved successfully', data: updatedAccounts });
});

router.post('/accounts/test', async (req, res) => {
  const { email, pass } = req.body;
  if (!email || !pass) {
    return res.status(400).json({ success: false, error: 'Email and Pass are required for testing.' });
  }

  const result = await mailer.verifyAccountConnection({ id: 'temp_test', email, pass });
  res.json(result);
});

router.post('/accounts/toggle', (req, res) => {
  const { id, active } = req.body;
  const accounts = db.toggleAccountStatus(id, active);
  res.json({ success: true, data: accounts });
});

router.delete('/accounts/:id', (req, res) => {
  const accounts = db.deleteAccount(req.params.id);
  res.json({ success: true, data: accounts });
});

// API Keys Management
router.get('/keys', (req, res) => {
  const keys = db.getApiKeys();
  res.json({ success: true, data: keys });
});

router.post('/keys', (req, res) => {
  const { name } = req.body;
  const newKey = db.createApiKey(name);
  res.json({ success: true, message: 'API Key generated successfully', data: newKey });
});

router.post('/keys/toggle', (req, res) => {
  const { id, active } = req.body;
  const keys = db.toggleApiKey(id, active);
  res.json({ success: true, data: keys });
});

router.delete('/keys/:id', (req, res) => {
  const keys = db.deleteApiKey(req.params.id);
  res.json({ success: true, data: keys });
});

// Delivery Logs
router.get('/logs', (req, res) => {
  const limit = parseInt(req.query.limit || '100', 10);
  const logs = db.getLogs(limit);
  res.json({ success: true, data: logs });
});

// Live Email / OTP Tester directly from Dashboard
router.post('/test-send', async (req, res) => {
  try {
    const { to, otpCode, appName, isOtp, subject, body } = req.body;
    if (!to) {
      return res.status(400).json({ success: false, error: 'Recipient email "to" is required.' });
    }

    let result;
    if (isOtp) {
      const code = otpCode || Math.floor(100000 + Math.random() * 900000).toString();
      const htmlContent = mailer.buildOtpEmailHtml({
        otpCode: code,
        appName: appName || 'SMTP Admin Test',
        expiresInMinutes: 10
      });

      result = await mailer.sendMail({
        to,
        subject: subject || `Your OTP Code is ${code}`,
        html: htmlContent,
        type: 'otp',
        apiKeyName: 'Admin Dashboard Test'
      });
    } else {
      result = await mailer.sendMail({
        to,
        subject: subject || 'Test Email from SMTP Server',
        html: body || '<h1>Test Email</h1><p>Your SMTP Relay server is working perfectly!</p>',
        type: 'email',
        apiKeyName: 'Admin Dashboard Test'
      });
    }

    res.json({
      success: true,
      message: 'Test email sent successfully!',
      data: result
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
