/* ============================================================
   PersonalDashboard — Log → Weekly Review
   Current week progress, confirm button, modify goals link.
   ============================================================ */

const WeeklyReviewScreen = (() => {
  'use strict';

  const container = document.getElementById('log-weekly-review-content');

  async function render() {
    const weekKey = App.getWeekKey();
    const config = await API.getAllConfig();
    const goals = await API.getItems('Goals');
    const activeGoals = goals.filter(g => g.WeightPercent > 0);
    const activityLog = await API.getItems('ActivityLog');
    const activities = await API.getItems('Activities');
    const bankBalance = await API.getBankBalance();
    const rewards = await API.getItems('Rewards');

    // Find Weekly Review goal and check if credit earned
    const reviewGoal = goals.find(g => g.GoalType === 'system' && g.Name.toLowerCase() === 'weekly review');
    const reviewCredited = reviewGoal
      ? activityLog.some(e => e.GoalID === reviewGoal.ID && e.WeekKey === weekKey)
      : false;

    // Find Weekly Weigh-in goal and check credit
    const weighInGoal = goals.find(g => g.GoalType === 'system' && g.Name.toLowerCase() === 'weekly weigh-in');
    const weighInCredited = weighInGoal
      ? activityLog.some(e => e.GoalID === weighInGoal.ID && e.WeekKey === weekKey)
      : false;

    // Compute goal progress
    const goalProgress = await computeGoalProgress(activeGoals, activityLog, activities, weekKey, config);
    const scorePercent = goalProgress.reduce((sum, g) => sum + g.weightedContribution, 0);
    const maxEarning = config.WeeklyMaxEarning || 0;
    const dollarsEarned = (scorePercent / 100) * maxEarning;

    // Active rewards
    const activeRewards = [];
    for (const r of rewards) {
      if (!r.CompletedDate && r.TargetAmount > 0) {
        const allocated = await API.getRewardTotalAllocated(r.ID);
        activeRewards.push({ ...r, _totalAllocated: allocated });
      }
    }

    let html = '';

    // System goal indicators
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

    // === CURRENT WEEK SECTION ===
    html += `
      <div style="border-left: 3px solid var(--accent); padding-left: 12px; margin-bottom: 24px;">
        <div style="font-size: 13px; font-weight: 600; color: var(--accent); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 12px;">
          Current Week — ${weekKey}
        </div>
    `;

    // Score summary
    html += `
      <div class="card">
        <div class="card__title">Weekly Score</div>
        <div class="flex-between">
          <span class="text-secondary">Score</span>
          <span style="font-size: 22px; font-weight: 700; color: var(--accent); font-family: var(--font-mono);">
            ${scorePercent.toFixed(1)}%
          </span>
        </div>
        <div class="flex-between mt-sm">
          <span class="text-secondary" style="font-size: 13px;">Earned so far</span>
          <span style="font-weight: 600;">${App.formatCurrency(dollarsEarned)}</span>
        </div>
        <div class="flex-between mt-sm">
          <span class="text-secondary" style="font-size: 13px;">Bank balance</span>
          <span style="font-weight: 600;">${App.formatCurrency(bankBalance)}</span>
        </div>
      </div>
    `;

    // Goal progress
    html += `<div class="card mt-md"><div class="card__title">Goal Progress</div>`;
    if (goalProgress.length === 0) {
      html += `<div class="text-muted" style="font-size: 13px;">No active goals.</div>`;
    } else {
      goalProgress.forEach(g => {
        const pct = Math.min(g.completionRatio * 100, 115);
        const barPct = Math.min(pct, 100);
        html += `
          <div style="margin-bottom: 14px;">
            <div class="flex-between" style="margin-bottom: 4px;">
              <span style="font-weight: 500; font-size: 14px;">${escHtml(g.name)}</span>
              <span class="text-secondary" style="font-size: 12px;">${g.weight}%</span>
            </div>
            <div class="progress-bar" style="margin-bottom: 4px;">
              <div class="progress-bar__fill ${pct >= 100 ? 'progress-bar__fill--success' : ''}"
                   style="width: ${barPct}%;"></div>
            </div>
            <div class="flex-between">
              <span class="text-muted" style="font-size: 12px;">
                ${formatActual(g.actual, g.type, g.unit)} / ${g.target} ${escHtml(g.unit)}
              </span>
              <span class="text-muted" style="font-size: 12px;">
                ${pct.toFixed(0)}% → ${g.weightedContribution.toFixed(1)} pts
              </span>
            </div>
          </div>
        `;
      });
    }
    html += `</div>`;

    // Active rewards
    if (activeRewards.length > 0) {
      html += `<div class="card mt-md"><div class="card__title">Rewards</div>`;
      activeRewards.forEach(r => {
        const pct = r.TargetAmount > 0 ? Math.round((r._totalAllocated / r.TargetAmount) * 100) : 0;
        html += `
          <div style="margin-bottom: 12px;">
            <div class="flex-between mb-sm">
              <span style="font-weight: 500; font-size: 14px;">${escHtml(r.Name)}</span>
              <span class="text-muted" style="font-size: 12px;">${pct}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-bar__fill" style="width: ${Math.min(pct, 100)}%;"></div>
            </div>
            <div class="text-muted" style="font-size: 12px; margin-top: 4px;">
              ${App.formatCurrency(r._totalAllocated)} / ${App.formatCurrency(r.TargetAmount)}
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    // Close current week section
    html += `</div>`;

    // === NEXT WEEK SECTION ===
    html += `
      <div style="border-left: 3px solid var(--text-muted); padding-left: 12px; margin-bottom: 20px;">
        <div style="font-size: 13px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 12px;">
          Next Week
        </div>
        <div class="card">
          <div class="text-secondary" style="font-size: 13px; margin-bottom: 12px;">
            These goals will carry into next week.
          </div>
          ${activeGoals.map(g => `
            <div class="flex-between" style="padding: 6px 0; border-bottom: 1px solid var(--border-subtle);">
              <div>
                <span style="font-size: 14px;">${escHtml(g.Name)}</span>
                <span class="text-muted" style="font-size: 12px; margin-left: 6px;">${g.TargetValue} ${escHtml(g.TargetUnit)}</span>
              </div>
              <span class="text-muted" style="font-size: 13px;">${g.WeightPercent}%</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Action buttons
    html += `
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <button class="btn btn--primary btn--full" id="review-confirm-btn"
                ${reviewCredited ? 'disabled' : ''}>
          ${reviewCredited ? '✓ Review Confirmed' : 'Confirm Review'}
        </button>
        <button class="btn btn--secondary btn--full" id="review-modify-btn">
          Modify Goals
        </button>
      </div>
    `;

    container.innerHTML = html;
    bindEvents(reviewGoal, weekKey, reviewCredited);
  }

  async function computeGoalProgress(activeGoals, activityLog, activities, weekKey, config) {
    const cap = config.ExtraCreditCap || 1.15;

    return activeGoals.map(goal => {
      let actual = 0;

      if (goal.GoalType === 'system' || !goal.IsStravaBacked) {
        // Sum from ActivityLog
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
      const weightedContribution = completionRatio * goal.WeightPercent;

      return {
        id: goal.ID,
        name: goal.Name,
        type: goal.GoalType,
        actual,
        target,
        unit: goal.TargetUnit,
        weight: goal.WeightPercent,
        completionRatio,
        weightedContribution
      };
    });
  }

  function formatActual(actual, goalType, unit) {
    // Frequency and system goals show integer
    if (goalType === 'frequency' || goalType === 'system') {
      return Math.floor(actual);
    }
    // Volume goals: one decimal place
    return actual % 1 === 0 ? actual : actual.toFixed(1);
  }

  function bindEvents(reviewGoal, weekKey, alreadyCredited) {
    const confirmBtn = document.getElementById('review-confirm-btn');
    if (confirmBtn && !alreadyCredited) {
      confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Confirming…';

        try {
          if (reviewGoal) {
            await API.createItem('ActivityLog', {
              Date: App.formatDateInput(new Date()),
              GoalID: reviewGoal.ID,
              Value: 1,
              WeekKey: weekKey,
              Notes: 'Auto: Weekly Review credit'
            });
          }
          // Re-render to show updated state
          render();
        } catch (err) {
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Confirm Review';
          alert('Failed to confirm: ' + err.message);
        }
      });
    }

    const modifyBtn = document.getElementById('review-modify-btn');
    if (modifyBtn) {
      modifyBtn.addEventListener('click', () => {
        // Set flag so Goals screen knows to return here
        App._returnToWeeklyReview = true;
        App.switchTab('settings');
        setTimeout(() => App.navigateToScreen('settings-goals'), 50);
      });
    }
  }

  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // --- Screen enter hook ---
  document.addEventListener('screen:enter', (e) => {
    if (e.detail.screen === 'log-weekly-review') {
      render();
    }
  });

  return {};
})();
