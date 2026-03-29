/* ============================================================
   PersonalDashboard — Log → Log Activity
   Manual entry for non-Strava goals.
   ============================================================ */

const LogActivityScreen = (() => {
  'use strict';

  const container = document.getElementById('log-activity-content');

  async function render() {
    // Get active non-Strava, non-system goals
    const goals = await API.getItems('Goals');
    const eligible = goals.filter(g =>
      g.WeightPercent > 0 && !g.IsStravaBacked && g.GoalType !== 'system'
    );

    if (eligible.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div class="empty-state__text">No eligible goals for manual entry.<br>Create a non-Strava goal in Settings first.</div>
        </div>
      `;
      return;
    }

    // Get activity log for progress display
    const weekKey = App.getWeekKey();
    const activityLog = await API.getItems('ActivityLog');

    const today = App.formatDateInput(new Date());

    container.innerHTML = `
      <div id="activity-goal-progress" style="margin-bottom: 12px;"></div>

      <div class="card">
        <div class="form-group">
          <label class="form-label" for="activity-goal">Goal</label>
          <select class="form-select" id="activity-goal">
            ${eligible.map(g => `
              <option value="${g.ID}">${escHtml(g.Name)} (${g.TargetValue} ${escHtml(g.TargetUnit)})</option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="activity-value">Value</label>
          <input class="form-input" type="number" id="activity-value"
                 min="0" step="any" inputmode="decimal"
                 value="1">
          <div class="form-hint" id="activity-value-hint"></div>
        </div>

        <div class="form-group">
          <label class="form-label" for="activity-date">Date</label>
          <input class="form-input" type="date" id="activity-date" value="${today}">
          <div id="activity-date-warning" style="margin-top: 4px;"></div>
        </div>

        <div class="form-group">
          <label class="form-label" for="activity-notes">Notes</label>
          <textarea class="form-textarea" id="activity-notes" placeholder="Optional"></textarea>
        </div>

        <div id="activity-message" style="margin-bottom: 12px;"></div>

        <button class="btn btn--primary btn--full" id="activity-save-btn">Save Entry</button>
      </div>
    `;

    bindEvents(eligible, activityLog, weekKey);
    updateGoalProgress(eligible, activityLog, weekKey);
    updateValueHint(eligible);
  }

  function bindEvents(goals, activityLog, weekKey) {
    const goalSelect = document.getElementById('activity-goal');
    const dateInput = document.getElementById('activity-date');
    const saveBtn = document.getElementById('activity-save-btn');

    goalSelect.addEventListener('change', () => {
      updateValueHint(goals);
      updateGoalProgress(goals, activityLog, weekKey);
    });
    dateInput.addEventListener('change', () => validateDate());
    saveBtn.addEventListener('click', () => save());
  }

  function updateGoalProgress(goals, activityLog, weekKey) {
    const goalId = parseInt(document.getElementById('activity-goal').value, 10);
    const goal = goals.find(g => g.ID === goalId);
    const progressEl = document.getElementById('activity-goal-progress');
    if (!goal || !progressEl) return;

    const entries = activityLog.filter(e => e.GoalID === goalId && e.WeekKey === weekKey);
    const actual = entries.reduce((sum, e) => sum + e.Value, 0);
    const target = goal.TargetValue;
    const pct = target > 0 ? Math.min((actual / target) * 100, 115) : 0;
    const barPct = Math.min(pct, 100);

    progressEl.innerHTML = `
      <div class="card">
        <div class="flex-between" style="margin-bottom: 4px;">
          <span style="font-size: 13px; font-weight: 500;">This Week's Progress</span>
          <span class="text-muted" style="font-size: 12px;">
            ${formatActual(actual, goal)} / ${target} ${escHtml(goal.TargetUnit)}
          </span>
        </div>
        <div class="progress-bar">
          <div class="progress-bar__fill ${pct >= 100 ? 'progress-bar__fill--success' : ''}"
               style="width: ${barPct}%;"></div>
        </div>
      </div>
    `;
  }

  function formatActual(actual, goal) {
    if (goal.GoalType === 'frequency') return Math.floor(actual);
    return actual % 1 === 0 ? actual : actual.toFixed(1);
  }

  function updateValueHint(goals) {
    const goalId = parseInt(document.getElementById('activity-goal').value, 10);
    const goal = goals.find(g => g.ID === goalId);
    const hint = document.getElementById('activity-value-hint');
    if (goal) {
      hint.textContent = `Unit: ${goal.TargetUnit}`;
    }
  }

  function validateDate() {
    const dateInput = document.getElementById('activity-date');
    const warningEl = document.getElementById('activity-date-warning');
    const saveBtn = document.getElementById('activity-save-btn');
    const dateVal = dateInput.value;

    if (!dateVal) {
      warningEl.innerHTML = '';
      saveBtn.disabled = false;
      return true;
    }

    const selectedDate = new Date(dateVal + 'T12:00:00'); // Noon to avoid TZ issues
    const { monday, sunday } = App.getCurrentWeekBounds();
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    if (selectedDate < monday || selectedDate > sunday) {
      // Outside current week — blocked
      warningEl.innerHTML = `<div class="form-error">Date must be within the current week (${formatShortDate(monday)} – ${formatShortDate(sunday)}).</div>`;
      saveBtn.disabled = true;
      return false;
    }

    if (selectedDate > today) {
      // Future date within week — warning but allowed
      warningEl.innerHTML = `<div class="form-hint" style="color: var(--color-warning);">This is a future date. Entry will still be saved.</div>`;
      saveBtn.disabled = false;
      return true;
    }

    warningEl.innerHTML = '';
    saveBtn.disabled = false;
    return true;
  }

  async function save() {
    const goalId = parseInt(document.getElementById('activity-goal').value, 10);
    const value = parseFloat(document.getElementById('activity-value').value);
    const date = document.getElementById('activity-date').value;
    const notes = document.getElementById('activity-notes').value.trim();

    if (isNaN(value) || value <= 0) {
      showMessage('Enter a valid value greater than 0.', 'danger');
      return;
    }

    if (!date) {
      showMessage('Date is required.', 'danger');
      return;
    }

    if (!validateDate()) return;

    const weekKey = App.getWeekKey(new Date(date + 'T12:00:00'));

    const saveBtn = document.getElementById('activity-save-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    try {
      await API.createItem('ActivityLog', {
        Date: date,
        GoalID: goalId,
        Value: value,
        WeekKey: weekKey,
        Notes: notes
      });

      // Navigate back to Log menu
      App.navigateToScreen('log-menu');
    } catch (err) {
      showMessage('Failed to save: ' + err.message, 'danger');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Entry';
    }
  }

  function showMessage(text, type) {
    const el = document.getElementById('activity-message');
    if (!el) return;
    el.innerHTML = `<div class="form-error" style="color: var(--color-${type});">${text}</div>`;
  }

  function formatShortDate(date) {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // --- Screen enter hook ---
  document.addEventListener('screen:enter', (e) => {
    if (e.detail.screen === 'log-activity') {
      render();
    }
  });

  return {};
})();
