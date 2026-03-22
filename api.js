/* ============================================================
   PersonalDashboard — API Layer
   All SharePoint CRUD operations go through this module.
   
   Currently uses a local mock data store for development.
   When Microsoft OAuth is wired in, the mock layer is replaced
   with real SharePoint REST API calls — no other module changes.
   ============================================================ */

const API = (() => {
  'use strict';

  // --- Configuration ---
  const USE_MOCK = true; // Flip to false when SharePoint is connected

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
      { ID: 1, Name: 'Weekly Running Miles', GoalType: 'volume', ActivityType: 'run', IsGarminBacked: true, MeasurementType: 'distance', TargetValue: 15, TargetUnit: 'miles', WeightPercent: 25, Notes: '' },
      { ID: 2, Name: 'Weekly Strength Sessions', GoalType: 'frequency', ActivityType: 'strength', IsGarminBacked: true, MeasurementType: 'session_count', TargetValue: 3, TargetUnit: 'sessions', WeightPercent: 25, Notes: '' },
      { ID: 3, Name: 'Weekly Ride Minutes', GoalType: 'volume', ActivityType: 'ride', IsGarminBacked: true, MeasurementType: 'duration', TargetValue: 60, TargetUnit: 'minutes', WeightPercent: 20, Notes: '' },
      { ID: 4, Name: 'Take Out Trash', GoalType: 'frequency', ActivityType: 'custom', IsGarminBacked: false, MeasurementType: 'session_count', TargetValue: 3, TargetUnit: 'sessions', WeightPercent: 10, Notes: '' },
      { ID: 5, Name: 'Weekly Weigh-in', GoalType: 'system', ActivityType: 'body_metrics', IsGarminBacked: false, MeasurementType: 'session_count', TargetValue: 1, TargetUnit: 'check-ins', WeightPercent: 10, Notes: '' },
      { ID: 6, Name: 'Weekly Review', GoalType: 'system', ActivityType: 'any', IsGarminBacked: false, MeasurementType: 'session_count', TargetValue: 1, TargetUnit: 'check-ins', WeightPercent: 10, Notes: '' }
    ],
    ActivityLog: [],
    BodyMetrics: [],
    WeeklyGoalResults: [],
    WeeklyScores: [],
    Rewards: [],
    BankTransactions: []
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

  // --- SharePoint REST helpers (for when OAuth is live) ---

  async function spRequest(url, options = {}) {
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

  async function spGetItems(listName, filter) {
    let url = listUrl(listName);
    if (filter) url += `?$filter=${encodeURIComponent(filter)}`;
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

  function getItems(listName, filter) {
    if (USE_MOCK) return mockGetItems(listName, filter);
    return spGetItems(listName, typeof filter === 'string' ? filter : undefined);
  }

  function getItem(listName, id) {
    if (USE_MOCK) return mockGetItem(listName, id);
    return spGetItem(listName, id);
  }

  function createItem(listName, fields) {
    if (USE_MOCK) return mockCreateItem(listName, fields);
    return spCreateItem(listName, fields);
  }

  function updateItem(listName, id, fields) {
    if (USE_MOCK) return mockUpdateItem(listName, id, fields);
    return spUpdateItem(listName, id, fields);
  }

  function deleteItem(listName, id) {
    if (USE_MOCK) return mockDeleteItem(listName, id);
    return spDeleteItem(listName, id);
  }

  // --- Config convenience methods ---

  async function getConfig(key) {
    const items = await getItems('Config', (item) => item.Key === key);
    if (items.length === 0) return null;
    return items[0].Type === 'Number' ? Number(items[0].Value) : items[0].Value;
  }

  async function setConfig(key, value) {
    const items = await getItems('Config', (item) => item.Key === key);
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
    const debits = await getItems('BankTransactions', (t) => t.Type === 'debit' && t.RewardID === rewardId);
    return debits.reduce((sum, t) => sum + t.Amount, 0);
  }

  // --- Auth (placeholder for OAuth wiring) ---

  function setAuth(token, site) {
    accessToken = token;
    siteUrl = site;
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
    get isMock() { return USE_MOCK; }
  };
})();
