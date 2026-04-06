/* ============================================================
   PersonalDashboard — Settings → Rewards
   List screen, detail/edit, allocation, copy.
   ============================================================ */

const RewardsScreen = (() => {
  'use strict';

  const listContainer = document.getElementById('settings-rewards-content');
  const detailContainer = document.getElementById('settings-reward-detail-content');
  const detailTitle = document.getElementById('reward-detail-title');
  const addBtn = document.getElementById('rewards-add-btn');

  let editingRewardId = null; // null = new reward

  // --- Derived status ---

  function getRewardStatus(reward, totalAllocated) {
    if (reward.CompletedDate) return 'Completed';
    if (reward.TargetAmount === 0) return 'Inactive';
    return 'Active';
  }

  // Truncate ISO timestamp to YYYY-MM-DD for date inputs and display
  function toDateString(val) {
    if (!val) return '';
    return String(val).split('T')[0];
  }

  // --- Reward List Screen ---

  async function renderList() {
    const rewards = await API.getItems('Rewards');

    // Enrich with TotalAllocated
    for (const r of rewards) {
      r._totalAllocated = await API.getRewardTotalAllocated(r.ID);
      r._status = getRewardStatus(r, r._totalAllocated);
    }

    if (rewards.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
          </div>
          <div class="empty-state__text">No rewards yet.<br>Tap + to create your first reward.</div>
        </div>
      `;
      return;
    }

    // Three-tier sort: Active (TargetAmount desc), Completed (CompletedDate desc), Inactive (StartDate desc)
    const active = rewards.filter(r => r._status === 'Active').sort((a, b) => b.TargetAmount - a.TargetAmount);
    const completed = rewards.filter(r => r._status === 'Completed').sort((a, b) => new Date(b.CompletedDate) - new Date(a.CompletedDate));
    const inactive = rewards.filter(r => r._status === 'Inactive').sort((a, b) => new Date(b.StartDate) - new Date(a.StartDate));

    const sorted = [...active, ...completed, ...inactive];

    listContainer.innerHTML = sorted.map(r => rewardRow(r)).join('');
    bindListEvents();
  }

  function rewardRow(reward) {
    const pct = reward.TargetAmount > 0
      ? Math.round((reward._totalAllocated / reward.TargetAmount) * 100)
      : 0;
    const isGreyed = reward._status !== 'Active';

    return `
      <div class="card reward-row" data-reward-id="${reward.ID}"
           style="cursor: pointer; ${isGreyed ? 'opacity: 0.5;' : ''}">
        <div class="flex-between mb-sm">
          <div style="font-weight: 600; font-size: 15px;">${escHtml(reward.Name)}</div>
          <span class="pill pill--${reward._status === 'Active' ? 'warning' : 'success'}"
                style="font-size: 11px; padding: 3px 8px;">
            ${reward._status}
          </span>
        </div>
        <div class="progress-bar mb-sm">
          <div class="progress-bar__fill ${reward._status === 'Completed' ? 'progress-bar__fill--success' : ''}"
               style="width: ${Math.min(pct, 100)}%;"></div>
        </div>
        <div class="flex-between">
          <span class="text-secondary" style="font-size: 13px;">
            ${App.formatCurrency(reward._totalAllocated)} / ${App.formatCurrency(reward.TargetAmount)}
          </span>
          <span class="text-secondary" style="font-size: 13px;">${pct}%</span>
        </div>
      </div>
    `;
  }

  function bindListEvents() {
    listContainer.querySelectorAll('.reward-row').forEach(row => {
      row.addEventListener('click', () => {
        editingRewardId = parseInt(row.dataset.rewardId, 10);
        App.navigateToScreen('settings-reward-detail');
      });
    });
  }

  // --- Reward Detail/Edit Screen ---

  async function renderDetail() {
    let reward = null;
    let totalAllocated = 0;
    let transactions = [];
    let bankBalance = 0;

    if (editingRewardId !== null) {
      reward = await API.getItem('Rewards', editingRewardId);
      totalAllocated = await API.getRewardTotalAllocated(editingRewardId);
      const allTx = await API.getItems('BankTransactions');
      transactions = allTx.filter(t => t.Type === 'debit' && t.RewardID === editingRewardId);
      bankBalance = await API.getBankBalance();
    } else {
      bankBalance = await API.getBankBalance();
    }

    const status = reward ? getRewardStatus(reward, totalAllocated) : 'Active';
    const isCompleted = status === 'Completed';
    const isEditable = !isCompleted;

    detailTitle.textContent = reward ? (isCompleted ? reward.Name : 'Edit Reward') : 'New Reward';

    let html = `<div class="card">`;

    if (isEditable) {
      html += `
        <div class="form-group">
          <label class="form-label" for="reward-name">Name</label>
          <input class="form-input" type="text" id="reward-name"
                 placeholder="e.g. New PC"
                 value="${reward ? escAttr(reward.Name) : ''}">
        </div>

        <div class="form-group">
          <label class="form-label" for="reward-description">Description</label>
          <textarea class="form-textarea" id="reward-description"
                    placeholder="Optional">${reward ? escHtml(reward.Description || '') : ''}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label" for="reward-target">Target Amount ($)</label>
          <input class="form-input" type="number" id="reward-target"
                 min="0" step="0.01" inputmode="decimal"
                 placeholder="e.g. 500"
                 value="${reward ? reward.TargetAmount : ''}">
          ${reward && totalAllocated > 0 ? `<div class="form-hint">Cannot be set below current allocated: ${App.formatCurrency(totalAllocated)}</div>` : ''}
        </div>

        <div class="form-group">
          <label class="form-label" for="reward-start-date">Start Date</label>
          <input class="form-input" type="date" id="reward-start-date"
                 value="${reward ? toDateString(reward.StartDate) : App.formatDateInput(new Date())}">
        </div>

        <div id="reward-detail-message" style="margin-bottom: 12px;"></div>

        <button class="btn btn--primary btn--full" id="reward-save-btn">
          ${reward ? 'Save Changes' : 'Create Reward'}
        </button>
      `;
    } else {
      // Completed — read-only view
      html += `
        <div style="margin-bottom: 12px;">
          <div style="font-weight: 600; font-size: 17px;">${escHtml(reward.Name)}</div>
          ${reward.Description ? `<div class="text-secondary mt-sm" style="font-size: 13px;">${escHtml(reward.Description)}</div>` : ''}
        </div>
        <div class="flex-between mb-sm">
          <span class="text-secondary" style="font-size: 13px;">Target</span>
          <span style="font-weight: 600;">${App.formatCurrency(reward.TargetAmount)}</span>
        </div>
        <div class="flex-between mb-sm">
          <span class="text-secondary" style="font-size: 13px;">Completed</span>
          <span class="text-success" style="font-weight: 600;">${toDateString(reward.CompletedDate)}</span>
        </div>
      `;
    }

    html += `</div>`;

    // Allocation section (active rewards only)
    if (reward && status === 'Active') {
      const remaining = reward.TargetAmount - totalAllocated;
      html += `
        <div class="card mt-md">
          <div class="card__title">Allocate Funds</div>
          <div class="flex-between mb-sm">
            <span class="text-secondary" style="font-size: 13px;">Bank Balance</span>
            <span style="font-weight: 600;">${App.formatCurrency(bankBalance)}</span>
          </div>
          <div class="flex-between mb-sm">
            <span class="text-secondary" style="font-size: 13px;">Remaining</span>
            <span style="font-weight: 600;">${App.formatCurrency(remaining)}</span>
          </div>
          <div class="form-group">
            <input class="form-input" type="number" id="reward-allocate-amount"
                   min="0.01" step="0.01" inputmode="decimal"
                   placeholder="Amount to allocate"
                   max="${Math.min(bankBalance, remaining)}">
          </div>
          <div id="reward-allocate-message" style="margin-bottom: 12px;"></div>
          <button class="btn btn--primary btn--full" id="reward-allocate-btn"
                  ${bankBalance <= 0 ? 'disabled' : ''}>
            Allocate
          </button>
        </div>
      `;
    }

    // Transaction history (existing rewards with transactions)
    if (reward && transactions.length > 0) {
      html += `
        <div class="card mt-md">
          <div class="card__title">Allocation History</div>
          ${transactions.map(t => `
            <div class="flex-between" style="padding: 6px 0; border-bottom: 1px solid var(--border-subtle);">
              <span class="text-secondary" style="font-size: 13px;">${toDateString(t.Date)}</span>
              <span style="font-weight: 600; font-size: 14px;">${App.formatCurrency(t.Amount)}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Copy button (all existing rewards)
    if (reward) {
      html += `
        <div class="mt-md">
          <button class="btn btn--secondary btn--full" id="reward-copy-btn">
            Copy Reward
          </button>
        </div>
      `;
    }

    detailContainer.innerHTML = html;
    bindDetailEvents(reward, totalAllocated, bankBalance);
  }

  function bindDetailEvents(reward, totalAllocated, bankBalance) {
    const saveBtn = document.getElementById('reward-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => saveReward(reward, totalAllocated));
    }

    const allocateBtn = document.getElementById('reward-allocate-btn');
    if (allocateBtn) {
      allocateBtn.addEventListener('click', () => allocateFunds(reward, totalAllocated, bankBalance));
    }

    const copyBtn = document.getElementById('reward-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => copyReward(reward));
    }
  }

  async function saveReward(existingReward, totalAllocated) {
    const name = document.getElementById('reward-name').value.trim();
    const description = document.getElementById('reward-description').value.trim();
    const targetAmount = parseFloat(document.getElementById('reward-target').value);
    const startDate = document.getElementById('reward-start-date').value;

    if (!name) {
      showDetailMessage('reward-detail-message', 'Name is required.', 'danger');
      return;
    }
    if (isNaN(targetAmount) || targetAmount < 0) {
      showDetailMessage('reward-detail-message', 'Target amount must be 0 or greater.', 'danger');
      return;
    }
    if (existingReward && totalAllocated > 0 && targetAmount < totalAllocated) {
      showDetailMessage('reward-detail-message', `Target cannot be below allocated amount (${App.formatCurrency(totalAllocated)}).`, 'danger');
      return;
    }

    const fields = {
      Name: name,
      Description: description,
      TargetAmount: targetAmount,
      StartDate: startDate,
      CompletedDate: null
    };

    // Check if lowering target to exactly TotalAllocated → auto-complete
    if (existingReward && totalAllocated > 0 && targetAmount === totalAllocated) {
      fields.CompletedDate = App.formatDateInput(new Date());
    }

    const saveBtn = document.getElementById('reward-save-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    try {
      if (existingReward) {
        await API.updateItem('Rewards', existingReward.ID, fields);
      } else {
        await API.createItem('Rewards', fields);
      }
      App.navigateToScreen('settings-rewards');
    } catch (err) {
      showDetailMessage('reward-detail-message', 'Failed to save: ' + err.message, 'danger');
      saveBtn.disabled = false;
      saveBtn.textContent = existingReward ? 'Save Changes' : 'Create Reward';
    }
  }

  async function allocateFunds(reward, totalAllocated, bankBalance) {
    const amountInput = document.getElementById('reward-allocate-amount');
    const amount = parseFloat(amountInput.value);
    const remaining = reward.TargetAmount - totalAllocated;

    if (isNaN(amount) || amount <= 0) {
      showDetailMessage('reward-allocate-message', 'Enter a valid amount.', 'danger');
      return;
    }
    if (amount > bankBalance) {
      showDetailMessage('reward-allocate-message', 'Amount exceeds bank balance.', 'danger');
      return;
    }
    if (amount > remaining) {
      showDetailMessage('reward-allocate-message', `Amount exceeds remaining (${App.formatCurrency(remaining)}).`, 'danger');
      return;
    }

    const allocateBtn = document.getElementById('reward-allocate-btn');
    allocateBtn.disabled = true;
    allocateBtn.textContent = 'Allocating…';

    try {
      // Write debit transaction
      await API.createItem('BankTransactions', {
        Date: App.formatDateInput(new Date()),
        Type: 'debit',
        Amount: amount,
        WeekKey: null,
        RewardID: reward.ID
      });

      // Check if reward is now complete
      const newTotalAllocated = totalAllocated + amount;
      if (newTotalAllocated >= reward.TargetAmount) {
        await API.updateItem('Rewards', reward.ID, {
          CompletedDate: App.formatDateInput(new Date())
        });
      }

      // Re-render detail to reflect changes
      renderDetail();
    } catch (err) {
      showDetailMessage('reward-allocate-message', 'Failed to allocate: ' + err.message, 'danger');
      allocateBtn.disabled = false;
      allocateBtn.textContent = 'Allocate';
    }
  }

  function copyReward(sourceReward) {
    editingRewardId = null;
    App.navigateToScreen('settings-reward-detail');
    setTimeout(() => {
      const nameInput = document.getElementById('reward-name');
      const descInput = document.getElementById('reward-description');
      const targetInput = document.getElementById('reward-target');
      const dateInput = document.getElementById('reward-start-date');
      if (nameInput) nameInput.value = sourceReward.Name;
      if (descInput) descInput.value = sourceReward.Description || '';
      if (targetInput) targetInput.value = sourceReward.TargetAmount;
      if (dateInput) dateInput.value = App.formatDateInput(new Date());
    }, 50);
  }

  function showDetailMessage(containerId, text, type) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `<div class="form-error" style="color: var(--color-${type});">${text}</div>`;
    setTimeout(() => { if (el) el.innerHTML = ''; }, 3000);
  }

  // --- Navigation hooks ---

  addBtn.addEventListener('click', () => {
    editingRewardId = null;
    App.navigateToScreen('settings-reward-detail');
  });

  document.addEventListener('screen:enter', (e) => {
    if (e.detail.screen === 'settings-rewards') {
      renderList();
    }
    if (e.detail.screen === 'settings-reward-detail') {
      renderDetail();
    }
  });

  // --- Utilities ---

  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function escAttr(str) {
    return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  return {};
})();
