/* ============================================================
   PersonalDashboard — Dashboard
   Current week only. System goals, bank, earnings, goals, rewards.
   ============================================================ */

const DashboardScreen = (() => {
  'use strict';

  const container = document.getElementById('dashboard-content');

  async function render() {
    try {
      const weekKey = App.getWeekKey();
      const config = await API.getAllConfig();
      const goals = await API.getItems('Goals');
      const activeGoals = goals.filter(g => g.WeightPercent > 0);
      const activityLog = await API.getItems('ActivityLog');
      const bankBalance = await API.getBankBalance();
      const rewards = await API.getItems('Rewards');
      const cap = config.ExtraCreditCap || 1.15;
      const maxEarning = config.WeeklyMaxEarning || 0;

      // System goal status
      const reviewGoal = goals.find(g => g.GoalType === 'system' && g.Name === 'Weekly Review');
      const weighInGoal = goals.find(g => g.GoalType === 'system' && g.Name === 'Weekly Weigh-in');
      const reviewCredited = reviewGoal
        ? activityLog.some(e => e.GoalID === reviewGoal.ID && e.WeekKey === weekKey)
        : false;
      const weighInCredited = weighInGoal
        ? activityLog.some(e => e.GoalID === weighInGoal.ID && e.WeekKey === weekKey)
        : false;

      // Compute goal progress
      const goalProgress = activeGoals.map(goal => {
        let actual = 0;
        if (goal.GoalType === 'system' || !goal.IsGarminBacked) {
          const entries = activityLog.filter(e => e.GoalID === goal.ID && e.WeekKey === weekKey);
          actual = entries.reduce((sum, e) => sum + e.Value, 0);
        }
        const target = goal.TargetValue;
        const goalCap = goal.GoalType === 'system' ? 1.0 : cap;
        const completionRatio = target > 0 ? Math.min(actual / target, goalCap) : 0;
        const weightedContribution = completionRatio * goal.WeightPercent;
        return { goal, actual, target, completionRatio, weightedContribution };
      });

      const scorePercent = goalProgress.reduce((sum, g) => sum + g.weightedContribution, 0);
      const dollarsEarned = (scorePercent / 100) * maxEarning;
      const maxWithExtra = maxEarning * cap;

      // Active rewards
      const activeRewards = [];
      for (const r of rewards) {
        if (!r.CompletedDate && r.TargetAmount > 0) {
          const allocated = await API.getRewardTotalAllocated(r.ID);
          activeRewards.push({ ...r, _totalAllocated: allocated });
        }
      }

      let html = '';

      // 1. System goal pills
      html += `
        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
          <span class="pill pill--${weighInCredited ? 'success' : 'warning'}" style="flex: 1; justify-content: center;">
            ${weighInCredited ? '✓' : '○'} Weigh-in
          </span>
          <span class="pill pill--${reviewCredited ? 'success' : 'warning'}" style="flex: 1; justify-content: center;">
            ${reviewCredited ? '✓' : '○'} Review
          </span>
        </div>
      `;

      // 2. Bank balance
      html += `
        <div class="card" style="text-align: center; padding: 20px;">
          <div class="text-muted" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">Bank Balance</div>
          <div style="font-size: 32px; font-weight: 700; color: var(--accent); font-family: var(--font-mono);">
            ${App.formatCurrency(bankBalance)}
          </div>
        </div>
      `;

      // 3. Earning stats (2×2 grid)
      html += `
        <div class="stat-grid mt-md">
          <div class="stat-cell">
            <div class="stat-cell__label">Max Earnable</div>
            <div class="stat-cell__value">${App.formatCurrency(maxEarning)}</div>
          </div>
          <div class="stat-cell">
            <div class="stat-cell__label">Max + Extra</div>
            <div class="stat-cell__value">${App.formatCurrency(maxWithExtra)}</div>
          </div>
          <div class="stat-cell">
            <div class="stat-cell__label">Weekly Score</div>
            <div class="stat-cell__value stat-cell__value--accent">${scorePercent.toFixed(1)}%</div>
          </div>
          <div class="stat-cell">
            <div class="stat-cell__label">Earned So Far</div>
            <div class="stat-cell__value stat-cell__value--accent">${App.formatCurrency(dollarsEarned)}</div>
          </div>
        </div>
      `;

      // 4. Goal cards
      if (goalProgress.length > 0) {
        html += `<div class="section-gap">`;
        goalProgress.forEach(({ goal, actual, target, completionRatio, weightedContribution }) => {
          const pct = Math.min(completionRatio * 100, 115);
          const barPct = Math.min(pct, 100);
          html += `
            <div class="card">
              <div class="flex-between mb-sm">
                <span style="font-weight: 600; font-size: 14px;">${escHtml(goal.Name)}</span>
                <span style="font-size: 13px; font-weight: 600; color: ${pct >= 100 ? 'var(--color-success)' : 'var(--accent)'};">
                  ${pct.toFixed(0)}%
                </span>
              </div>
              <div class="progress-bar mb-sm">
                <div class="progress-bar__fill ${pct >= 100 ? 'progress-bar__fill--success' : ''}"
                     style="width: ${barPct}%;"></div>
              </div>
              <div class="flex-between">
                <span class="text-muted" style="font-size: 12px;">
                  ${formatActual(actual, goal)} / ${target} ${escHtml(goal.TargetUnit)}
                </span>
                <span class="text-muted" style="font-size: 12px;">
                  ${goal.WeightPercent}% weight · ${weightedContribution.toFixed(1)} pts
                </span>
              </div>
            </div>
          `;
        });
        html += `</div>`;
      }

      // 5. Reward progress
      if (activeRewards.length > 0) {
        html += `<div class="section-gap">`;
        activeRewards.forEach(r => {
          const pct = r.TargetAmount > 0 ? Math.round((r._totalAllocated / r.TargetAmount) * 100) : 0;
          const remaining = r.TargetAmount - r._totalAllocated;
          html += `
            <div class="card">
              <div class="flex-between mb-sm">
                <span style="font-weight: 600; font-size: 14px;">${escHtml(r.Name)}</span>
                <span class="text-muted" style="font-size: 13px;">${pct}%</span>
              </div>
              <div class="progress-bar mb-sm">
                <div class="progress-bar__fill" style="width: ${Math.min(pct, 100)}%;"></div>
              </div>
              <div class="flex-between">
                <span class="text-muted" style="font-size: 12px;">
                  ${App.formatCurrency(r._totalAllocated)} / ${App.formatCurrency(r.TargetAmount)}
                </span>
                <span class="text-muted" style="font-size: 12px;">
                  ${App.formatCurrency(remaining)} remaining
                </span>
              </div>
            </div>
          `;
        });
        html += `</div>`;
      }

      // Empty state if no goals at all
      if (activeGoals.length === 0) {
        html += `
          <div class="empty-state mt-lg">
            <div class="empty-state__text">
              No active goals yet.<br>
              Go to Settings → Goals to get started.
            </div>
          </div>
        `;
      }

      container.innerHTML = html;

    } catch (err) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__text text-danger">
            Error loading dashboard: ${err.message}
          </div>
        </div>
      `;
    }
  }

  function formatActual(actual, goal) {
    // For whole-number targets (sessions, check-ins), show integer
    if (goal.GoalType === 'frequency' || goal.GoalType === 'system') {
      return Math.floor(actual);
    }
    // For volume, show one decimal
    return actual % 1 === 0 ? actual : actual.toFixed(1);
  }

  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // Render on tab switch to Dashboard
  document.addEventListener('screen:enter', (e) => {
    if (e.detail.screen === 'dashboard') render();
  });

  // Also render when Dashboard tab is active and we switch to it
  // The tab-switch doesn't fire screen:enter for tabs without sub-screens,
  // so we listen for tab clicks directly.
  const dashboardTabBtn = document.querySelector('.tab-bar__item[data-tab="dashboard"]');
  if (dashboardTabBtn) {
    dashboardTabBtn.addEventListener('click', () => {
      // Small delay to let tab switch complete
      setTimeout(render, 10);
    });
  }

  // Initial render on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(render, 50));
  } else {
    setTimeout(render, 50);
  }

  return { render };
})();
