/* ============================================================
   PersonalDashboard — Settings → Config
   Two fields: WeeklyMaxEarning, ExtraCreditCap
   Reads from and writes to Config list via API.
   ============================================================ */

const ConfigScreen = (() => {
  'use strict';

  const container = document.getElementById('settings-config-content');
  let loaded = false;

  // --- Render ---

  function render() {
    container.innerHTML = `
      <div class="card">
        <div class="form-group">
          <label class="form-label" for="config-weekly-max">Weekly Max Earning ($)</label>
          <input class="form-input" type="number" id="config-weekly-max"
                 min="0.01" step="0.01" placeholder="e.g. 100" inputmode="decimal">
          <div class="form-hint">Maximum dollars earnable per week across all rewards.</div>
        </div>

        <div class="form-group">
          <label class="form-label" for="config-extra-credit-cap">Extra Credit Cap (%)</label>
          <input class="form-input" type="number" id="config-extra-credit-cap"
                 min="100" step="1" placeholder="e.g. 115" inputmode="numeric">
          <div class="form-hint">Per-goal ceiling for Volume and Frequency goals. 115 = 15% max bonus.</div>
        </div>

        <div id="config-message" style="margin-bottom: 12px;"></div>

        <button class="btn btn--primary btn--full" id="config-save-btn">Save</button>
      </div>

      <div class="mt-md" style="text-align: center;">
        <span class="text-muted" style="font-size: 12px;" id="config-mode-label"></span>
      </div>
    `;

    bindEvents();
    loadValues();
  }

  // --- Load values from API ---

  async function loadValues() {
    try {
      const config = await API.getAllConfig();

      const maxInput = document.getElementById('config-weekly-max');
      const capInput = document.getElementById('config-extra-credit-cap');
      const modeLabel = document.getElementById('config-mode-label');

      if (config.WeeklyMaxEarning !== undefined) {
        maxInput.value = config.WeeklyMaxEarning;
      }
      if (config.ExtraCreditCap !== undefined) {
        // Stored as decimal (1.15), displayed as percentage (115)
        capInput.value = Math.round(config.ExtraCreditCap * 100);
      }

      if (API.isMock) {
        modeLabel.textContent = 'Using local mock data';
      }

      loaded = true;
    } catch (err) {
      showMessage('Failed to load config: ' + err.message, 'danger');
    }
  }

  // --- Save ---

  async function save() {
    const maxInput = document.getElementById('config-weekly-max');
    const capInput = document.getElementById('config-extra-credit-cap');
    const maxVal = parseFloat(maxInput.value);
    const capVal = parseInt(capInput.value, 10);

    // Validation
    if (isNaN(maxVal) || maxVal <= 0) {
      showMessage('Weekly Max Earning must be greater than 0.', 'danger');
      maxInput.focus();
      return;
    }

    if (isNaN(capVal) || capVal <= 100) {
      showMessage('Extra Credit Cap must be greater than 100%.', 'danger');
      capInput.focus();
      return;
    }

    const saveBtn = document.getElementById('config-save-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    try {
      await API.setConfig('WeeklyMaxEarning', maxVal);
      await API.setConfig('ExtraCreditCap', capVal / 100); // Convert percentage to decimal
      showMessage('Config saved.', 'success');
    } catch (err) {
      showMessage('Failed to save: ' + err.message, 'danger');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
    }
  }

  // --- Message display ---

  function showMessage(text, type) {
    const el = document.getElementById('config-message');
    if (!el) return;
    el.innerHTML = `<div class="form-${type === 'success' ? 'hint' : 'error'}" style="color: var(--color-${type});">${text}</div>`;
    setTimeout(() => { if (el) el.innerHTML = ''; }, 3000);
  }

  // --- Events ---

  function bindEvents() {
    document.getElementById('config-save-btn').addEventListener('click', save);
  }

  // --- Screen enter hook ---

  document.addEventListener('screen:enter', (e) => {
    if (e.detail.screen === 'settings-config') {
      if (!loaded) render();
      else loadValues(); // Refresh values on re-entry
    }
  });

  // Initial render if we land on this screen (unlikely but safe)
  function init() {
    render();
  }

  return { init };
})();
