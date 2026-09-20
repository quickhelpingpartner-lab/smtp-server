// Global state
let currentStats = null;
let currentAccounts = [];
let currentKeys = [];
let masterApiKey = 'smtp_live_master_key_1000';
let activeSnippetLang = 'js';

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  fetchDashboardData();
  // Auto refresh stats every 15 seconds
  setInterval(fetchDashboardData, 15000);
});

// Navigation Handling
function initNavigation() {
  const navButtons = document.querySelectorAll('.nav-item');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      switchTab(tab);
    });
  });
}

function switchTab(tabId) {
  // Update sidebar active button
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabId}`);
  });

  // Update header text based on tab
  const titleMap = {
    dashboard: { title: 'Overview Dashboard', sub: 'Monitor daily quota usage, email rotation, and website API calls.' },
    apikeys: { title: 'API Keys Management', sub: 'Generate and manage API authentication tokens for all your websites.' },
    accounts: { title: 'Gmail Accounts & Quotas', sub: 'Configure sending accounts and view daily limit load balancing.' },
    tester: { title: 'Live Email / OTP Tester', sub: 'Send test messages directly using your SMTP relay service.' },
    logs: { title: 'Delivery Audit Logs', sub: 'Full history of dispatched emails and status responses.' },
    snippets: { title: 'Website Integration Code', sub: 'Copy-paste ready code snippets for your frontend or backend apps.' }
  };

  if (titleMap[tabId]) {
    document.getElementById('pageTitle').innerText = titleMap[tabId].title;
    document.getElementById('pageSubtitle').innerText = titleMap[tabId].sub;
  }

  // Load specific tab data
  if (tabId === 'dashboard') fetchDashboardData();
  if (tabId === 'apikeys') fetchApiKeys();
  if (tabId === 'accounts') fetchAccounts();
  if (tabId === 'logs') fetchLogs();
  if (tabId === 'snippets') renderCodeSnippet();
}

// Data Fetchers
async function fetchDashboardData() {
  try {
    const [statsRes, accountsRes, logsRes, keysRes] = await Promise.all([
      fetch('/api/admin/stats'),
      fetch('/api/admin/accounts'),
      fetch('/api/admin/logs?limit=5'),
      fetch('/api/admin/keys')
    ]);

    const statsData = await statsRes.json();
    const accountsData = await accountsRes.json();
    const logsData = await logsRes.json();
    const keysData = await keysRes.json();

    if (statsData.success) {
      currentStats = statsData.data;
      renderStats(statsData.data);
    }

    if (accountsData.success) {
      currentAccounts = accountsData.data;
      renderDashboardAccounts(accountsData.data);
      renderFullAccounts(accountsData.data);
    }

    if (logsData.success) {
      renderRecentLogs(logsData.data);
    }

    if (keysData.success) {
      currentKeys = keysData.data;
      if (keysData.data.length > 0) {
        masterApiKey = keysData.data[0].key;
        document.getElementById('dashboardMasterKeyDisplay').innerText = masterApiKey;
      }
    }
  } catch (err) {
    console.error('Error fetching dashboard data:', err);
  }
}

// Render Dashboard Metrics
function renderStats(stats) {
  document.getElementById('statSentToday').innerText = stats.totalDailySent;
  document.getElementById('statRemainingQuota').innerText = stats.remainingDailyQuota;
  document.getElementById('statActiveAccounts').innerText = `${stats.activeAccountsCount} / ${stats.accounts.length}`;
  document.getElementById('statSuccessRate').innerText = `${stats.successRate}%`;
  document.getElementById('statTotalAllTime').innerText = `${stats.totalAllTimeSent} Total Emails Logged`;

  const sentPct = stats.totalDailyQuota > 0 ? Math.min(100, Math.round((stats.totalDailySent / stats.totalDailyQuota) * 100)) : 0;
  document.getElementById('statSentTodayProgress').style.width = `${sentPct}%`;
  document.getElementById('statSentTodaySub').innerText = `${stats.totalDailySent} / ${stats.totalDailyQuota} Mails Sent Today`;
  document.getElementById('sidebarQuotaPill').innerText = `${stats.remainingDailyQuota} Mails Left Today`;
}

// Render Account Cards
function renderDashboardAccounts(accounts) {
  const container = document.getElementById('dashboardAccountsGrid');
  if (!container) return;

  container.innerHTML = accounts.map(acc => {
    const pct = Math.min(100, Math.round((acc.sentToday / acc.maxDaily) * 100));
    let badgeClass = 'badge-ready';
    let statusText = 'Ready / Active';

    if (!acc.active) {
      badgeClass = 'badge-disabled';
      statusText = 'Disabled';
    } else if (acc.status === 'quota_exceeded') {
      badgeClass = 'badge-quota';
      statusText = 'Quota Reached (500)';
    } else if (acc.status === 'error') {
      badgeClass = 'badge-error';
      statusText = 'Connection Issue';
    }

    return `
      <div class="account-card">
        <div class="account-card-header">
          <div class="account-email-info">
            <h4>${escapeHtml(acc.email)}</h4>
            <span class="account-stats-row">SMTP Provider: <strong>Gmail SSL (Port 465)</strong></span>
          </div>
          <span class="account-badge ${badgeClass}">${statusText}</span>
        </div>

        <div class="account-stats-row">
          <span>Daily Mails Sent:</span>
          <strong>${acc.sentToday} / ${acc.maxDaily}</strong>
        </div>

        <div class="progress-bar-container" style="margin-bottom: 12px;">
          <div class="progress-bar-fill" style="width: ${pct}%;"></div>
        </div>

        <div class="account-stats-row">
          <span>All-time Sent: <strong>${acc.totalSent}</strong></span>
          <span>Resets: <strong>Midnight</strong></span>
        </div>
      </div>
    `;
  }).join('');
}

function renderFullAccounts(accounts) {
  const container = document.getElementById('fullAccountsGrid');
  if (!container) return;

  container.innerHTML = accounts.map(acc => {
    const pct = Math.min(100, Math.round((acc.sentToday / acc.maxDaily) * 100));
    let badgeClass = 'badge-ready';
    let statusText = 'Ready / Active';

    if (!acc.active) {
      badgeClass = 'badge-disabled';
      statusText = 'Disabled';
    } else if (acc.status === 'quota_exceeded') {
      badgeClass = 'badge-quota';
      statusText = 'Quota Reached';
    } else if (acc.status === 'error') {
      badgeClass = 'badge-error';
      statusText = 'Error';
    }

    return `
      <div class="account-card">
        <div class="account-card-header">
          <div class="account-email-info">
            <h4>${escapeHtml(acc.email)}</h4>
            <span style="font-size: 11px; color: var(--text-dim);">App Password: ••••••••••••••••</span>
          </div>
          <span class="account-badge ${badgeClass}">${statusText}</span>
        </div>

        <div class="account-stats-row">
          <span>Daily Usage:</span>
          <strong>${acc.sentToday} / ${acc.maxDaily} (${pct}%)</strong>
        </div>

        <div class="progress-bar-container" style="margin-bottom: 12px;">
          <div class="progress-bar-fill" style="width: ${pct}%;"></div>
        </div>

        ${acc.lastError ? `<div style="font-size: 11px; color: var(--rose); margin-bottom: 10px; background: rgba(244,63,94,0.1); padding: 6px; border-radius: 4px;">⚠️ ${escapeHtml(acc.lastError)}</div>` : ''}

        <div class="account-actions">
          <button class="btn btn-sm btn-secondary" onclick="testAccountConnection('${acc.email}', '${acc.pass}')">🔌 Test Connection</button>
          <button class="btn btn-sm btn-secondary" onclick="toggleAccount('${acc.id}', ${!acc.active})">${acc.active ? 'Disable' : 'Enable'}</button>
          <button class="btn btn-sm btn-danger" onclick="deleteAccount('${acc.id}')">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

// Render Recent Logs Table
function renderRecentLogs(logs) {
  const tbody = document.getElementById('recentLogsTableBody');
  if (!tbody) return;

  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center">No email logs recorded yet. Send a test OTP to see live logs!</td></tr>`;
    return;
  }

  tbody.innerHTML = logs.map(log => `
    <tr>
      <td>${formatTime(log.timestamp)}</td>
      <td><span class="badge ${log.type === 'otp' ? 'badge-ready' : 'badge-disabled'}">${log.type.toUpperCase()}</span></td>
      <td><strong>${escapeHtml(log.recipient)}</strong></td>
      <td>${escapeHtml(log.subject)}</td>
      <td><code>${escapeHtml(log.accountUsed)}</code></td>
      <td><span class="badge ${log.status === 'success' ? 'badge-success' : 'badge-failed'}">${log.status.toUpperCase()}</span></td>
    </tr>
  `).join('');
}

// API Keys Management
async function fetchApiKeys() {
  try {
    const res = await fetch('/api/admin/keys');
    const data = await res.json();
    if (data.success) {
      currentKeys = data.data;
      renderApiKeysTable(data.data);
    }
  } catch (err) {
    console.error('Error fetching API keys:', err);
  }
}

function renderApiKeysTable(keys) {
  const tbody = document.getElementById('apiKeysTableBody');
  if (!tbody) return;

  if (keys.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center">No API Keys generated yet. Click "Generate New API Key" above.</td></tr>`;
    return;
  }

  tbody.innerHTML = keys.map(key => `
    <tr>
      <td><strong>${escapeHtml(key.name)}</strong></td>
      <td><code>${escapeHtml(key.key)}</code></td>
      <td>${formatDate(key.createdAt)}</td>
      <td>${key.lastUsedAt ? formatTime(key.lastUsedAt) : 'Never'}</td>
      <td>${key.usageCount || 0} calls</td>
      <td><span class="badge ${key.active ? 'badge-success' : 'badge-failed'}">${key.active ? 'ACTIVE' : 'DISABLED'}</span></td>
      <td>
        <button class="btn btn-sm btn-light" onclick="copyToClipboard('${key.key}', 'API Key copied to clipboard!')">Copy Key</button>
        <button class="btn btn-sm btn-secondary" onclick="toggleKeyStatus('${key.id}', ${!key.active})">${key.active ? 'Disable' : 'Enable'}</button>
        <button class="btn btn-sm btn-danger" onclick="deleteApiKey('${key.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

async function handleCreateKey(e) {
  e.preventDefault();
  const name = document.getElementById('newKeyName').value.trim();
  if (!name) return;

  try {
    const res = await fetch('/api/admin/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`API Key "${name}" created!`, 'success');
      closeCreateKeyModal();
      document.getElementById('newKeyName').value = '';
      fetchApiKeys();
      fetchDashboardData();
    }
  } catch (err) {
    showToast('Failed to create API key', 'error');
  }
}

async function toggleKeyStatus(id, active) {
  try {
    await fetch('/api/admin/keys/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, active })
    });
    showToast(`Key status updated`, 'success');
    fetchApiKeys();
  } catch (err) {
    showToast('Failed to update status', 'error');
  }
}

async function deleteApiKey(id) {
  if (!confirm('Are you sure you want to delete this API Key? Websites using it will be blocked.')) return;
  try {
    await fetch(`/api/admin/keys/${id}`, { method: 'DELETE' });
    showToast('API Key deleted', 'success');
    fetchApiKeys();
  } catch (err) {
    showToast('Failed to delete key', 'error');
  }
}

// Accounts Management Modals & Operations
function openAddAccountModal() {
  document.getElementById('accountModalTitle').innerText = 'Add Gmail Account';
  document.getElementById('editAccountId').value = '';
  document.getElementById('accEmail').value = '';
  document.getElementById('accPass').value = '';
  document.getElementById('accMaxDaily').value = '500';
  document.getElementById('accountModal').classList.add('active');
}

function closeAccountModal() {
  document.getElementById('accountModal').classList.remove('active');
}

function openCreateKeyModal() {
  document.getElementById('createKeyModal').classList.add('active');
}

function closeCreateKeyModal() {
  document.getElementById('createKeyModal').classList.remove('active');
}

async function handleSaveAccount(e) {
  e.preventDefault();
  const id = document.getElementById('editAccountId').value;
  const email = document.getElementById('accEmail').value.trim();
  const pass = document.getElementById('accPass').value.trim();
  const maxDaily = parseInt(document.getElementById('accMaxDaily').value, 10);

  try {
    const res = await fetch('/api/admin/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, email, pass, maxDaily })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Account saved successfully', 'success');
      closeAccountModal();
      fetchDashboardData();
    } else {
      showToast(data.error || 'Failed to save account', 'error');
    }
  } catch (err) {
    showToast('Network error saving account', 'error');
  }
}

async function testAccountConnection(email, pass) {
  showToast(`Testing SMTP connection for ${email}...`, 'info');
  try {
    const res = await fetch('/api/admin/accounts/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, pass })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`✅ ${email}: Connection Successful!`, 'success');
    } else {
      showToast(`❌ ${email}: ${data.message}`, 'error');
    }
  } catch (err) {
    showToast('Failed to connect to SMTP server', 'error');
  }
}

async function toggleAccount(id, active) {
  try {
    await fetch('/api/admin/accounts/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, active })
    });
    showToast('Account status updated', 'success');
    fetchDashboardData();
  } catch (err) {
    showToast('Failed to toggle account', 'error');
  }
}

async function deleteAccount(id) {
  if (!confirm('Are you sure you want to remove this Gmail account?')) return;
  try {
    await fetch(`/api/admin/accounts/${id}`, { method: 'DELETE' });
    showToast('Account removed', 'success');
    fetchDashboardData();
  } catch (err) {
    showToast('Failed to remove account', 'error');
  }
}

// Live Tester Handler
function toggleTestFormMode() {
  const isOtp = document.querySelector('input[name="dispatchType"]:checked').value === 'otp';
  document.getElementById('otpFields').style.display = isOtp ? 'block' : 'none';
  document.getElementById('customEmailFields').style.display = isOtp ? 'none' : 'block';
}

async function handleSendTest(e) {
  e.preventDefault();
  const to = document.getElementById('testTo').value.trim();
  const isOtp = document.querySelector('input[name="dispatchType"]:checked').value === 'otp';
  const otpCode = document.getElementById('testOtpCode').value.trim();
  const appName = document.getElementById('testAppName').value.trim();
  const subject = document.getElementById('testSubject').value.trim();
  const body = document.getElementById('testBody').value.trim();

  const btnText = document.getElementById('btnTestText');
  const consoleBox = document.getElementById('testResponseConsole');

  btnText.innerText = '⏳ Dispatching Email...';
  consoleBox.innerText = '// Dispatching request via SMTP relay pool...';

  try {
    const res = await fetch('/api/admin/test-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, isOtp, otpCode, appName, subject, body })
    });

    const data = await res.json();
    btnText.innerText = '🚀 Dispatch Test Email';
    consoleBox.innerText = JSON.stringify(data, null, 2);

    if (data.success) {
      showToast(`Email delivered to ${to}!`, 'success');
      fetchDashboardData();
    } else {
      showToast(`Failed: ${data.error}`, 'error');
    }
  } catch (err) {
    btnText.innerText = '🚀 Dispatch Test Email';
    consoleBox.innerText = `// Connection Error: ${err.message}`;
    showToast('Network error dispatching email', 'error');
  }
}

// Full Logs Fetcher
async function fetchLogs() {
  try {
    const res = await fetch('/api/admin/logs?limit=100');
    const data = await res.json();
    if (data.success) {
      const tbody = document.getElementById('allLogsTableBody');
      if (!tbody) return;

      if (data.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center">No logs found.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.data.map(log => `
        <tr>
          <td>${formatTime(log.timestamp)}</td>
          <td><span class="badge ${log.type === 'otp' ? 'badge-ready' : 'badge-disabled'}">${log.type.toUpperCase()}</span></td>
          <td><strong>${escapeHtml(log.recipient)}</strong></td>
          <td>${escapeHtml(log.subject)}</td>
          <td><code>${escapeHtml(log.accountUsed)}</code></td>
          <td>${escapeHtml(log.apiKeyName)}</td>
          <td><span class="badge ${log.status === 'success' ? 'badge-success' : 'badge-failed'}">${log.status.toUpperCase()}</span></td>
          <td style="font-size: 11px; color: var(--rose);">${log.error ? escapeHtml(log.error) : '-'}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Error fetching logs:', err);
  }
}

// Code Snippets Generator
function switchSnippet(lang) {
  activeSnippetLang = lang;
  document.querySelectorAll('.snippet-tab').forEach(tab => {
    tab.classList.toggle('active', tab.innerText.toLowerCase().includes(lang));
  });
  renderCodeSnippet();
}

function renderCodeSnippet() {
  const box = document.getElementById('codeSnippetBox');
  const label = document.getElementById('snippetLangLabel');
  const host = window.location.origin;

  const snippets = {
    js: `// JavaScript (Browser Fetch API)
async function sendOTP(userEmail, otpValue) {
  const response = await fetch('${host}/api/v1/send-otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': '${masterApiKey}' // Your Website API Key
    },
    body: JSON.stringify({
      to: userEmail,
      otpCode: otpValue, // e.g. "849201"
      appName: "My Awesome Website",
      expiresInMinutes: 10
    })
  });

  const result = await response.json();
  if (result.success) {
    console.log("OTP Sent Successfully! Delivered via:", result.data.accountUsed);
  } else {
    console.error("Failed to send OTP:", result.error);
  }
}`,
    nodejs: `// Node.js (Axios or Fetch)
const axios = require('axios');

async function sendOtpNotification(recipient, otpCode) {
  try {
    const res = await axios.post('${host}/api/v1/send-otp', {
      to: recipient,
      otpCode: otpCode,
      appName: 'My Express Web App',
      expiresInMinutes: 5
    }, {
      headers: {
        'x-api-key': '${masterApiKey}'
      }
    });

    console.log('OTP sent successfully:', res.data);
  } catch (err) {
    console.error('SMTP API Error:', err.response ? err.response.data : err.message);
  }
}`,
    python: `# Python (Requests Library)
import requests

def send_otp_email(recipient_email, otp_code):
    url = "${host}/api/v1/send-otp"
    headers = {
        "Content-Type": "application/json",
        "x-api-key": "${masterApiKey}"
    }
    payload = {
        "to": recipient_email,
        "otpCode": otp_code,
        "appName": "My Python Web Service",
        "expiresInMinutes": 10
    }
    
    response = requests.post(url, json=payload, headers=headers)
    return response.json()

# Example usage:
# print(send_otp_email("user@example.com", "492018"))`,
    php: `<?php
// PHP cURL Integration for sending OTPs
function sendOtpEmail($recipient, $otpCode) {
    $url = "${host}/api/v1/send-otp";
    $apiKey = "${masterApiKey}";
    
    $payload = json_encode([
        "to" => $recipient,
        "otpCode" => $otpCode,
        "appName" => "My PHP Website",
        "expiresInMinutes" => 10
    ]);

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'x-api-key: ' . $apiKey
    ]);

    $response = curl_exec($ch);
    curl_close($ch);
    
    return json_decode($response, true);
}
?>`,
    curl: `# cURL Command Line / Terminal Test
curl -X POST "${host}/api/v1/send-otp" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${masterApiKey}" \\
  -d '{
    "to": "testuser@example.com",
    "otpCode": "940182",
    "appName": "Terminal Test",
    "expiresInMinutes": 10
  }'`
  };

  const labels = {
    js: 'JavaScript (Fetch API)',
    nodejs: 'Node.js (Axios)',
    python: 'Python (Requests)',
    php: 'PHP (cURL)',
    curl: 'cURL Command'
  };

  label.innerText = labels[activeSnippetLang] || 'Code Snippet';
  box.innerText = snippets[activeSnippetLang] || snippets.js;
}

function copySnippetCode() {
  const codeText = document.getElementById('codeSnippetBox').innerText;
  copyToClipboard(codeText, 'Code snippet copied to clipboard!');
}

function copyMasterKey() {
  copyToClipboard(masterApiKey, 'Master API Key copied to clipboard!');
}

// Helpers
function copyToClipboard(text, msg) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(msg || 'Copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Failed to copy', 'error');
  });
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span> ${escapeHtml(message)}`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatTime(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ', ' + d.toLocaleDateString();
}

function formatDate(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  return d.toLocaleDateString();
}
