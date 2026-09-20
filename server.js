const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./src/db');
const apiRoutes = require('./src/routes/api');
const adminRoutes = require('./src/routes/admin');

db.initDb();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/v1', apiRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 SMTP Server running on port ${PORT}`);
  });
}

module.exports = app;
