/* ============================================================
   PersonalDashboard — API Layer
   All SharePoint CRUD operations go through this module.
   
   Mock layer for local development.
   Real SharePoint REST calls when OAuth is connected.
   USE_MOCK flips automatically based on Auth.init() result.
   ============================================================ */

const API = (() => {
  'use strict';

  // --- Configuration ---
  let useMock = true; // Flipped to false by setAuth()

  // SharePoint site URL (set after OAuth)
  let siteUrl = '';
  let accessToken = '';

  // --- Mock Data Store ---
  const mockStore = {
    Config: [
      { ID: 1, Key: 'WeeklyMaxEarning', Value: '100', Type: 'Number' },
      { ID: 2, Key: 'ExtraCreditCap', Value: '1.15', Type: 'Number' }
    ],
    Goals: [
      { ID: 1, Name: 'Weekly Running Miles', GoalType: 'volume', ActivityType: 'Run', IsStravaBacked: true, MeasurementType: 'distance', TargetValue: 15, TargetUnit: 'miles', WeightPercent: 25, Notes: '' },
      { ID: 2, Name: 'Weekly Strength Sessions', GoalType: 'frequency', ActivityType: 'WeightTraining', IsStravaBacked: true, MeasurementType: 'session_count', TargetValue: 3, TargetUnit: 'sessions', WeightPercent: 25, Notes: '' },
      { ID: 3, Name: 'Weekly Ride Minutes', GoalType: 'volume', ActivityType: 'Ride', IsStravaBacked: true, MeasurementType: 'duration', TargetValue: 60, TargetUnit: 'minutes', WeightPercent: 20, Notes: '' },
      { ID: 4, Name: 'Take Out Trash', GoalType: 'frequency', ActivityType: 'custom', IsStravaBacked: false, MeasurementType: 'session_count', TargetValue: 3, TargetUnit: 'sessions', WeightPercent: 10, Notes: '' },
      { ID: 5, Name: 'Weekly Weigh-in', GoalType: 'system', ActivityType: 'body_metrics', IsStravaBacked: false, MeasurementType: 'session_count', TargetValue: 1, TargetUnit: 'check-ins', WeightPercent: 10, Notes: '' },
      { ID: 6, Name: 'Weekly Review', GoalType: 'system', ActivityType: 'any', IsStravaBacked: false, MeasurementType: 'session_count', TargetValue: 1, TargetUnit: 'check-ins', WeightPercent: 10, Notes: '' }
    ],
    ActivityLog: [],
    BodyMetrics: [],
    WeeklyGoalResults: [],
    WeeklyScores: [],
    Rewards: [],
    BankTransactions: [],
    Activities: [],
    StravaTokens: []
  };

  let mockIdCounters = {};

  function getNextMockId(listName) {
    if (!mockIdCounters[listName]) {
      const existing = mockStore[listName] || [];
      mockIdCounters[listName] = existing.length > 0
        ? Math.max(...existing.map(r => r.ID)) + 1
        : 1;
    }
    return mockIdCounters[listName]++;
  }

  // --- Mock CRUD ---

  function mockGetItems(listName, filter) {
    let items = [...(mockStore[listName] || [])];
    if (filter) {
      items = items.filter(filter);
    }
    return Promise.resolve(items);
  }

  function mockGetItem(listName, id) {
    const item = (mockStore[listName] || []).find(r => r.ID === id);
    return Promise.resolve(item || null);
  }

  function mockCreateItem(listName, fields) {
    if (!mockStore[listName]) mockStore[listName] = [];
    const item = { ID: getNextMockId(listName), ...fields };
    mockStore[listName].push(item);
    return Promise.resolve(item);
  }

  function mockUpdateItem(listName, id, fields) {
    const list = mockStore[listName] || [];
    const idx = list.findIndex(r => r.ID === id);
    if (idx === -1) return Promise.reject(new Error(`Item ${id} not found in ${listName}`));
    list[idx] = { ...list[idx], ...fields };
    return Promise.resolve(list[idx]);
  }

  function mockDeleteItem(listName, id) {
    const list = mockStore[listName] || [];
    const idx = list.findIndex(r => r.ID === id);
    if (idx === -1) return Promise.reject(new Error(`Item ${id} not found in ${listName}`));
    list.splice(idx, 1);
    return Promise.resolve(true);
  }

  // --- SharePoint REST helpers ---

  async function ensureFreshToken() {
    // If Auth module exists and we're not in mock mode, refresh the token
    if (typeof Auth !== 'undefined' && Auth.isAuthenticated) {
      try {
        accessToken = await Auth.getAccessToken();
      } catch (err) {
        console.error('[API] Token refresh failed:', err);
        throw new Error('Authentication expired. Please reload the page.');
      }
    }
  }

  async function spRequest(url, options = {}) {
    await ensureFreshToken();

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json;odata=nometadata',
        'Content-Type': 'application/json;odata=nometadata',
        ...options.headers
      },
      ...options
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`SharePoint API error ${response.status}: ${err}`);
    }
    if (response.status === 204) return null; // No content (delete, update)
    return response.json();
  }

  function listUrl(listName) {
    return `${siteUrl}/_api/web/lists/getbytitle('${listName}')/items`;
  }

  async function spGetItems(listName, odataFilter) {
    let url = listUrl(listName);
    // SharePoint caps default page at 100 items; request up to 5000
    url += '?$top=5000';
    if (odataFilter) url += `&$filter=${encodeURIComponent(odataFilter)}`;
    const data = await spRequest(url);
    return data.value || [];
  }

  async function spGetItem(listName, id) {
    const url = `${listUrl(listName)}(${id})`;
    return spRequest(url);
  }

  async function spCreateItem(listName, fields) {
    return spRequest(listUrl(listName), {
      method: 'POST',
      body: JSON.stringify(fields)
    });
  }

  async function spUpdateItem(listName, id, fields) {
    const url = `${listUrl(listName)}(${id})`;
    return spRequest(url, {
      method: 'PATCH',
      headers: { 'IF-MATCH': '*' },
      body: JSON.stringify(fields)
    });
  }

  async function spDeleteItem(listName, id) {
    const url = `${listUrl(listName)}(${id})`;
    return spRequest(url, {
      method: 'DELETE',
      headers: { 'IF-MATCH': '*' }
    });
  }

  // --- Public API (delegates to mock or SharePoint) ---
  //
  // `filter` parameter behavior:
  //   Mock mode  → JavaScript function (item) => boolean
  //   Live mode  → OData filter string, e.g. "Key eq 'WeeklyMaxEarning'"
  //   If a JS function is passed in live mode, it's ignored (all items returned).

  function getItems(listName, filter) {
    if (useMock) return mockGetItems(listName, filter);
    const odataFilter = typeof filter === 'string' ? filter : undefined;
    return spGetItems(listName, odataFilter);
  }

  function getItem(listName, id) {
    if (useMock) return mockGetItem(listName, id);
    return spGetItem(listName, id);
  }

  function createItem(listName, fields) {
    if (useMock) return mockCreateItem(listName, fields);
    return spCreateItem(listName, fields);
  }

  function updateItem(listName, id, fields) {
    if (useMock) return mockUpdateItem(listName, id, fields);
    return spUpdateItem(listName, id, fields);
  }

  function deleteItem(listName, id) {
    if (useMock) return mockDeleteItem(listName, id);
    return spDeleteItem(listName, id);
  }

  // --- Config convenience methods ---
  //
  // These use OData filters in live mode, JS filters in mock mode.

  async function getConfig(key) {
    let items;
    if (useMock) {
      items = await mockGetItems('Config', (item) => item.Key === key);
    } else {
      items = await spGetItems('Config', `Key eq '${key}'`);
    }
    if (items.length === 0) return null;
    return items[0].Type === 'Number' ? Number(items[0].Value) : items[0].Value;
  }

  async function setConfig(key, value) {
    let items;
    if (useMock) {
      items = await mockGetItems('Config', (item) => item.Key === key);
    } else {
      items = await spGetItems('Config', `Key eq '${key}'`);
    }
    if (items.length === 0) {
      return createItem('Config', { Key: key, Value: String(value), Type: 'Number' });
    }
    return updateItem('Config', items[0].ID, { Value: String(value) });
  }

  async function getAllConfig() {
    const items = await getItems('Config');
    const config = {};
    items.forEach((item) => {
      config[item.Key] = item.Type === 'Number' ? Number(item.Value) : item.Value;
    });
    return config;
  }

  // --- Bank convenience methods ---
  //
  // getBankBalance: fetches all transactions and sums client-side.
  // No OData filter needed — we always need the full set.
  //
  // getRewardTotalAllocated: uses OData filter in live mode.

  async function getBankBalance() {
    const transactions = await getItems('BankTransactions');
    let balance = 0;
    transactions.forEach((t) => {
      if (t.Type === 'credit') balance += t.Amount;
      else if (t.Type === 'debit') balance -= t.Amount;
    });
    return balance;
  }

  async function getRewardTotalAllocated(rewardId) {
    let debits;
    if (useMock) {
      debits = await mockGetItems('BankTransactions', (t) => t.Type === 'debit' && t.RewardID === rewardId);
    } else {
      debits = await spGetItems('BankTransactions', `Type eq 'debit' and RewardID eq ${rewardId}`);
    }
    return debits.reduce((sum, t) => sum + t.Amount, 0);
  }

  // --- Auth ---

  function setAuth(token, site) {
    accessToken = token;
    siteUrl = site;
    useMock = false; // Switch to live SharePoint
    console.log('[API] Switched to live SharePoint mode');
  }

  function setMockMode() {
    useMock = true;
    console.log('[API] Switched to mock mode');
  }

  return {
    getItems,
    getItem,
    createItem,
    updateItem,
    deleteItem,
    getConfig,
    setConfig,
    getAllConfig,
    getBankBalance,
    getRewardTotalAllocated,
    setAuth,
    setMockMode,
    get isMock() { return useMock; }
  };
})();

// Expose for browser console debugging (Firefox can't access top-level const)
window._PD_API = API;
