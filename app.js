/* ============================================================
   PersonalDashboard — App Shell
   Tab navigation, sub-screen navigation, PWA registration
   ============================================================ */

const App = (() => {
  'use strict';

  // --- State ---
  let activeTab = 'dashboard';

  // --- DOM refs ---
  const tabPanels = document.querySelectorAll('.tab-panel');
  const tabBarItems = document.querySelectorAll('.tab-bar__item');

  // --- Tab Navigation ---

  function switchTab(tabName) {
    if (tabName === activeTab) {
      // If already on this tab, reset to root screen
      resetTabToRoot(tabName);
      return;
    }

    activeTab = tabName;

    // Update panels
    tabPanels.forEach((panel) => {
      panel.classList.toggle('active', panel.dataset.tab === tabName);
    });

    // Update tab bar
    tabBarItems.forEach((item) => {
      const isActive = item.dataset.tab === tabName;
      item.classList.toggle('active', isActive);
      item.setAttribute('aria-selected', isActive);
    });

    // Reset the target tab to its root screen
    resetTabToRoot(tabName);
  }

  function resetTabToRoot(tabName) {
    const panel = document.querySelector(`.tab-panel[data-tab="${tabName}"]`);
    if (!panel) return;

    const screens = panel.querySelectorAll('.tab-panel__screen');
    if (screens.length === 0) return; // Tab has no sub-screens (e.g. Dashboard, History)

    screens.forEach((screen, i) => {
      screen.classList.toggle('active', i === 0);
    });

    // Fire screen:enter for the root screen
    const rootScreen = screens[0];
    if (rootScreen) {
      document.dispatchEvent(new CustomEvent('screen:enter', {
        detail: { screen: rootScreen.dataset.screen }
      }));
    }
  }

  // --- Sub-screen Navigation ---

  function navigateToScreen(screenName) {
    // Find the screen element
    const screenEl = document.querySelector(`[data-screen="${screenName}"]`);
    if (!screenEl) return;

    // Find the tab panel it belongs to
    const tabPanel = screenEl.closest('.tab-panel');
    if (!tabPanel) return;

    // Hide all screens in this tab, show the target
    tabPanel.querySelectorAll('.tab-panel__screen').forEach(s => {
      s.classList.remove('active');
    });
    screenEl.classList.add('active');

    // Fire screen:enter event
    document.dispatchEvent(new CustomEvent('screen:enter', {
      detail: { screen: screenName }
    }));
  }

  // --- Tab bar click handlers ---

  tabBarItems.forEach((item) => {
    item.addEventListener('click', () => {
      const tabName = item.dataset.tab;
      switchTab(tabName);

      // Fire screen:enter for the tab's root screen (tabs without sub-screens)
      const panel = document.querySelector(`.tab-panel[data-tab="${tabName}"]`);
      if (panel) {
        const screens = panel.querySelectorAll('.tab-panel__screen');
        if (screens.length === 0) {
          // Tab has no sub-screens — fire screen:enter for the tab itself
          document.dispatchEvent(new CustomEvent('screen:enter', {
            detail: { screen: `${tabName}-main` }
          }));
        }
      }
    });
  });

  // --- Back button navigation ---

  document.addEventListener('click', (e) => {
    const backBtn = e.target.closest('[data-back]');
    if (!backBtn) return;

    const targetScreen = backBtn.dataset.back;

    // Special case: going back to a tab root
    const tabTargets = ['dashboard-main', 'log-menu', 'history-main', 'settings-menu'];
    if (tabTargets.includes(targetScreen)) {
      const tabMap = {
        'dashboard-main': 'dashboard',
        'log-menu': 'log',
        'history-main': 'history',
        'settings-menu': 'settings'
      };
      const tabName = tabMap[targetScreen];
      if (tabName) {
        switchTab(tabName);
        return;
      }
    }

    navigateToScreen(targetScreen);
  });

  // --- Sub-screen link navigation ---

  document.addEventListener('click', (e) => {
    const navEl = e.target.closest('[data-navigate]');
    if (!navEl) return;
    navigateToScreen(navEl.dataset.navigate);
  });

  // --- Week utilities ---

  function getWeekKey(date) {
    const d = date ? new Date(date) : new Date();
    // ISO 8601 week: week starts Monday
    const day = d.getDay() || 7; // Mon=1..Sun=7
    d.setDate(d.getDate() + 4 - day); // Thursday of this week
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    const year = d.getFullYear();
    return `${year}-${String(weekNo).padStart(2, '0')}`;
  }

  function getCurrentWeekBounds() {
    const now = new Date();
    const day = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - day + 1);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { start: monday, end: sunday };
  }

  function formatDateInput(date) {
    const d = date || new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function formatCurrency(amount) {
    return Number(amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }

  // --- Auth-Gated Startup ---

  function showAuthStatus(message, isError) {
    const container = document.getElementById('dashboard-content');
    if (!container) return;
    const color = isError ? 'var(--color-danger)' : 'var(--text-muted)';
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: ${color}; font-size: 14px;">
        ${message}
      </div>
    `;
  }

  async function init() {
    showAuthStatus('Signing in…', false);

    try {
      if (typeof Auth !== 'undefined') {
        const result = await Auth.init();
        if (result && result.token && result.siteUrl) {
          API.setAuth(result.token, result.siteUrl);
        } else {
          // Auth failed or returned nothing — fall back to mock
          API.setMockMode();
          showAuthStatus('Running in demo mode (auth unavailable)', false);
        }
      } else {
        API.setMockMode();
      }
    } catch (err) {
      console.error('[App] Auth init failed:', err);
      API.setMockMode();
      showAuthStatus('Running in demo mode (auth failed)', true);
    }

    // Fire initial Dashboard render
    document.dispatchEvent(new CustomEvent('screen:enter', {
      detail: { screen: 'dashboard-main' }
    }));

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(err => {
        console.warn('[App] Service worker registration failed:', err);
      });
    }
  }

  // --- Global flag for Weekly Review return navigation ---
  let _returnToWeeklyReview = false;

  // --- Public API ---
  return {
    switchTab,
    navigateToScreen,
    getWeekKey,
    getCurrentWeekBounds,
    formatDateInput,
    formatCurrency,
    init,
    get _returnToWeeklyReview() { return _returnToWeeklyReview; },
    set _returnToWeeklyReview(val) { _returnToWeeklyReview = val; }
  };
})();

// Kick off auth-gated startup
App.init();
