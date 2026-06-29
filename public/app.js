// Stock Tracker - Frontend Application Logic

const API_BASE = '/api';

// --- Current user state ---
let currentUserId = localStorage.getItem('selectedUserId') || null;
let cachedUsers = [];

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function setAvatarUser(user) {
  const btn = document.getElementById('user-initials');
  if (btn && user) btn.textContent = getInitials(user.name);
}

function toggleUserMenu() {
  const menu = document.getElementById('user-menu');
  if (menu) menu.classList.toggle('hidden');
}

async function loadUsers() {
  try {
    const res = await fetch(`${API_BASE}/users`);
    if (!res.ok) return;
    cachedUsers = await res.json();
    if (!cachedUsers.length) return;

    // Default to stored user or first user
    if (!currentUserId || !cachedUsers.find(u => u.id === currentUserId)) {
      currentUserId = cachedUsers[0].id;
      localStorage.setItem('selectedUserId', currentUserId);
    }

    // Render avatar for current user
    setAvatarUser(cachedUsers.find(u => u.id === currentUserId));

    // Render menu list
    const list = document.getElementById('user-menu-list');
    if (list) {
      list.innerHTML = cachedUsers.map(u => `
        <button onclick="switchUser('${u.id}')" class="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-700/50 transition-colors ${u.id === currentUserId ? 'text-emerald-400 font-semibold' : 'text-gray-200'}">
          <span class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${u.id === currentUserId ? 'bg-emerald-600' : 'bg-gray-600'}">${getInitials(u.name)}</span>
          ${u.name}
        </button>
      `).join('');
    }
  } catch {}
}

function switchUser(userId) {
  currentUserId = userId;
  localStorage.setItem('selectedUserId', userId);
  const user = cachedUsers.find(u => u.id === userId);
  setAvatarUser(user);
  // Re-render menu to update active state
  const list = document.getElementById('user-menu-list');
  if (list) {
    list.innerHTML = cachedUsers.map(u => `
      <button onclick="switchUser('${u.id}')" class="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-700/50 transition-colors ${u.id === currentUserId ? 'text-emerald-400 font-semibold' : 'text-gray-200'}">
        <span class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${u.id === currentUserId ? 'bg-emerald-600' : 'bg-gray-600'}">${getInitials(u.name)}</span>
        ${u.name}
      </button>
    `).join('');
  }
  document.getElementById('user-menu')?.classList.add('hidden');
  loadDashboard();
}

// --- API helpers ---
async function apiStockLookup(ticker) {
  const res = await fetch(`${API_BASE}/stock-lookup/${encodeURIComponent(ticker)}`);
  if (!res.ok) return null;
  return res.json();
}

async function apiStockSearch(query) {
  const res = await fetch(`${API_BASE}/stock-search?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  return res.json();
}

async function apiExchangeRate(currency) {
  const res = await fetch(`${API_BASE}/exchange-rate/${currency}`);
  if (!res.ok) return { currency, rate: 1 };
  return res.json();
}

async function apiGetTransactions() {
  const params = currentUserId ? `?user_id=${encodeURIComponent(currentUserId)}` : '';
  const res = await fetch(`${API_BASE}/transactions${params}`);
  const data = await res.json();
  return data.transactions || [];
}

async function apiAddTransaction(payload) {
  const res = await fetch(`${API_BASE}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, user_id: currentUserId })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to add transaction.');
  }
  return res.json();
}

async function apiDeleteTransaction(id) {
  const res = await fetch(`${API_BASE}/transactions/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete');
}

async function apiChandelierExit(tickers) {
  const res = await fetch(`${API_BASE}/chandelier-exit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tickers })
  });
  if (!res.ok) return [];
  return res.json();
}

async function apiAddToWatchlist(ticker) {
  const res = await fetch(`${API_BASE}/watchlist/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker })
  });
  if (!res.ok) throw new Error('Failed to add to watchlist');
  return res.json();
}

async function apiMovingAverage(ticker, periods = '20,44') {
  const res = await fetch(`${API_BASE}/moving-average/${encodeURIComponent(ticker)}?periods=${periods}`);
  if (!res.ok) return null;
  return res.json();
}

async function apiStockFundamentals(ticker) {
  const res = await fetch(`${API_BASE}/stock-fundamentals/${encodeURIComponent(ticker)}`);
  if (!res.ok) return null;
  return res.json();
}

// --- Toast Notifications ---
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  const bgClass = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-rose-600' : 'bg-yellow-600';
  toast.className = `${bgClass} text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium transform transition-all duration-300 translate-x-0 opacity-100`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-x-4');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// --- Transaction Panel Toggle ---
function toggleTransactionPanel() {
  const panel = document.getElementById('transaction-panel');
  const overlay = document.getElementById('panel-overlay');
  const isOpen = !panel.classList.contains('-translate-x-full');
  if (isOpen) {
    panel.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
  } else {
    panel.classList.remove('-translate-x-full');
    overlay.classList.remove('hidden');
  }
}

// Format number in Indian numbering system (xx,xx,xxx.xx)
function formatINR(num) {
  const isNegative = num < 0;
  const abs = Math.abs(num);
  const [intPart, decPart] = abs.toFixed(2).split('.');

  // Indian grouping: last 3 digits, then groups of 2
  let formatted = '';
  if (intPart.length <= 3) {
    formatted = intPart;
  } else {
    formatted = intPart.slice(-3);
    let remaining = intPart.slice(0, -3);
    while (remaining.length > 2) {
      formatted = remaining.slice(-2) + ',' + formatted;
      remaining = remaining.slice(0, -2);
    }
    if (remaining.length > 0) {
      formatted = remaining + ',' + formatted;
    }
  }

  return `${isNegative ? '-' : ''}₹${formatted}.${decPart}`;
}

// Format with original currency symbol
const currencySymbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥' };

function formatCurrency(num, currency) {
  const symbol = currencySymbols[currency] || currency + ' ';
  const abs = Math.abs(num);
  const formatted = abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${num < 0 ? '-' : ''}${symbol}${formatted}`;
}

// DOM Elements
const form = document.getElementById('transaction-form');
const tickerInput = document.getElementById('input-ticker');
const nameInput = document.getElementById('input-name');
const typeInput = document.getElementById('input-type');
const dateInput = document.getElementById('input-date');
const quantityInput = document.getElementById('input-quantity');
const priceInput = document.getElementById('input-price');
const lookupStatus = document.getElementById('lookup-status');
const formError = document.getElementById('form-error');

const totalInvestedEl = document.getElementById('total-invested');
const currentValueEl = document.getElementById('current-value');
const realizedProfitEl = document.getElementById('realized-profit');
const realizedLossEl = document.getElementById('realized-loss');
const realizedNetEl = document.getElementById('realized-net');
const unrealizedPnlEl = document.getElementById('unrealized-pnl');
const totalPnlPctEl = document.getElementById('total-pnl-pct');

const holdingsBody = document.getElementById('holdings-body');
const holdingsEmpty = document.getElementById('holdings-empty');
const holdingsLoading = document.getElementById('holdings-loading');
const transactionsBody = document.getElementById('transactions-body');
const transactionsEmpty = document.getElementById('transactions-empty');

// Set default date to now
function getLocalDatetime() {
  const now = new Date();
  return now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0') + 'T' +
    String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0');
}
dateInput.value = getLocalDatetime();

// --- Ticker Dropdown/Autocomplete ---
const tickerDropdown = document.getElementById('ticker-dropdown');
let searchTimeout = null;

tickerInput.addEventListener('input', () => {
  clearTimeout(lookupTimeout);
  clearTimeout(searchTimeout);
  const query = tickerInput.value.trim();

  if (query.length < 1) {
    tickerDropdown.classList.add('hidden');
    return;
  }

  searchTimeout = setTimeout(() => searchTickers(query), 300);
});

tickerInput.addEventListener('blur', () => {
  // Delay hiding so click on dropdown item registers
  setTimeout(() => {
    tickerDropdown.classList.add('hidden');
    const ticker = tickerInput.value.trim();
    if (ticker.length > 0) {
      lookupTicker(ticker);
    }
  }, 200);
});

tickerInput.addEventListener('focus', () => {
  const query = tickerInput.value.trim();
  if (query.length >= 1) {
    searchTickers(query);
  }
});

async function searchTickers(query) {
  try {
    const results = await apiStockSearch(query);

    if (results.length === 0) {
      tickerDropdown.classList.add('hidden');
      return;
    }

    tickerDropdown.innerHTML = results.map(r => `
      <li class="px-4 py-2.5 cursor-pointer hover:bg-emerald-600/20 flex justify-between items-center transition-colors"
          data-symbol="${r.symbol}" data-name="${r.name}">
        <span>
          <span class="font-semibold text-white">${r.symbol}</span>
          <span class="text-gray-400 text-sm ml-2">${r.name}</span>
        </span>
        <span class="text-xs text-gray-500">${r.exchange}</span>
      </li>
    `).join('');

    tickerDropdown.classList.remove('hidden');

    // Attach click handlers
    tickerDropdown.querySelectorAll('li').forEach(item => {
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const symbol = item.dataset.symbol;
        const name = item.dataset.name;
        tickerInput.value = symbol;
        nameInput.value = name;
        tickerDropdown.classList.add('hidden');
        lookupTicker(symbol);
      });
    });
  } catch {
    tickerDropdown.classList.add('hidden');
  }
}

// --- Stock Lookup ---
let lookupTimeout = null;
let currentLookupCurrency = 'INR';

async function lookupTicker(ticker) {
  lookupStatus.textContent = 'Looking up ticker...';
  lookupStatus.classList.remove('hidden');
  lookupStatus.classList.add('lookup-loading');

  try {
    const data = await apiStockLookup(ticker);
    if (data) {
      nameInput.value = data.name;
      priceInput.value = data.price.toFixed(2);
      currentLookupCurrency = data.currency || 'INR';
      lookupStatus.textContent = `✓ Found: ${data.name} (${data.currency} ${data.price.toFixed(2)})`;
      lookupStatus.classList.remove('lookup-loading');
      lookupStatus.classList.add('text-emerald-400');
      setTimeout(() => {
        lookupStatus.classList.add('hidden');
        lookupStatus.classList.remove('text-emerald-400');
      }, 3000);
    } else {
      lookupStatus.textContent = 'Ticker not found — enter name manually';
      lookupStatus.classList.remove('lookup-loading');
      lookupStatus.classList.add('text-yellow-400');
      setTimeout(() => {
        lookupStatus.classList.add('hidden');
        lookupStatus.classList.remove('text-yellow-400');
      }, 3000);
    }
  } catch {
    lookupStatus.textContent = 'Lookup failed — enter details manually';
    lookupStatus.classList.remove('lookup-loading');
    lookupStatus.classList.add('text-yellow-400');
    setTimeout(() => {
      lookupStatus.classList.add('hidden');
      lookupStatus.classList.remove('text-yellow-400');
    }, 3000);
  }
}

// --- Form Submission ---
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.classList.add('hidden');

  const payload = {
    ticker: tickerInput.value.trim(),
    name: nameInput.value.trim(),
    type: typeInput.value,
    date: dateInput.value,
    quantity: parseFloat(quantityInput.value),
    price: parseFloat(priceInput.value),
    currency: currentLookupCurrency
  };

  const targetVal = document.getElementById('input-target').value;
  const stoplossVal = document.getElementById('input-stoploss').value;
  if (targetVal) {
    payload.target_value = parseFloat(targetVal);
    payload.target_type = document.getElementById('input-target-type').value;
  }
  if (stoplossVal) {
    payload.stoploss_value = parseFloat(stoplossVal);
    payload.stoploss_type = document.getElementById('input-stoploss-type').value;
  }

  if (!payload.ticker || !payload.date || payload.quantity == null || isNaN(payload.quantity) || payload.price == null || isNaN(payload.price)) {
    showError('Please fill in all required fields.');
    return;
  }

  try {
    await apiAddTransaction(payload);
    form.reset();
    dateInput.value = new Date().toISOString().split('T')[0];
    currentLookupCurrency = 'INR';
    await loadDashboard();

    // Add ticker to Supabase watchlist
    addToWatchlist(payload.ticker);
  } catch (err) {
    showError(err.message || 'Failed to add transaction.');
  }
});

function showError(msg) {
  formError.textContent = msg;
  formError.classList.remove('hidden');
}

// --- Add to Supabase Watchlist ---
async function addToWatchlist(ticker) {
  try {
    const result = await apiAddToWatchlist(ticker);
    if (result.alreadyExisted) {
      showToast(`${ticker} already exists in watchlist`, 'info');
    } else {
      showToast(`${ticker} added to watchlist successfully`, 'success');
    }
  } catch {
    showToast(`Failed to add ${ticker} to watchlist`, 'error');
  }
}

// --- Prefill Transaction Form ---
function prefillTransaction(ticker, name, type, price, currency) {
  tickerInput.value = ticker;
  nameInput.value = name;
  typeInput.value = type;
  priceInput.value = price > 0 ? price.toFixed(2) : '';
  currentLookupCurrency = currency || 'INR';
  dateInput.value = getLocalDatetime();
  quantityInput.value = '';
  // Open the panel and focus quantity
  const panel = document.getElementById('transaction-panel');
  if (panel.classList.contains('-translate-x-full')) {
    toggleTransactionPanel();
  }
  setTimeout(() => quantityInput.focus(), 300);
}

// --- Delete Transaction ---
async function deleteTransaction(id) {
  if (!confirm('Are you sure you want to delete this transaction?')) return;
  try {
    await apiDeleteTransaction(id);
    await loadDashboard();
  } catch {
    // silently fail
  }
}

// --- Edit Transactions Mode ---
let isEditMode = false;

function toggleEditTransactions() {
  isEditMode = true;
  document.getElementById('btn-edit-transactions').classList.add('hidden');
  document.getElementById('btn-save-transactions').classList.remove('hidden');
  document.getElementById('btn-cancel-edit').classList.remove('hidden');
  renderEditableTransactions();
}

function cancelEditTransactions() {
  isEditMode = false;
  document.getElementById('btn-edit-transactions').classList.remove('hidden');
  document.getElementById('btn-save-transactions').classList.add('hidden');
  document.getElementById('btn-cancel-edit').classList.add('hidden');
  rerenderTransactions();
}

function renderEditableTransactions() {
  const inputClass = 'bg-[#121214] border border-gray-700 rounded px-1.5 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50';
  const selectClass = 'bg-[#121214] border border-gray-700 rounded px-1 py-1 text-white text-xs focus:outline-none';

  const sorted = [...cachedTransactions].sort((a, b) => {
    let va = a[transactionsSortCol]; let vb = b[transactionsSortCol];
    if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
    if (va < vb) return transactionsSortAsc ? -1 : 1;
    if (va > vb) return transactionsSortAsc ? 1 : -1;
    return 0;
  });

  transactionsBody.innerHTML = sorted.map(t => {
    // Extract just the date part (YYYY-MM-DD) for display
    let dateVal = (t.date || '').slice(0, 10);
    return `
      <tr class="hover:bg-gray-800/50" data-id="${t.id}">
        <td class="py-2 px-1 text-gray-400 text-xs whitespace-nowrap">${dateVal}</td>
        <td class="py-2 px-1"><input type="text" data-field="ticker" value="${t.ticker}" class="${inputClass} w-[80px] uppercase" /></td>
        <td class="py-2 px-1"><select data-field="type" class="${selectClass}"><option value="BUY" ${t.type === 'BUY' ? 'selected' : ''}>BUY</option><option value="SELL" ${t.type === 'SELL' ? 'selected' : ''}>SELL</option></select></td>
        <td class="py-2 px-1"><input type="number" data-field="quantity" value="${t.quantity}" step="0.001" class="${inputClass} w-[70px] text-right" /></td>
        <td class="py-2 px-1"><input type="number" data-field="price" value="${t.price}" step="0.01" class="${inputClass} w-[80px] text-right" /></td>
        <td class="py-2 px-1 text-right text-gray-400 text-xs">${formatCurrency(t.quantity * t.price, t.currency)}</td>
        <td class="py-2 px-1"><div class="flex gap-0.5"><input type="number" data-field="target_value" value="${t.target_value || ''}" step="0.01" placeholder="0" class="${inputClass} w-[55px] text-right" /><select data-field="target_type" class="${selectClass} w-[35px]"><option value="percentage" ${t.target_type === 'percentage' ? 'selected' : ''}>%</option><option value="amount" ${t.target_type === 'amount' ? 'selected' : ''}>₹</option></select></div></td>
        <td class="py-2 px-1"><div class="flex gap-0.5"><input type="number" data-field="stoploss_value" value="${t.stoploss_value || ''}" step="0.01" placeholder="0" class="${inputClass} w-[55px] text-right" /><select data-field="stoploss_type" class="${selectClass} w-[35px]"><option value="percentage" ${t.stoploss_type === 'percentage' ? 'selected' : ''}>%</option><option value="amount" ${t.stoploss_type === 'amount' ? 'selected' : ''}>₹</option></select></div></td>
        <td class="py-2 px-1 text-center space-x-1">
          <button onclick="saveOneTransaction('${t.id}')" class="text-emerald-400 hover:text-emerald-300 transition-colors text-xs font-bold" title="Save this row">💾</button>
          <button onclick="deleteTransaction('${t.id}')" class="text-gray-500 hover:text-rose-500 transition-colors" title="Delete">✕</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function saveOneTransaction(id) {
  const row = transactionsBody.querySelector(`tr[data-id="${id}"]`);
  if (!row) return;

  const getValue = (field) => {
    const el = row.querySelector(`[data-field="${field}"]`);
    return el ? el.value : null;
  };

  const fields = {
    ticker: getValue('ticker'),
    type: getValue('type'),
    quantity: getValue('quantity'),
    price: getValue('price'),
    target_value: getValue('target_value') || null,
    target_type: getValue('target_type'),
    stoploss_value: getValue('stoploss_value') || null,
    stoploss_type: getValue('stoploss_type')
  };

  try {
    const res = await fetch(`${API_BASE}/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields)
    });
    if (res.ok) {
      showToast('Transaction updated', 'success');
      if (fields.ticker) addToWatchlist(fields.ticker.toUpperCase());
      await loadDashboard();
      if (isEditMode) renderEditableTransactions();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to update', 'error');
    }
  } catch {
    showToast('Failed to update transaction', 'error');
  }
}

async function saveEditedTransactions() {
  const rows = transactionsBody.querySelectorAll('tr[data-id]');
  const updates = [];

  rows.forEach(row => {
    const id = row.dataset.id;
    if (!id) return;

    const getValue = (field) => {
      const el = row.querySelector(`[data-field="${field}"]`);
      return el ? el.value : null;
    };

    const fields = {
      ticker: getValue('ticker'),
      type: getValue('type'),
      quantity: getValue('quantity'),
      price: getValue('price'),
      target_value: getValue('target_value') || null,
      target_type: getValue('target_type'),
      stoploss_value: getValue('stoploss_value') || null,
      stoploss_type: getValue('stoploss_type')
    };

    updates.push({ id, ...fields });
  });

  if (updates.length === 0) {
    showToast('No transactions to save', 'info');
    return;
  }

  try {
    let successCount = 0;
    for (const update of updates) {
      const { id, ...fields } = update;
      const res = await fetch(`${API_BASE}/transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
      });
      if (res.ok) {
        successCount++;
      } else {
        const err = await res.text();
        console.error(`[saveAll] Failed to update ${id}:`, err);
      }
    }
    showToast(`${successCount} transaction(s) updated`, 'success');
    isEditMode = false;
    document.getElementById('btn-edit-transactions').classList.remove('hidden');
    document.getElementById('btn-save-transactions').classList.add('hidden');
    document.getElementById('btn-cancel-edit').classList.add('hidden');
    await loadDashboard();
  } catch (err) {
    showToast('Failed to save some transactions', 'error');
  }
}

// --- Dashboard Data Loading ---
async function loadDashboard() {
  try {
    const transactions = await apiGetTransactions();
    console.log('[loadDashboard] transactions:', transactions.length);
    renderTransactionLog(transactions);
    await renderHoldings(transactions);
  } catch (err) {
    console.error('[loadDashboard] Error:', err);
  }
}

function renderTransactionLog(transactions) {
  if (transactions.length === 0) {
    transactionsBody.innerHTML = '';
    transactionsEmpty.classList.remove('hidden');
    cachedTransactions = [];
    return;
  }

  transactionsEmpty.classList.add('hidden');

  cachedTransactions = transactions.map(t => {
    const typeClass = t.type === 'BUY' ? 'text-emerald-400' : 'text-rose-500';
    const cur = t.currency || 'INR';
    const total = t.quantity * t.price;
    const displayDate = t.date && t.date.includes('T')
      ? t.date.replace('T', ' ').slice(0, 16)
      : t.date;

    const targetDisplay = t.target_value != null && t.target_value > 0
      ? `${t.target_value}${t.target_type === 'percentage' ? '%' : ' ₹'}`
      : '–';
    const slDisplay = t.stoploss_value != null && t.stoploss_value > 0
      ? `${t.stoploss_value}${t.stoploss_type === 'percentage' ? '%' : ' ₹'}`
      : '–';

    const html = `
      <tr class="hover:bg-gray-800/50" data-id="${t.id}">
        <td class="py-3 px-2 whitespace-nowrap">${displayDate}</td>
        <td class="py-3 px-2 font-medium">${t.ticker}</td>
        <td class="py-3 px-2 ${typeClass} font-semibold">${t.type}</td>
        <td class="py-3 px-2 text-right">${t.quantity}</td>
        <td class="py-3 px-2 text-right">${formatCurrency(t.price, cur)}</td>
        <td class="py-3 px-2 text-right">${formatCurrency(total, cur)}</td>
        <td class="py-3 px-2 text-right text-gray-300">${targetDisplay}</td>
        <td class="py-3 px-2 text-right text-gray-300">${slDisplay}</td>
        <td class="py-3 px-2 text-center">
          <button onclick="deleteTransaction('${t.id}')"
            class="text-gray-500 hover:text-rose-500 transition-colors" title="Delete">
            ✕
          </button>
        </td>
      </tr>
    `;
    return { id: t.id, date: t.date, ticker: t.ticker, type: t.type, quantity: t.quantity, price: t.price, total, currency: cur, target_value: t.target_value, target_type: t.target_type || 'percentage', stoploss_value: t.stoploss_value, stoploss_type: t.stoploss_type || 'percentage', html };
  });

  // Apply current sort
  rerenderTransactions();
  updateSortIndicators('t', transactionsSortCol);
}

async function renderHoldings(transactions) {
  // Show loading spinner
  holdingsLoading.classList.remove('hidden');
  holdingsBody.innerHTML = '';

  // Sort transactions chronologically (oldest first) for correct avg cost calculation
  const sortedTxns = [...transactions].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  // Aggregate by ticker
  const holdingsMap = {};

  for (const t of sortedTxns) {
    if (!holdingsMap[t.ticker]) {
      holdingsMap[t.ticker] = { ticker: t.ticker, name: t.name, currency: t.currency || 'INR', totalShares: 0, totalCost: 0, realizedPnl: 0, realizedSells: [], buyTransactions: [] };
    }

    const h = holdingsMap[t.ticker];
    if (t.type === 'BUY') {
      h.totalCost += t.quantity * t.price;
      h.totalShares += t.quantity;
      h.buyTransactions.push(t);
    } else {
      // SELL: calculate realized P&L using average cost
      const avgCost = h.totalShares > 0 ? h.totalCost / h.totalShares : 0;
      const pnl = (t.price - avgCost) * t.quantity;
      h.realizedPnl += pnl;
      h.realizedSells.push({ date: t.date, pnl, ticker: h.ticker, currency: h.currency, quantity: t.quantity, sellPrice: t.price, avgCost });
      h.totalCost -= avgCost * t.quantity;
      h.totalShares -= t.quantity;
    }
  }

  // Include sold stocks only if toggle is checked
  const showSold = document.getElementById('toggle-sold')?.checked;
  const activeHoldings = Object.values(holdingsMap).filter(h => 
    showSold ? h.totalShares >= 0 : h.totalShares > 0.0001
  );

  if (activeHoldings.length === 0) {
    holdingsBody.innerHTML = '';
    holdingsLoading.classList.add('hidden');
    holdingsEmpty.classList.remove('hidden');

    // Still calculate realized P&L from all tickers (convert to INR)
    const allHoldings = Object.values(holdingsMap);
    const currencies = [...new Set(allHoldings.map(h => h.currency))];
    const rates = await fetchExchangeRates(currencies);

    window._cachedRealizedSells = allHoldings.flatMap(h => h.realizedSells || []);
    window._cachedRates = rates;

    totalInvestedEl.textContent = formatINR(0);
    currentValueEl.textContent = formatINR(0);
    renderPnl(unrealizedPnlEl, 0);
    updateRealizedCards();
    renderPnlPct(totalPnlPctEl, 0);
    return;
  }

  holdingsEmpty.classList.add('hidden');
  holdingsLoading.classList.remove('hidden');

  // Fetch current prices, chandelier exit, and fundamentals+MA in parallel
  const prices = {};
  const priceCurrencies = {};
  const chandelierData = {};
  const fundamentalsData = {};
  const maData = {};

  const tickersForApi = activeHoldings.map(h => h.ticker);

  await Promise.all([
    // Batch: current prices from Yahoo
    Promise.all(activeHoldings.map(async (h) => {
      try {
        const data = await apiStockLookup(h.ticker);
        if (data) {
          prices[h.ticker] = data.price;
          priceCurrencies[h.ticker] = data.currency;
        } else {
          prices[h.ticker] = null;
        }
      } catch {
        prices[h.ticker] = null;
      }
    })),
    // Chandelier exit (single call)
    (async () => {
      try {
        const ceData = await apiChandelierExit(tickersForApi);
        if (Array.isArray(ceData)) {
          ceData.forEach(item => {
            if (item.ticker && item.algo_chandelier_exit) {
              chandelierData[item.ticker] = item.algo_chandelier_exit;
            }
          });
        }
      } catch {}
    })(),
    // Batch fundamentals + moving averages (single call)
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/holdings-data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tickers: tickersForApi, periods: '20,44' })
        });
        if (res.ok) {
          const data = await res.json();
          Object.assign(fundamentalsData, data.fundamentals || {});
          Object.assign(maData, data.movingAverages || {});
          if (data.signalChanges) window._signalChanges = data.signalChanges;
        }
      } catch {}
    })()
  ]);

  holdingsLoading.classList.add('hidden');

  // Fetch exchange rates for all currencies involved
  const allCurrencies = [...new Set([
    ...Object.values(holdingsMap).map(h => h.currency),
    ...Object.values(priceCurrencies)
  ])];
  const rates = await fetchExchangeRates(allCurrencies);

  window._cachedRealizedSells = Object.values(holdingsMap).flatMap(h => h.realizedSells || []);
  window._cachedRates = rates;

  let totalInvestedINR = 0;
  let totalCurrentValueINR = 0;

  cachedHoldingsRows = activeHoldings.map(h => {
    const cur = h.currency;
    const rate = rates[cur] || 1;
    const avgPrice = h.totalShares > 0 ? h.totalCost / h.totalShares : 0;
    const currentPrice = prices[h.ticker];
    const currentCur = priceCurrencies[h.ticker] || cur;
    const currentVal = currentPrice != null && h.totalShares > 0 ? currentPrice * h.totalShares : null;
    const returnOriginal = currentVal != null && h.totalCost > 0 ? currentVal - h.totalCost : null;
    const returnPct = returnOriginal != null && h.totalCost > 0 ? (returnOriginal / h.totalCost) * 100 : null;

    // Convert to INR for summary
    totalInvestedINR += h.totalCost * rate;
    if (currentVal != null) totalCurrentValueINR += currentVal * (rates[currentCur] || 1);

    const returnClass = returnOriginal != null
      ? (returnOriginal >= 0 ? 'text-emerald-400' : 'text-rose-500')
      : 'text-gray-400';

    const returnText = returnOriginal != null
      ? `${returnOriginal >= 0 ? '+' : ''}${formatCurrency(returnOriginal, cur)} (${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(1)}%)`
      : 'N/A';

    const priceText = currentPrice != null ? formatCurrency(currentPrice, currentCur) : 'N/A';
    const ceInfo = chandelierData[h.ticker];
    const ceState = ceInfo ? ceInfo.marketState : null;
    const ceText = ceState ? (ceState === 'BULLISH' ? 'BUY' : 'SELL') : 'N/A';
    const ceClass = ceState
      ? (ceState === 'BULLISH' ? 'text-emerald-400' : 'text-rose-500')
      : 'text-gray-400';

    // Signal change badges — per indicator
    const allChanges = (window._signalChanges || []).filter(c => c.ticker === h.ticker);
    const ceChange = allChanges.find(c => c.indicator === 'chandelier_exit');
    const ottChange = allChanges.find(c => c.indicator === 'ott');
    const ceBadge = ceChange
      ? ` <span class="ml-1 px-1 py-0.5 text-[9px] font-bold rounded ${ceChange.new_value === 'BULLISH' ? 'bg-emerald-600/30 text-emerald-300' : 'bg-rose-600/30 text-rose-300'}" title="CE: ${ceChange.old_value} → ${ceChange.new_value} (${new Date(ceChange.changed_at).toLocaleDateString()})">⚡</span>`
      : '';
    const ottBadge = ottChange
      ? ` <span class="ml-1 px-1 py-0.5 text-[9px] font-bold rounded ${ottChange.new_value === 'BUY' || ottChange.new_value === 'BULLISH' ? 'bg-emerald-600/30 text-emerald-300' : 'bg-rose-600/30 text-rose-300'}" title="OTT: ${ottChange.old_value} → ${ottChange.new_value} (${new Date(ottChange.changed_at).toLocaleDateString()})">⚡</span>`
      : '';

    // Fundamentals & Moving Averages
    const fund = fundamentalsData[h.ticker];
    const ma = maData[h.ticker] || {};

    // OTT indicator
    const ottInfo = fund?.algo_ott;
    const ottState = ottInfo?.marketState || null;
    const ottSignal = ottInfo?.currentSignal || null;
    const ottText = ottSignal ? (ottSignal === 'BUY' ? 'BUY' : 'SELL') : (ottState ? (ottState === 'BULLISH' ? 'BUY' : 'SELL') : 'N/A');
    const ottClass = ottText === 'BUY' ? 'text-emerald-400' : ottText === 'SELL' ? 'text-rose-500' : 'text-gray-400';

    const weekHigh = fund?.fifty_two_week_high;
    const weekLow = fund?.fifty_two_week_low;
    const rsi = fund?.rsi;
    const ma20 = ma.MA20;
    const ma44 = ma.MA44;

    const weekHighText = weekHigh != null ? formatCurrency(weekHigh, currentCur) : 'N/A';
    const weekLowText = weekLow != null ? formatCurrency(weekLow, currentCur) : 'N/A';
    const ma20Text = ma20 != null ? formatCurrency(ma20, currentCur) : 'N/A';
    const ma44Text = ma44 != null ? formatCurrency(ma44, currentCur) : 'N/A';

    // Color MA relative to current price
    const ma20Class = ma20 != null && currentPrice != null
      ? (currentPrice >= ma20 ? 'text-emerald-400' : 'text-rose-500')
      : 'text-gray-400';
    const ma44Class = ma44 != null && currentPrice != null
      ? (currentPrice >= ma44 ? 'text-emerald-400' : 'text-rose-500')
      : 'text-gray-400';

    // Color current price based on MA + CE + OTT conditions
    const priceClass = (() => {
      if (currentPrice == null || ma20 == null || ma44 == null) return 'text-white';
      const isBelowBothMA = currentPrice < ma20 && currentPrice < ma44;
      const isAboveBothMA = currentPrice >= ma20 && currentPrice >= ma44;
      if (isBelowBothMA && ceText === 'SELL' && ottText === 'SELL') return 'text-rose-500';
      if (isAboveBothMA && ceText === 'BUY' && ottText === 'BUY') return 'text-emerald-400';
      return 'text-white';
    })();

    const rsiText = rsi != null ? rsi.toFixed(1) : 'N/A';
    const rsiClass = rsi == null ? 'text-gray-400'
      : rsi >= 70 ? 'text-rose-400'
      : rsi <= 30 ? 'text-emerald-400'
      : 'text-yellow-400';

    // % below 52W High
    const belowHigh = (weekHigh != null && currentPrice != null && weekHigh > 0)
      ? ((weekHigh - currentPrice) / weekHigh) * 100
      : null;
    const belowHighText = belowHigh != null ? `-${belowHigh.toFixed(1)}%` : 'N/A';
    const belowHighClass = belowHigh != null
      ? (belowHigh <= 10 ? 'text-emerald-400' : belowHigh <= 25 ? 'text-yellow-400' : 'text-rose-500')
      : 'text-gray-400';

    // Target & Stop Loss indicator
    let tslIndicator = '';
    if (currentPrice != null && h.buyTransactions.length > 0) {
      // Compute weighted-average target/stoploss prices from BUY transactions
      let targetPrice = null;
      let stoplossPrice = null;
      let totalQtyWithTarget = 0;
      let totalQtyWithSL = 0;
      let weightedTarget = 0;
      let weightedSL = 0;

      for (const bt of h.buyTransactions) {
        if (bt.target_value != null && bt.target_value > 0) {
          const tp = bt.target_type === 'amount' ? bt.target_value : bt.price * (1 + bt.target_value / 100);
          weightedTarget += tp * bt.quantity;
          totalQtyWithTarget += bt.quantity;
        }
        if (bt.stoploss_value != null && bt.stoploss_value > 0) {
          const sl = bt.stoploss_type === 'amount' ? bt.stoploss_value : bt.price * (1 - bt.stoploss_value / 100);
          weightedSL += sl * bt.quantity;
          totalQtyWithSL += bt.quantity;
        }
      }

      if (totalQtyWithTarget > 0) targetPrice = weightedTarget / totalQtyWithTarget;
      if (totalQtyWithSL > 0) stoplossPrice = weightedSL / totalQtyWithSL;

      if (targetPrice != null && currentPrice >= targetPrice) {
        tslIndicator = `<span class="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-600/30 text-emerald-300" title="Target hit! Target: ${formatCurrency(targetPrice, cur)}">🎯T</span>`;
      }
      if (stoplossPrice != null && currentPrice <= stoplossPrice) {
        tslIndicator += `<span class="px-1.5 py-0.5 text-[9px] font-bold rounded bg-rose-600/30 text-rose-300 ml-0.5" title="Stop Loss hit! SL: ${formatCurrency(stoplossPrice, cur)}">⛔SL</span>`;
      }
    }

    const html = `
      <tr class="hover:bg-gray-800/50">
        <td class="py-3 px-2 font-medium">
          <span class="mr-1">${h.ticker}</span>
          <a href="https://in.tradingview.com/symbols/${h.ticker.replace(/\.(NS|BO|BSE)$/i, '')}" target="_blank" class="text-[10px] bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-1.5 py-0.5 rounded transition-colors font-bold inline-block">TV</a>
          <a href="https://chartink.com/stocks-new?symbol=${h.ticker.replace(/\.(NS|BO|BSE)$/i, '')}" target="_blank" class="text-[10px] bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 px-1.5 py-0.5 rounded transition-colors font-bold inline-block">CI</a>
        </td>
        <td class="py-3 px-2 text-right">${Math.round(h.totalShares)}</td>
        <td class="py-3 px-2 text-right">${formatCurrency(avgPrice, cur)}</td>
        <td class="py-3 px-2 text-right ${priceClass} font-medium">${priceText}</td>
        <td class="py-3 px-2 text-right ${ma20Class}">${ma20Text}</td>
        <td class="py-3 px-2 text-right ${ma44Class}">${ma44Text}</td>
        <td class="py-3 px-2 text-right text-gray-300">${weekHighText}</td>
        <td class="py-3 px-2 text-right text-gray-300">${weekLowText}</td>
        <td class="py-3 px-2 text-right ${belowHighClass} font-medium">${belowHighText}</td>
        <td class="py-3 px-2 text-right ${rsiClass} font-medium">${rsiText}</td>
        <td class="py-3 px-2 text-right ${ceClass} font-medium">${ceText}${ceBadge}</td>
        <td class="py-3 px-2 text-right ${ottClass} font-medium">${ottText}${ottBadge}</td>
        <td class="py-3 px-2 text-right ${returnClass} font-medium">${returnText}</td>
        <td class="py-3 px-2 text-center space-x-1">
          <button onclick="prefillTransaction('${h.ticker}', '${h.name.replace(/'/g, "\\'") }', 'BUY', ${currentPrice || 0}, '${currentCur}')" class="text-[10px] bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 px-1.5 py-0.5 rounded transition-colors font-bold">B</button>
          <button onclick="prefillTransaction('${h.ticker}', '${h.name.replace(/'/g, "\\'") }', 'SELL', ${currentPrice || 0}, '${currentCur}')" class="text-[10px] bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 px-1.5 py-0.5 rounded transition-colors font-bold">S</button>
        </td>
        <td class="py-3 px-2 text-center">${tslIndicator}</td>
      </tr>
    `;

    return {
      ticker: h.ticker,
      name: h.name,
      shares: h.totalShares,
      avgPrice,
      current: currentPrice,
      ma20: ma20 || 0,
      ma44: ma44 || 0,
      weekHigh: weekHigh || 0,
      weekLow: weekLow || 0,
      belowHigh: belowHigh || 0,
      rsi: rsi ?? 0,
      chandelier: ceText || '',
      ott: ottText === 'BUY' ? 1 : ottText === 'SELL' ? -1 : 0,
      return: returnPct,
      tsl: tslIndicator.includes('⛔SL') ? 2 : tslIndicator.includes('🎯T') ? 1 : 0,
      html
    };
  });

  if (holdingsSortCol || document.getElementById('toggle-alerts-sort')?.checked) {
    rerenderHoldings();
    if (holdingsSortCol) updateSortIndicators('h', holdingsSortCol);
  } else {
    holdingsBody.innerHTML = cachedHoldingsRows.map(r => r.html).join('');
  }

  // Update summary cards (always in INR)
  const unrealizedPnlINR = totalCurrentValueINR - totalInvestedINR;
  const totalPnlPct = totalInvestedINR > 0 ? (unrealizedPnlINR / totalInvestedINR) * 100 : 0;

  totalInvestedEl.textContent = formatINR(totalInvestedINR);
  currentValueEl.textContent = formatINR(totalCurrentValueINR);
  renderPnl(unrealizedPnlEl, unrealizedPnlINR);
  updateRealizedCards();
  renderPnlPct(totalPnlPctEl, totalPnlPct);

}

// Fetch exchange rates for multiple currencies at once
async function fetchExchangeRates(currencies) {
  const rates = { INR: 1 };
  const toFetch = currencies.filter(c => c !== 'INR' && !rates[c]);

  await Promise.all(toFetch.map(async (currency) => {
    try {
      const data = await apiExchangeRate(currency);
      rates[currency] = data.rate;
    } catch {
      rates[currency] = 1;
    }
  }));

  return rates;
}

function getPeriodCutoff(period) {
  const now = Date.now();
  const msDay = 24 * 60 * 60 * 1000;
  switch (period) {
    case '1D':  return new Date(now - 1  * msDay);
    case '1W':  return new Date(now - 7  * msDay);
    case '1FN': return new Date(now - 14 * msDay);
    case '1M':  return new Date(now - 30 * msDay);
    case '1Q':  return new Date(now - 90 * msDay);
    default:    return new Date(0);
  }
}

function updateRealizedCards() {
  const period = document.getElementById('realized-period')?.value || '1M';
  const cutoff = getPeriodCutoff(period);
  const sells = window._cachedRealizedSells || [];
  const rates = window._cachedRates || {};

  let profit = 0;
  let loss = 0;
  const filtered = [];
  sells.forEach(s => {
    if (new Date(s.date) >= cutoff) {
      const pnlINR = s.pnl * (rates[s.currency] || 1);
      if (pnlINR >= 0) profit += pnlINR;
      else loss += pnlINR;
      filtered.push({ ...s, pnlINR });
    }
  });

  renderPnl(realizedProfitEl, profit);
  renderPnl(realizedLossEl, loss);
  renderPnl(realizedNetEl, profit + loss);

  // Render breakdown table
  const tbody = document.getElementById('realized-breakdown-body');
  const empty = document.getElementById('realized-breakdown-empty');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  // Sort by selected column
  filtered.sort((a, b) => {
    let va = a[breakdownSortCol];
    let vb = b[breakdownSortCol];
    if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
    if (va == null) va = breakdownSortAsc ? Infinity : -Infinity;
    if (vb == null) vb = breakdownSortAsc ? Infinity : -Infinity;
    if (va < vb) return breakdownSortAsc ? -1 : 1;
    if (va > vb) return breakdownSortAsc ? 1 : -1;
    return 0;
  });
  tbody.innerHTML = filtered.map(s => {
    const pnlClass = s.pnlINR >= 0 ? 'text-emerald-400' : 'text-rose-500';
    const pnlSign = s.pnlINR >= 0 ? '+' : '';
    const dateStr = s.date ? new Date(s.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
    return `<tr class="hover:bg-gray-800/50">
      <td class="py-2 px-2 text-gray-300">${dateStr}</td>
      <td class="py-2 px-2 font-medium">${s.ticker}</td>
      <td class="py-2 px-2 text-right">${s.quantity?.toFixed(3) ?? '-'}</td>
      <td class="py-2 px-2 text-right">${formatCurrency(s.sellPrice, s.currency)}</td>
      <td class="py-2 px-2 text-right text-gray-400">${formatCurrency(s.avgCost, s.currency)}</td>
      <td class="py-2 px-2 text-right ${pnlClass} font-medium">${pnlSign}${formatINR(s.pnlINR)}</td>
    </tr>`;
  }).join('');
}

function renderPnl(el, value) {
  const formatted = value >= 0 ? `+${formatINR(value)}` : `-${formatINR(Math.abs(value))}`;
  el.textContent = formatted;
  el.className = el.className.replace(/text-emerald-400|text-rose-500|text-gray-100/g, '');
  if (value > 0) {
    el.classList.add('text-emerald-400');
  } else if (value < 0) {
    el.classList.add('text-rose-500');
  } else {
    el.classList.add('text-gray-100');
  }
}

function renderPnlPct(el, value) {
  const formatted = `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  el.textContent = formatted;
  el.className = el.className.replace(/text-emerald-400|text-rose-500|text-gray-100/g, '');
  if (value > 0) {
    el.classList.add('text-emerald-400');
  } else if (value < 0) {
    el.classList.add('text-rose-500');
  } else {
    el.classList.add('text-gray-100');
  }
}

// --- Sorting State ---
let holdingsSortCol = null;
let holdingsSortAsc = true;
let cachedHoldingsRows = []; // store row data for re-sorting

let transactionsSortCol = 'date';
let transactionsSortAsc = false;
let cachedTransactions = [];

let breakdownSortCol = 'date';
let breakdownSortAsc = false;

function updateSortIndicators(prefix, activeCol) {
  const cols = prefix === 'h'
    ? ['ticker', 'name', 'shares', 'avgPrice', 'current', 'chandelier', 'return']
    : prefix === 't'
    ? ['date', 'ticker', 'type', 'quantity', 'price', 'total']
    : ['date', 'ticker', 'quantity', 'sellPrice', 'avgCost', 'pnlINR'];
  const asc = prefix === 'h' ? holdingsSortAsc : prefix === 't' ? transactionsSortAsc : breakdownSortAsc;
  cols.forEach(col => {
    const el = document.getElementById(`sort-${prefix}-${col}`);
    if (el) el.textContent = col === activeCol ? (asc ? '▲' : '▼') : '';
  });
}

function sortHoldings(col) {
  // Uncheck alert sort when user explicitly sorts by a column
  const alertToggle = document.getElementById('toggle-alerts-sort');
  if (alertToggle) alertToggle.checked = false;

  if (holdingsSortCol === col) {
    holdingsSortAsc = !holdingsSortAsc;
  } else {
    holdingsSortCol = col;
    holdingsSortAsc = true;
  }
  updateSortIndicators('h', col);
  rerenderHoldings();
}

function rerenderHoldings() {
  if (cachedHoldingsRows.length === 0) return;

  // Sort by alerts: CE changes first, then OTT changes, then column sort
  const alertsSort = document.getElementById('toggle-alerts-sort')?.checked;
  if (alertsSort) {
    const sc = window._signalChanges || [];
    const alertRank = (r) => {
      const hasCE  = sc.some(c => c.ticker === r.ticker && c.indicator === 'chandelier_exit') ? 0 : 2;
      const hasOTT = sc.some(c => c.ticker === r.ticker && c.indicator === 'ott') ? 0 : 1;
      return hasCE + hasOTT; // 0=CE+OTT, 1=CE only, 2=OTT only, 3=none
    };
    const sorted = [...cachedHoldingsRows].sort((a, b) => alertRank(a) - alertRank(b));
    holdingsBody.innerHTML = sorted.map(r => r.html).join('');
    return;
  }

  const sorted = [...cachedHoldingsRows].sort((a, b) => {
    let va = a[holdingsSortCol];
    let vb = b[holdingsSortCol];
    if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
    if (va == null) va = holdingsSortAsc ? Infinity : -Infinity;
    if (vb == null) vb = holdingsSortAsc ? Infinity : -Infinity;
    if (va < vb) return holdingsSortAsc ? -1 : 1;
    if (va > vb) return holdingsSortAsc ? 1 : -1;
    return 0;
  });
  holdingsBody.innerHTML = sorted.map(r => r.html).join('');
}

function sortTransactions(col) {
  if (transactionsSortCol === col) {
    transactionsSortAsc = !transactionsSortAsc;
  } else {
    transactionsSortCol = col;
    transactionsSortAsc = col === 'date' ? false : true;
  }
  updateSortIndicators('t', col);
  rerenderTransactions();
}

function rerenderTransactions() {
  if (cachedTransactions.length === 0) return;
  const sorted = [...cachedTransactions].sort((a, b) => {
    let va = a[transactionsSortCol];
    let vb = b[transactionsSortCol];
    if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
    if (va < vb) return transactionsSortAsc ? -1 : 1;
    if (va > vb) return transactionsSortAsc ? 1 : -1;
    return 0;
  });
  transactionsBody.innerHTML = sorted.map(r => r.html).join('');
}

function sortBreakdown(col) {
  if (breakdownSortCol === col) {
    breakdownSortAsc = !breakdownSortAsc;
  } else {
    breakdownSortCol = col;
    breakdownSortAsc = col === 'date' ? false : col === 'pnlINR' ? false : true;
  }
  updateSortIndicators('b', col);
  updateRealizedCards();
}

// --- CSV Export ---
function downloadCSV(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportHoldingsCSV() {
  const table = document.getElementById('holdings-body');
  const rows = table.querySelectorAll('tr');
  if (rows.length === 0) {
    showToast('No holdings to export', 'info');
    return;
  }

  const headers = ['Ticker', 'Name', 'Shares', 'Avg Price', 'Current Price', 'Chandelier Exit', 'Return'];
  const csvRows = [headers.join(',')];

  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    const values = Array.from(cells).map(cell => {
      const text = cell.textContent.trim().replace(/,/g, '');
      return `"${text}"`;
    });
    csvRows.push(values.join(','));
  });

  downloadCSV(`holdings_${new Date().toISOString().split('T')[0]}.csv`, csvRows.join('\n'));
  showToast('Holdings exported successfully', 'success');
}

function exportTransactionsCSV() {
  const table = document.getElementById('transactions-body');
  const rows = table.querySelectorAll('tr');
  if (rows.length === 0) {
    showToast('No transactions to export', 'info');
    return;
  }

  const headers = ['Date', 'Ticker', 'Type', 'Quantity', 'Price', 'Total'];
  const csvRows = [headers.join(',')];

  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    // Skip the last cell (delete button)
    const values = Array.from(cells).slice(0, -1).map(cell => {
      const text = cell.textContent.trim().replace(/,/g, '');
      return `"${text}"`;
    });
    csvRows.push(values.join(','));
  });

  downloadCSV(`transactions_${new Date().toISOString().split('T')[0]}.csv`, csvRows.join('\n'));
  showToast('Transactions exported successfully', 'success');
}

// --- CSV Bulk Import ---
let csvImportRows = [];

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, ''));
  return lines.slice(1).map((line, i) => {
    // Handle quoted fields
    const cols = [];
    let cur = '', inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { cols.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    cols.push(cur.trim());
    const row = {};
    headers.forEach((h, idx) => { row[h] = cols[idx] !== undefined ? cols[idx].replace(/^"|"$/g, '').trim() : ''; });
    return { _row: i + 2, ...row };
  });
}

function validateImportRow(row) {
  const errors = [];
  if (!row.ticker) errors.push('missing ticker');
  if (!row.date) errors.push('missing date');
  if (!row.type || !['BUY', 'SELL'].includes(row.type.toUpperCase())) errors.push('type must be BUY or SELL');
  if (!row.quantity || isNaN(parseFloat(row.quantity)) || parseFloat(row.quantity) <= 0) errors.push('invalid quantity');
  if (!row.price || isNaN(parseFloat(row.price)) || parseFloat(row.price) < 0) errors.push('invalid price');
  return errors;
}

function handleCSVImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = ''; // reset so same file can be re-imported
  const reader = new FileReader();
  reader.onload = (e) => {
    csvImportRows = parseCSV(e.target.result);
    if (csvImportRows.length === 0) {
      showToast('CSV is empty or invalid', 'error');
      return;
    }
    renderImportPreview();
    document.getElementById('csv-import-modal').classList.remove('hidden');
  };
  reader.readAsText(file);
}

function renderImportPreview() {
  const tbody = document.getElementById('csv-preview-body');
  const summary = document.getElementById('csv-import-summary');
  let valid = 0, invalid = 0;

  tbody.innerHTML = csvImportRows.map((row, i) => {
    const errors = validateImportRow(row);
    const isValid = errors.length === 0;
    if (isValid) valid++; else invalid++;
    const statusHtml = isValid
      ? `<span class="text-emerald-400 text-xs">✓ OK</span>`
      : `<span class="text-rose-400 text-xs" title="${errors.join(', ')}">✗ ${errors[0]}</span>`;
    const rowClass = isValid ? '' : 'opacity-50';
    return `<tr class="hover:bg-gray-800/30 ${rowClass}">
      <td class="py-1.5 px-2 text-gray-500">${row._row}</td>
      <td class="py-1.5 px-2">${row.date || '-'}</td>
      <td class="py-1.5 px-2 font-medium">${(row.ticker || '').toUpperCase()}</td>
      <td class="py-1.5 px-2 text-gray-400">${row.name || '-'}</td>
      <td class="py-1.5 px-2 ${row.type?.toUpperCase() === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}">${(row.type || '').toUpperCase()}</td>
      <td class="py-1.5 px-2 text-right">${row.quantity || '-'}</td>
      <td class="py-1.5 px-2 text-right">${row.price || '-'}</td>
      <td class="py-1.5 px-2">${row.currency || 'INR'}</td>
      <td class="py-1.5 px-2">${statusHtml}</td>
    </tr>`;
  }).join('');

  summary.textContent = `${valid} valid, ${invalid} invalid (invalid rows will be skipped)`;
  document.getElementById('csv-confirm-btn').disabled = valid === 0;
}

function closeImportModal() {
  document.getElementById('csv-import-modal').classList.add('hidden');
  csvImportRows = [];
}

async function confirmCSVImport() {
  const btn = document.getElementById('csv-confirm-btn');
  const validRows = csvImportRows.filter(row => validateImportRow(row).length === 0);
  if (validRows.length === 0) return;

  btn.disabled = true;
  btn.textContent = 'Importing...';

  let success = 0, failed = 0;
  const importedTickers = new Set();
  for (const row of validRows) {
    try {
      await apiAddTransaction({
        ticker: row.ticker.toUpperCase(),
        name: row.name || row.ticker.toUpperCase(),
        type: row.type.toUpperCase(),
        date: row.date,
        quantity: parseFloat(row.quantity),
        price: parseFloat(row.price),
        currency: row.currency || 'INR'
      });
      importedTickers.add(row.ticker.toUpperCase());
      success++;
    } catch {
      failed++;
    }
  }

  // Add all imported tickers to watchlist
  for (const ticker of importedTickers) {
    addToWatchlist(ticker);
  }

  closeImportModal();
  showToast(`Imported ${success} transaction${success !== 1 ? 's' : ''}${failed ? `, ${failed} failed` : ''}`, failed ? 'error' : 'success');
  await loadDashboard();
}

// --- Initialize ---
async function loadAnalysisTimestamps() {
  try {
    const res = await fetch(`${API_BASE}/analysis-timestamps`);
    if (!res.ok) return;
    const { ce, ott } = await res.json();
    const fmt = (iso) => {
      if (!iso) return '–';
      const d = new Date(iso);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) +
        ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
    };
    const ceEl = document.getElementById('ce-last-run');
    const ottEl = document.getElementById('ott-last-run');
    if (ceEl) ceEl.textContent = fmt(ce);
    if (ottEl) ottEl.textContent = fmt(ott);
  } catch {}
}

// --- Live Market Indices (Nifty & Sensex) ---
let marketIndicesInterval = null;

async function loadMarketIndices() {
  const indices = [
    { ticker: '^NSEI', priceEl: 'nifty-price', changeEl: 'nifty-change', statusEl: 'nifty-status', label: 'NSE' },
    { ticker: '^BSESN', priceEl: 'sensex-price', changeEl: 'sensex-change', statusEl: 'sensex-status', label: 'BSE' }
  ];

  let anyMarketOpen = false;

  await Promise.all(indices.map(async ({ ticker, priceEl, changeEl, statusEl, label }) => {
    try {
      const res = await fetch(`${API_BASE}/stock-lookup/${encodeURIComponent(ticker)}`);
      if (!res.ok) return;
      const data = await res.json();

      const priceElement = document.getElementById(priceEl);
      const changeElement = document.getElementById(changeEl);
      const statusElement = document.getElementById(statusEl);

      if (priceElement) priceElement.textContent = data.price.toLocaleString('en-IN', { maximumFractionDigits: 2 });

      if (changeElement && data.previousClose) {
        const changePct = ((data.price - data.previousClose) / data.previousClose) * 100;
        const sign = changePct >= 0 ? '+' : '';
        changeElement.textContent = `${sign}${changePct.toFixed(2)}%`;
        changeElement.className = `text-lg font-bold ${changePct >= 0 ? 'text-emerald-400' : 'text-rose-500'}`;
      }

      // Market status badge
      if (statusElement) {
        const state = data.marketState;
        const isOpen = state === 'REGULAR';
        if (isOpen) {
          anyMarketOpen = true;
          statusElement.innerHTML = '<span class="inline-block px-1.5 py-0.5 text-[8px] font-bold rounded bg-emerald-600/30 text-emerald-300">LIVE</span>';
        } else {
          const stateLabel = state === 'PRE' ? 'PRE-MARKET' : state === 'POST' ? 'CLOSED' : 'CLOSED';
          statusElement.innerHTML = `<span class="inline-block px-1.5 py-0.5 text-[8px] font-bold rounded bg-gray-600/50 text-gray-400">${stateLabel}</span>`;
        }
      }
    } catch {}
  }));

  // Adjust refresh interval: 3s when market is open, stop when closed
  if (anyMarketOpen && !marketIndicesInterval) {
    marketIndicesInterval = setInterval(loadMarketIndices, 3000);
  } else if (!anyMarketOpen && marketIndicesInterval) {
    clearInterval(marketIndicesInterval);
    marketIndicesInterval = null;
  }
}

loadMarketIndices();
loadAnalysisTimestamps();
loadUsers().then(() => loadDashboard());
