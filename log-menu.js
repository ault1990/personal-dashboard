/* ============================================================
   PersonalDashboard — Log Menu
   Shows active goal progress and navigation to sub-screens.
   ============================================================ */

const LogMenuScreen = (() => {
  'use strict';

  const container = document.getElementById('log-menu-content');

  const chevronSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';

  async function render() {
    const weekKey = App.getWeekKey();
    const config = await API.getAllConfig();
    const goals = await API.getItems('Goals');
    const activeGoals = goals
      .filter(g => g.WeightPercent > 0)
      .sort((a, b) => {
        if (a.WeightPercent !== b.WeightPercent) return b.WeightPercent - a.WeightPercent;
        return a.Name.localeCompare(b.Name);
      });
    const activityLog = await API.getItems('ActivityLog');
    const activities = await API.getItems('Activities');
    const cap = config.ExtraCreditCap || 1.15;

    // Compute goal progress
    const goalProgress = activeGoals.map(goal => {
      let actual = 0;
      if (goal.GoalType === 'system' || !goal.IsStravaBacked) {
        const entries = activityLog.filter(e => e.GoalID === goal.ID && e.WeekKey === weekKey);
        actual = entries.reduce((sum, e) => sum + e.Value, 0);
      } else {
        // Strava-backed: aggregate from Activities by SportType + WeekKey per §7.8
        const matching = activities.filter(a => a.SportType === goal.ActivityType && a.WeekKey === weekKey);
        switch (goal.MeasurementType) {
          case 'distance':
            actual = matching.reduce((sum, a) => sum + (a.DistanceMeters || 0), 0) / 1609.34;
            break;
          case 'duration':
            actual = matching.reduce((sum, a) => sum + (a.MovingTimeSeconds || 0), 0) / 60;
            break;
          case 'session_count':
            actual = matching.length;
            break;
          case 'output':
            actual = matching.reduce((sum, a) => sum + (a.Kilojoules || 0), 0);
            break;
        }
      }
      const target = goal.TargetValue;
      const goalCap = goal.GoalType === 'system' ? 1.0 : cap;
      const completionRatio = target > 0 ? Math.min(actual / target, goalCap) : 0;
      return { goal, actual, target, completionRatio };
    });

    let html = '';

    // Menu items
    html += `<div class="menu-list">`;

    html += `
      <div class="menu-item" data-navigate="log-activity">
        <div class="menu-item__icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div>
          <div class="menu-item__label">Log Activity</div>
          <div class="menu-item__sublabel">Manual goal entry</div>
        </div>
        <div class="menu-item__chevron">${chevronSvg}</div>
      </div>
    `;

    html += `
      <div class="menu-item" data-navigate="log-body-metrics">
        <div class="menu-item__icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
        </div>
        <div>
          <div class="menu-item__label">Log Body Metrics</div>
          <div class="menu-item__sublabel">Weight &amp; measurements</div>
        </div>
        <div class="menu-item__chevron">${chevronSvg}</div>
      </div>
    `;

    html += `
      <div class="menu-item" data-navigate="log-weekly-review">
        <div class="menu-item__icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        </div>
        <div>
          <div class="menu-item__label">Weekly Review</div>
          <div class="menu-item__sublabel">Review &amp; confirm goals</div>
        </div>
        <div class="menu-item__chevron">${chevronSvg}</div>
      </div>
    `;

    html += `</div>`;

    // Goal progress summary
    if (goalProgress.length > 0) {
      html += `<div class="card" style="margin: 16px;">`;
      html += `<div class="card__title">This Week — ${weekKey}</div>`;
      goalProgress.forEach(({ goal, actual, target, completionRatio }) => {
        const pct = Math.min(completionRatio * 100, 115);
        const barPct = Math.min(pct, 100);
        html += `
          <div style="margin-bottom: 10px;">
            <div class="flex-between" style="margin-bottom: 3px;">
              <span style="font-size: 13px; font-weight: 500;">${escHtml(goal.Name)}</span>
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
      });
      html += `</div>`;
    }

    container.innerHTML = html;
  }

  function formatActual(actual, goal) {
    if (goal.GoalType === 'frequency' || goal.GoalType === 'system') {
      return Math.floor(actual);
    }
    return actual % 1 === 0 ? actual : actual.toFixed(1);
  }

  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // Render on screen enter and on Log tab click
  document.addEventListener('screen:enter', (e) => {
    if (e.detail.screen === 'log-menu') render();
  });

  const logTabBtn = document.querySelector('.tab-bar__item[data-tab="log"]');
  if (logTabBtn) {
    logTabBtn.addEventListener('click', () => setTimeout(render, 10));
  }

  return {};
})();
