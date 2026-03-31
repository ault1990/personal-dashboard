/* ============================================================
   PersonalDashboard — Log → Log Body Metrics
   Weight (required), measurements (optional).
   Triggers Weekly Weigh-in system goal credit on first save of week.
   ============================================================ */

const LogBodyMetricsScreen = (() => {
  'use strict';

  const container = document.getElementById('log-body-metrics-content');

  async function render() {
    const today = App.formatDateInput(new Date());

    container.innerHTML = `
      <div class="card">
        <div class="form-group">
          <label class="form-label" for="bm-date">Date</label>
          <input class="form-input" type="date" id="bm-date" value="${today}">
          <div id="bm-date-warning" style="margin-top: 4px;"></div>
        </div>

        <div class="form-group">
          <label class="form-label" for="bm-weight">Weight (lbs) *</label>
          <input class="form-input" type="number" id="bm-weight"
                 min="0" step="0.1" inputmode="decimal"
                 placeholder="Required">
        </div>

        <div style="border-top: 1px solid var(--border-subtle); margin: 16px 0; padding-top: 16px;">
          <div class="text-muted" style="font-size: 12px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 500;">
            Measurements (optional, inches)
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" for="bm-chest">Chest</label>
              <input class="form-input" type="number" id="bm-chest" min="0" step="0.1" inputmode="decimal">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" for="bm-waist">Waist</label>
              <input class="form-input" type="number" id="bm-waist" min="0" step="0.1" inputmode="decimal">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" for="bm-hips">Hips</label>
              <input class="form-input" type="number" id="bm-hips" min="0" step="0.1" inputmode="decimal">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" for="bm-biceps">Biceps</label>
              <input class="form-input" type="number" id="bm-biceps" min="0" step="0.1" inputmode="decimal">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" for="bm-thighs">Thighs</label>
              <input class="form-input" type="number" id="bm-thighs" min="0" step="0.1" inputmode="decimal">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" for="bm-calves">Calves</label>
              <input class="form-input" type="number" id="bm-calves" min="0" step="0.1" inputmode="decimal">
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="bm-notes">Notes</label>
          <textarea class="form-textarea" id="bm-notes" placeholder="Optional"></textarea>
        </div>

        <div id="bm-message" style="margin-bottom: 12px;"></div>

        <button class="btn btn--primary btn--full" id="bm-save-btn">Save</button>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    document.getElementById('bm-date').addEventListener('change', validateDate);
    document.getElementById('bm-save-btn').addEventListener('click', save);
  }

  function validateDate() {
    const dateInput = document.getElementById('bm-date');
    const warningEl = document.getElementById('bm-date-warning');
    const saveBtn = document.getElementById('bm-save-btn');
    const dateVal = dateInput.value;

    if (!dateVal) {
      warningEl.innerHTML = '';
      saveBtn.disabled = false;
      return true;
    }

    const selectedDate = new Date(dateVal + 'T12:00:00');
    const { monday, sunday } = App.getCurrentWeekBounds();
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    if (selectedDate < monday || selectedDate > sunday) {
      warningEl.innerHTML = `<div class="form-error">Date must be within the current week.</div>`;
      saveBtn.disabled = true;
      return false;
    }

    if (selectedDate > today) {
      warningEl.innerHTML = `<div class="form-hint" style="color: var(--color-warning);">Future date — entry will still be saved.</div>`;
      saveBtn.disabled = false;
      return true;
    }

    warningEl.innerHTML = '';
    saveBtn.disabled = false;
    return true;
  }

  async function save() {
    const date = document.getElementById('bm-date').value;
    const weight = parseFloat(document.getElementById('bm-weight').value);

    if (!date) {
      showMessage('Date is required.', 'danger');
      return;
    }
    if (isNaN(weight) || weight <= 0) {
      showMessage('Weight is required.', 'danger');
      return;
    }
    if (!validateDate()) return;

    const weekKey = App.getWeekKey(new Date(date + 'T12:00:00'));

    const fields = {
      Date: date,
      Weight: weight,
      Chest: parseOptional('bm-chest'),
      Waist: parseOptional('bm-waist'),
      Hips: parseOptional('bm-hips'),
      Biceps: parseOptional('bm-biceps'),
      Thighs: parseOptional('bm-thighs'),
      Calves: parseOptional('bm-calves'),
      Notes: document.getElementById('bm-notes').value.trim(),
      WeekKey: weekKey
    };

    const saveBtn = document.getElementById('bm-save-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    try {
      // Save body metrics
      await API.createItem('BodyMetrics', fields);

      // Trigger Weekly Weigh-in system goal credit (first save of week only)
      await creditWeighInGoal(weekKey);

      App.navigateToScreen('log-menu');
    } catch (err) {
      showMessage('Failed to save: ' + err.message, 'danger');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
    }
  }

  async function creditWeighInGoal(weekKey) {
    // Find Weekly Weigh-in goal
    const goals = await API.getItems('Goals');
    const weighInGoal = goals.find(g => g.GoalType === 'system' && g.Name.toLowerCase() === 'weekly weigh-in');
    if (!weighInGoal) return;

    // Check if credit already exists for this week
    const existing = await API.getItems('ActivityLog', (entry) =>
      entry.GoalID === weighInGoal.ID && entry.WeekKey === weekKey
    );
    if (existing.length > 0) return; // Already credited

    // Write credit
    await API.createItem('ActivityLog', {
      Date: App.formatDateInput(new Date()),
      GoalID: weighInGoal.ID,
      Value: 1,
      WeekKey: weekKey,
      Notes: 'Auto: Weekly Weigh-in credit'
    });
  }

  function parseOptional(inputId) {
    const val = parseFloat(document.getElementById(inputId).value);
    return isNaN(val) ? null : val;
  }

  function showMessage(text, type) {
    const el = document.getElementById('bm-message');
    if (!el) return;
    el.innerHTML = `<div class="form-error" style="color: var(--color-${type});">${text}</div>`;
  }

  // --- Screen enter hook ---
  document.addEventListener('screen:enter', (e) => {
    if (e.detail.screen === 'log-body-metrics') {
      render();
    }
  });

  return {};
})();
