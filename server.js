const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./src/db');
const apiRoutes = require('./src/routes/api');
const adminRoutes = require('./src/routes/admin');

// Initialize database & quotas
db.initDb();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Web Admin Dashboard
app.use(express.static(path.join(__dirname, 'public')));

// Mount API Endpoints
app.use('/api/v1', apiRoutes);
app.use('/api/admin', adminRoutes);

// Fallback to serve dashboard index.html for unknown routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Express Server
app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 SMTP Relay Server is running on http://localhost:${PORT}`);
  console.log(`📊 Admin Dashboard: http://localhost:${PORT}`);
  console.log(`🔑 Master API Key: smtp_live_master_key_1000`);
  console.log(`📧 Gmail Account 1: quickhelpingpartner@gmail.com (Limit: 500/day)`);
  console.log(`📧 Gmail Account 2: useasonline@gmail.com (Limit: 500/day)`);
  console.log(`⚡ Total Daily Quota: 1,000 Mails/Day`);
  console.log('====================================================');
});
