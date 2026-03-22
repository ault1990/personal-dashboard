/* ============================================================
   PersonalDashboard — Bank Ledger
   Full transaction history — credits and debits.
   Accessed from Dashboard bank balance card.
   ============================================================ */

const BankLedgerScreen = (() => {
  'use strict';

  const container = document.getElementById('bank-ledger-content');

  async function render() {
    const transactions = await API.getItems('BankTransactions');
    const rewards = await API.getItems('Rewards');
    const bankBalance = await API.getBankBalance();

    // Build reward lookup
    const rewardMap = {};
    rewards.forEach(r => { rewardMap[r.ID] = r.Name; });

    // Sort by date descending (most recent first)
    transactions.sort((a, b) => {
      if (a.Date !== b.Date) return b.Date.localeCompare(a.Date);
      return b.ID - a.ID;
    });

    let html = '';

    // Balance summary
    html += `
      <div class="card" style="text-align: center; padding: 20px;">
        <div class="text-muted" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">Current Balance</div>
        <div style="font-size: 28px; font-weight: 700; color: var(--accent); font-family: var(--font-mono);">
          ${App.formatCurrency(bankBalance)}
        </div>
      </div>
    `;

    // Transaction list
    if (transactions.length === 0) {
      html += `
        <div class="empty-state mt-md">
          <div class="empty-state__text">No transactions yet.<br>Earnings are credited at the end of each week.</div>
        </div>
      `;
    } else {
      html += `<div class="card mt-md"><div class="card__title">Transactions</div>`;
      transactions.forEach(t => {
        const isCredit = t.Type === 'credit';
        const label = isCredit
          ? `Week ${t.WeekKey} earnings`
          : `→ ${rewardMap[t.RewardID] || 'Reward #' + t.RewardID}`;
        const sign = isCredit ? '+' : '−';
        const color = isCredit ? 'var(--color-success)' : 'var(--text-secondary)';

        html += `
          <div class="flex-between" style="padding: 10px 0; border-bottom: 1px solid var(--border-subtle);">
            <div>
              <div style="font-size: 14px; font-weight: 500;">${escHtml(label)}</div>
              <div class="text-muted" style="font-size: 12px;">${t.Date}</div>
            </div>
            <div style="font-weight: 700; font-size: 15px; color: ${color}; font-family: var(--font-mono);">
              ${sign}${App.formatCurrency(t.Amount)}
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    container.innerHTML = html;
  }

  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // Screen enter hook
  document.addEventListener('screen:enter', (e) => {
    if (e.detail.screen === 'dashboard-bank-ledger') render();
  });

  return {};
})();
