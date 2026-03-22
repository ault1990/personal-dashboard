/* ============================================================
   PersonalDashboard — Settings → Goals
   List screen with weight management mode.
   Detail/edit screen for individual goals.
   ============================================================ */

const GoalsScreen = (() => {
  'use strict';

  const listContainer = document.getElementById('settings-goals-content');
  const detailContainer = document.getElementById('settings-goal-detail-content');
  const detailTitle = document.getElementById('goal-detail-title');
  const addBtn = document.getElementById('goals-add-btn');

  let isWeightMode = false;
  let editingGoalId = null; // null = new goal

  // --- Goal List Screen ---

  async function renderList() {
    const goals = await API.getItems('Goals');

    // Sort: active (WeightPercent desc, Name asc), then inactive at bottom
    goals.sort((a, b) => {
      const aActive = a.WeightPercent > 0;
      const bActive = b.WeightPercent > 0;
      if (aActive !== bActive) return bActive - aActive;
      if (a.WeightPercent !== b.WeightPercent) return b.WeightPercent - a.WeightPercent;
      return a.Name.localeCompare(b.Name);
    });

    if (goals.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
          </div>
          <div class="empty-state__text">No goals yet.<br>Tap + to create your first goal.</div>
        </div>
      `;
      return;
    }

    const totalWeight = goals.reduce((sum, g) => sum + (g.WeightPercent || 0), 0);

    let html = '';

    if (!isWeightMode) {
      // Normal list mode
      html += `
        <button class="btn btn--secondary btn--full mb-md" id="goals-edit-weights-btn">
          Edit Weights
        </button>
      `;
      html += goals.map(g => goalRow(g)).join('');
    } else {
      // Weight management mode
      html += `
        <div class="card mb-md" style="padding: 10px 16px;">
          <div class="flex-between">
            <span class="text-secondary" style="font-size: 13px; font-weight: 500;">Total Weight</span>
            <span style="font-size: 17px; font-weight: 700; color: ${totalWeight === 100 ? 'var(--color-success)' : 'var(--color-danger)'};">
              ${totalWeight}%
            </span>
          </div>
        </div>
      `;
      html += goals.map(g => goalWeightRow(g)).join('');
      html += `
        <div style="display: flex; gap: 10px; margin-top: 16px;">
          <button class="btn btn--secondary" style="flex:1;" id="goals-weight-cancel-btn">Cancel</button>
          <button class="btn btn--primary" style="flex:1;" id="goals-weight-save-btn" ${totalWeight !== 100 ? 'disabled' : ''}>Save</button>
        </div>
      `;
    }

    listContainer.innerHTML = html;
    bindListEvents();
  }

  function goalRow(goal) {
    const isInactive = goal.WeightPercent === 0;
    const isSystem = goal.GoalType === 'system';
    return `
      <div class="card goal-row ${isInactive ? 'text-muted' : ''}"
           data-goal-id="${goal.ID}"
           style="cursor: pointer; ${isInactive ? 'opacity: 0.5;' : ''}">
        <div class="flex-between">
          <div>
            <div style="font-weight: 600; font-size: 15px;">${escHtml(goal.Name)}</div>
            <div class="text-secondary" style="font-size: 12px; margin-top: 2px;">
              ${escHtml(goal.ActivityType)} · ${goal.TargetValue} ${escHtml(goal.TargetUnit)}
              ${isSystem ? ' · system' : ''}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 17px; font-weight: 700; color: ${isInactive ? 'var(--text-muted)' : 'var(--accent)'};">
              ${goal.WeightPercent}%
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function goalWeightRow(goal) {
    return `
      <div class="card" style="margin-bottom: 6px;">
        <div class="flex-between">
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 500; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${escHtml(goal.Name)}
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 6px; margin-left: 12px;">
            <input class="form-input goal-weight-input" type="number"
                   data-goal-id="${goal.ID}"
                   value="${goal.WeightPercent}"
                   min="0" max="100" step="5"
                   style="width: 64px; text-align: center; padding: 6px 4px; font-size: 15px;"
                   inputmode="numeric">
            <span class="text-secondary" style="font-size: 13px;">%</span>
          </div>
        </div>
      </div>
    `;
  }

  function bindListEvents() {
    // Edit weights button
    const editBtn = document.getElementById('goals-edit-weights-btn');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        isWeightMode = true;
        renderList();
      });
    }

    // Weight mode: cancel
    const cancelBtn = document.getElementById('goals-weight-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        isWeightMode = false;
        renderList();
      });
    }

    // Weight mode: save
    const saveBtn = document.getElementById('goals-weight-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', saveWeights);
    }

    // Weight mode: live total update
    listContainer.querySelectorAll('.goal-weight-input').forEach(input => {
      input.addEventListener('input', updateWeightTotal);
    });

    // Goal row tap → detail screen (only in normal mode)
    if (!isWeightMode) {
      listContainer.querySelectorAll('.goal-row').forEach(row => {
        row.addEventListener('click', () => {
          editingGoalId = parseInt(row.dataset.goalId, 10);
          App.navigateToScreen('settings-goal-detail');
        });
      });
    }
  }

  function updateWeightTotal() {
    const inputs = listContainer.querySelectorAll('.goal-weight-input');
    let total = 0;
    inputs.forEach(input => {
      total += parseInt(input.value, 10) || 0;
    });

    // Update total display
    const totalEl = listContainer.querySelector('.card .flex-between span:last-child');
    if (totalEl) {
      totalEl.textContent = total + '%';
      totalEl.style.color = total === 100 ? 'var(--color-success)' : 'var(--color-danger)';
    }

    // Enable/disable save
    const saveBtn = document.getElementById('goals-weight-save-btn');
    if (saveBtn) saveBtn.disabled = total !== 100;
  }

  async function saveWeights() {
    const inputs = listContainer.querySelectorAll('.goal-weight-input');
    const saveBtn = document.getElementById('goals-weight-save-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    try {
      for (const input of inputs) {
        const id = parseInt(input.dataset.goalId, 10);
        const weight = parseInt(input.value, 10) || 0;
        await API.updateItem('Goals', id, { WeightPercent: weight });
      }
      isWeightMode = false;
      renderList();
    } catch (err) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
      alert('Failed to save weights: ' + err.message);
    }
  }

  // --- Goal Detail/Edit Screen ---

  async function renderDetail() {
    let goal = null;
    if (editingGoalId !== null) {
      goal = await API.getItem('Goals', editingGoalId);
    }

    detailTitle.textContent = goal ? 'Edit Goal' : 'New Goal';
    const isSystem = goal && goal.GoalType === 'system';

    // System goals are not editable via this form
    if (isSystem) {
      detailContainer.innerHTML = `
        <div class="card">
          <div style="font-weight: 600; font-size: 17px; margin-bottom: 8px;">${escHtml(goal.Name)}</div>
          <div class="text-secondary" style="font-size: 13px;">
            System goals are predefined and cannot be edited.<br>
            Type: ${goal.GoalType} · Target: ${goal.TargetValue} ${escHtml(goal.TargetUnit)}
          </div>
        </div>
      `;
      return;
    }

    const goalType = goal ? goal.GoalType : 'volume';
    const isFrequency = goalType === 'frequency';

    detailContainer.innerHTML = `
      <div class="card">
        <div class="form-group">
          <label class="form-label" for="goal-type">Goal Type</label>
          <select class="form-select" id="goal-type">
            <option value="volume" ${goalType === 'volume' ? 'selected' : ''}>Volume</option>
            <option value="frequency" ${goalType === 'frequency' ? 'selected' : ''}>Frequency</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="goal-activity-type">Activity Type</label>
          <select class="form-select" id="goal-activity-type">
            <option value="run" ${goal?.ActivityType === 'run' ? 'selected' : ''}>Run</option>
            <option value="ride" ${goal?.ActivityType === 'ride' ? 'selected' : ''}>Ride</option>
            <option value="strength" ${goal?.ActivityType === 'strength' ? 'selected' : ''}>Strength</option>
            <option value="any_cardio" ${goal?.ActivityType === 'any_cardio' ? 'selected' : ''}>Any Cardio</option>
            <option value="body_metrics" ${goal?.ActivityType === 'body_metrics' ? 'selected' : ''}>Body Metrics</option>
            <option value="any" ${goal?.ActivityType === 'any' ? 'selected' : ''}>Any</option>
            <option value="custom" ${goal?.ActivityType === 'custom' ? 'selected' : ''}>Custom</option>
          </select>
        </div>

        <!-- Conditional fields container -->
        <div id="goal-conditional-fields"></div>

        <div class="form-group">
          <label class="form-label" for="goal-name">Name</label>
          <input class="form-input" type="text" id="goal-name"
                 placeholder="e.g. Weekly Running Miles"
                 value="${goal ? escAttr(goal.Name) : ''}">
        </div>

        <div class="form-group">
          <label class="form-label" for="goal-notes">Notes</label>
          <textarea class="form-textarea" id="goal-notes" placeholder="Optional">${goal ? escHtml(goal.Notes || '') : ''}</textarea>
        </div>

        <div id="goal-detail-message" style="margin-bottom: 12px;"></div>

        <button class="btn btn--primary btn--full" id="goal-save-btn">
          ${goal ? 'Save Changes' : 'Create Goal'}
        </button>
      </div>
    `;

    renderConditionalFields(goalType, goal);
    bindDetailEvents(goal);
  }

  function renderConditionalFields(goalType, goal) {
    const container = document.getElementById('goal-conditional-fields');
    const isFrequency = goalType === 'frequency';

    if (isFrequency) {
      container.innerHTML = `
        <div class="form-group">
          <label class="form-label" for="goal-target-value">Target (sessions)</label>
          <input class="form-input" type="number" id="goal-target-value"
                 min="1" step="1" inputmode="numeric"
                 placeholder="e.g. 3"
                 value="${goal ? goal.TargetValue : ''}">
        </div>

        <div class="form-group">
          <label class="form-label">Measurement Type</label>
          <input class="form-input" type="text" value="session_count" disabled
                 style="opacity: 0.5;">
        </div>

        <div class="form-group">
          <label class="form-label">Target Unit</label>
          <input class="form-input" type="text" value="sessions" disabled
                 style="opacity: 0.5;">
        </div>

        <div class="form-group">
          <label class="form-label" for="goal-garmin">Garmin-Backed</label>
          <select class="form-select" id="goal-garmin">
            <option value="false" ${!goal?.IsGarminBacked ? 'selected' : ''}>No</option>
            <option value="true" ${goal?.IsGarminBacked ? 'selected' : ''}>Yes</option>
          </select>
        </div>
      `;
    } else {
      // Volume
      container.innerHTML = `
        <div class="form-group">
          <label class="form-label" for="goal-measurement-type">Measurement Type</label>
          <select class="form-select" id="goal-measurement-type">
            <option value="distance" ${goal?.MeasurementType === 'distance' ? 'selected' : ''}>Distance</option>
            <option value="duration" ${goal?.MeasurementType === 'duration' ? 'selected' : ''}>Duration</option>
            <option value="session_count" ${goal?.MeasurementType === 'session_count' ? 'selected' : ''}>Session Count</option>
            <option value="output" ${goal?.MeasurementType === 'output' ? 'selected' : ''}>Output</option>
            <option value="custom" ${goal?.MeasurementType === 'custom' ? 'selected' : ''}>Custom</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="goal-target-value">Target Value</label>
          <input class="form-input" type="number" id="goal-target-value"
                 min="0.01" step="any" inputmode="decimal"
                 placeholder="e.g. 15"
                 value="${goal ? goal.TargetValue : ''}">
        </div>

        <div class="form-group">
          <label class="form-label" for="goal-target-unit">Target Unit</label>
          <input class="form-input" type="text" id="goal-target-unit"
                 placeholder="e.g. miles, minutes, sessions"
                 value="${goal ? escAttr(goal.TargetUnit || '') : ''}">
        </div>

        <div class="form-group">
          <label class="form-label" for="goal-garmin">Garmin-Backed</label>
          <select class="form-select" id="goal-garmin">
            <option value="false" ${!goal?.IsGarminBacked ? 'selected' : ''}>No</option>
            <option value="true" ${goal?.IsGarminBacked ? 'selected' : ''}>Yes</option>
          </select>
        </div>
      `;
    }
  }

  function bindDetailEvents(existingGoal) {
    // GoalType change → re-render conditional fields
    document.getElementById('goal-type').addEventListener('change', (e) => {
      renderConditionalFields(e.target.value, null);
    });

    // Save
    document.getElementById('goal-save-btn').addEventListener('click', () => saveGoal(existingGoal));
  }

  async function saveGoal(existingGoal) {
    const goalType = document.getElementById('goal-type').value;
    const activityType = document.getElementById('goal-activity-type').value;
    const name = document.getElementById('goal-name').value.trim();
    const notes = document.getElementById('goal-notes').value.trim();
    const targetValue = parseFloat(document.getElementById('goal-target-value').value);
    const garminSelect = document.getElementById('goal-garmin');
    const isGarminBacked = garminSelect ? garminSelect.value === 'true' : false;

    // Validation
    if (!name) {
      showDetailMessage('Name is required.', 'danger');
      return;
    }
    if (isNaN(targetValue) || targetValue <= 0) {
      showDetailMessage('Target value must be greater than 0.', 'danger');
      return;
    }

    let measurementType, targetUnit;
    if (goalType === 'frequency') {
      measurementType = 'session_count';
      targetUnit = 'sessions';
    } else {
      measurementType = document.getElementById('goal-measurement-type').value;
      targetUnit = document.getElementById('goal-target-unit')?.value.trim() || '';
      if (!targetUnit) {
        showDetailMessage('Target unit is required for volume goals.', 'danger');
        return;
      }
    }

    const fields = {
      Name: name,
      GoalType: goalType,
      ActivityType: activityType,
      IsGarminBacked: isGarminBacked,
      MeasurementType: measurementType,
      TargetValue: targetValue,
      TargetUnit: targetUnit,
      WeightPercent: existingGoal ? existingGoal.WeightPercent : 0,
      Notes: notes
    };

    const saveBtn = document.getElementById('goal-save-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    try {
      if (existingGoal) {
        await API.updateItem('Goals', existingGoal.ID, fields);
      } else {
        await API.createItem('Goals', fields);
      }
      // Navigate back to goals list
      isWeightMode = false;
      App.navigateToScreen('settings-goals');
    } catch (err) {
      showDetailMessage('Failed to save: ' + err.message, 'danger');
      saveBtn.disabled = false;
      saveBtn.textContent = existingGoal ? 'Save Changes' : 'Create Goal';
    }
  }

  function showDetailMessage(text, type) {
    const el = document.getElementById('goal-detail-message');
    if (!el) return;
    el.innerHTML = `<div class="form-error" style="color: var(--color-${type});">${text}</div>`;
  }

  // --- Navigation hooks ---

  addBtn.addEventListener('click', () => {
    editingGoalId = null;
    App.navigateToScreen('settings-goal-detail');
  });

  document.addEventListener('screen:enter', (e) => {
    if (e.detail.screen === 'settings-goals') {
      isWeightMode = false;
      renderList();
    }
    if (e.detail.screen === 'settings-goal-detail') {
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
