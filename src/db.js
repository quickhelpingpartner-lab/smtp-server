const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

const getDefaultState = () => {
  const today = new Date().toISOString().split('T')[0];
  return {
    accounts: [
      {
        id: 'acc_1',
        email: process.env.GMAIL_1_EMAIL || 'quickhelpingpartner@gmail.com',
        pass: process.env.GMAIL_1_PASS || 'fibocglzwxuoymsr',
        maxDaily: parseInt(process.env.GMAIL_1_LIMIT || '500', 10),
        sentToday: 0,
        totalSent: 0,
        lastResetDate: today,
        active: true,
        status: 'ready',
        lastError: null,
        createdAt: new Date().toISOString()
      },
      {
        id: 'acc_2',
        email: process.env.GMAIL_2_EMAIL || 'useasonline@gmail.com',
        pass: process.env.GMAIL_2_PASS || 'zcrnwfpormuijhig',
        maxDaily: parseInt(process.env.GMAIL_2_LIMIT || '500', 10),
        sentToday: 0,
        totalSent: 0,
        lastResetDate: today,
        active: true,
        status: 'ready',
        lastError: null,
        createdAt: new Date().toISOString()
      }
    ],
    apiKeys: [
      {
        id: 'key_master_default',
        name: 'Master Website Key',
        key: 'smtp_live_master_key_1000',
        active: true,
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
        usageCount: 0
      }
    ],
    logs: []
  };
};

// Ensure data directory and db file exist
function initDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
    const defaultData = getDefaultState();
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultData, null, 2), 'utf8');
    return defaultData;
  }

  // Read existing and check date reset
  const data = readDb();
  checkAndResetDailyQuotas(data);
  return data;
}

function readDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return initDb();
    }
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const data = JSON.parse(raw);
    return data;
  } catch (err) {
    console.error('Error reading database file, resetting to default:', err);
    return getDefaultState();
  }
}

function writeDb(data) {
  try {
    const tempPath = DB_PATH + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempPath, DB_PATH);
  } catch (err) {
    console.error('Error saving database:', err);
  }
}

function checkAndResetDailyQuotas(data) {
  const today = new Date().toISOString().split('T')[0];
  let modified = false;

  data.accounts.forEach(acc => {
    if (acc.lastResetDate !== today) {
      acc.sentToday = 0;
      acc.lastResetDate = today;
      if (acc.status === 'quota_exceeded') {
        acc.status = 'ready';
      }
      modified = true;
    }
  });

  if (modified) {
    writeDb(data);
  }
}

// Account operations
function getAccounts() {
  const data = readDb();
  checkAndResetDailyQuotas(data);
  return data.accounts;
}

function saveAccount(accData) {
  const data = readDb();
  const index = data.accounts.findIndex(a => a.id === accData.id);
  const today = new Date().toISOString().split('T')[0];

  if (index >= 0) {
    data.accounts[index] = { ...data.accounts[index], ...accData };
  } else {
    const newAcc = {
      id: 'acc_' + Date.now(),
      email: accData.email,
      pass: accData.pass,
      maxDaily: parseInt(accData.maxDaily || 500, 10),
      sentToday: 0,
      totalSent: 0,
      lastResetDate: today,
      active: true,
      status: 'ready',
      lastError: null,
      createdAt: new Date().toISOString()
    };
    data.accounts.push(newAcc);
  }
  writeDb(data);
  return data.accounts;
}

function updateAccountQuota(accId, increment = 1, error = null) {
  const data = readDb();
  const acc = data.accounts.find(a => a.id === accId);
  if (acc) {
    if (error) {
      acc.lastError = error;
      acc.status = 'error';
    } else {
      acc.sentToday += increment;
      acc.totalSent += increment;
      acc.lastError = null;
      if (acc.sentToday >= acc.maxDaily) {
        acc.status = 'quota_exceeded';
      } else {
        acc.status = 'ready';
      }
    }
    writeDb(data);
  }
}

function toggleAccountStatus(accId, active) {
  const data = readDb();
  const acc = data.accounts.find(a => a.id === accId);
  if (acc) {
    acc.active = active;
    writeDb(data);
  }
  return data.accounts;
}

function deleteAccount(accId) {
  const data = readDb();
  data.accounts = data.accounts.filter(a => a.id !== accId);
  writeDb(data);
  return data.accounts;
}

// API Key operations
function getApiKeys() {
  const data = readDb();
  return data.apiKeys;
}

function validateApiKey(keyString) {
  if (!keyString) return null;
  const data = readDb();
  const keyObj = data.apiKeys.find(k => k.key === keyString && k.active);
  if (keyObj) {
    keyObj.lastUsedAt = new Date().toISOString();
    keyObj.usageCount = (keyObj.usageCount || 0) + 1;
    writeDb(data);
    return keyObj;
  }
  return null;
}

function createApiKey(name) {
  const data = readDb();
  const randomBytes = crypto.randomBytes(16).toString('hex');
  const newKey = {
    id: 'key_' + Date.now(),
    name: name || 'Website API Key',
    key: `smtp_live_${randomBytes}`,
    active: true,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    usageCount: 0
  };
  data.apiKeys.push(newKey);
  writeDb(data);
  return newKey;
}

function toggleApiKey(keyId, active) {
  const data = readDb();
  const keyObj = data.apiKeys.find(k => k.id === keyId);
  if (keyObj) {
    keyObj.active = active;
    writeDb(data);
  }
  return data.apiKeys;
}

function deleteApiKey(keyId) {
  const data = readDb();
  data.apiKeys = data.apiKeys.filter(k => k.id !== keyId);
  writeDb(data);
  return data.apiKeys;
}

// Logging operations
function addLog(logEntry) {
  const data = readDb();
  const newLog = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    timestamp: new Date().toISOString(),
    recipient: logEntry.recipient,
    subject: logEntry.subject,
    status: logEntry.status, // 'success' | 'failed'
    accountUsed: logEntry.accountUsed || 'N/A',
    type: logEntry.type || 'email', // 'otp' | 'email'
    error: logEntry.error || null,
    apiKeyName: logEntry.apiKeyName || 'Master'
  };

  // Keep last 1000 logs
  data.logs.unshift(newLog);
  if (data.logs.length > 1000) {
    data.logs = data.logs.slice(0, 1000);
  }

  writeDb(data);
  return newLog;
}

function getLogs(limit = 100) {
  const data = readDb();
  return data.logs.slice(0, limit);
}

// Aggregated Stats
function getStats() {
  const data = readDb();
  checkAndResetDailyQuotas(data);

  let totalDailyQuota = 0;
  let totalDailySent = 0;
  let totalAllTimeSent = 0;

  data.accounts.forEach(acc => {
    if (acc.active) {
      totalDailyQuota += acc.maxDaily;
      totalDailySent += acc.sentToday;
    }
    totalAllTimeSent += acc.totalSent;
  });

  const totalLogs = data.logs.length;
  const successLogs = data.logs.filter(l => l.status === 'success').length;
  const successRate = totalLogs > 0 ? Math.round((successLogs / totalLogs) * 100) : 100;

  return {
    totalDailyQuota,
    totalDailySent,
    remainingDailyQuota: Math.max(0, totalDailyQuota - totalDailySent),
    totalAllTimeSent,
    activeAccountsCount: data.accounts.filter(a => a.active).length,
    activeKeysCount: data.apiKeys.filter(k => k.active).length,
    successRate,
    accounts: data.accounts.map(a => ({
      id: a.id,
      email: a.email,
      sentToday: a.sentToday,
      maxDaily: a.maxDaily,
      totalSent: a.totalSent,
      active: a.active,
      status: a.status,
      lastError: a.lastError
    }))
  };
}

module.exports = {
  initDb,
  getAccounts,
  saveAccount,
  updateAccountQuota,
  toggleAccountStatus,
  deleteAccount,
  getApiKeys,
  validateApiKey,
  createApiKey,
  toggleApiKey,
  deleteApiKey,
  addLog,
  getLogs,
  getStats
};
