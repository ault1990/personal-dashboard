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
  }

  // --- Sub-Screen Navigation ---

  function navigateToScreen(screenName) {
    // Find the screen within the currently active tab
    const panel = document.querySelector(`.tab-panel[data-tab="${activeTab}"]`);
    if (!panel) return;

    const screens = panel.querySelectorAll('.tab-panel__screen');
    screens.forEach((screen) => {
      screen.classList.toggle('active', screen.dataset.screen === screenName);
    });

    // Fire a custom event so feature modules can react
    document.dispatchEvent(new CustomEvent('screen:enter', {
      detail: { tab: activeTab, screen: screenName }
    }));
  }

  function navigateBack(targetScreen) {
    navigateToScreen(targetScreen);
  }

  // --- Event Binding ---

  function bindEvents() {
    // Tab bar clicks
    tabBarItems.forEach((item) => {
      item.addEventListener('click', () => switchTab(item.dataset.tab));
    });

    // Menu item navigation (data-navigate attribute)
    document.addEventListener('click', (e) => {
      const menuItem = e.target.closest('[data-navigate]');
      if (menuItem) {
        navigateToScreen(menuItem.dataset.navigate);
      }
    });

    // Back button navigation (data-back attribute)
    document.addEventListener('click', (e) => {
      const backBtn = e.target.closest('[data-back]');
      if (backBtn) {
        navigateBack(backBtn.dataset.back);
      }
    });
  }

  // --- Service Worker ---

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.warn('SW registration failed:', err);
      });
    }
  }

  // --- WeekKey Utility ---

  /**
   * Returns the ISO week key (YYYY-WW) for a given date.
   * ISO 8601: week starts Monday, week 1 contains the year's first Thursday.
   */
  function getWeekKey(date = new Date()) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    // Set to nearest Thursday (current date + 4 - current day number, where Monday = 1, Sunday = 7)
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-${String(weekNum).padStart(2, '0')}`;
  }

  /**
   * Returns the Monday and Sunday dates for the current ISO week.
   */
  function getCurrentWeekBounds(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay();
    // Adjust to Monday (day 0 = Sunday → offset -6, else offset 1-day)
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return { monday, sunday };
  }

  /**
   * Formats a date as YYYY-MM-DD for input fields.
   */
  function formatDateInput(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Formats a number as currency string.
   */
  function formatCurrency(amount) {
    return `$${Number(amount).toFixed(2)}`;
  }

  // --- Auth-Gated Startup ---

  function showAuthStatus(message, isError) {
    const container = document.getElementById('dashboard-content');
    if (!container) return;
    const color = isError ? 'var(--color-danger)' : 'var(--text-muted)';
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__text" style="color: ${color};">
          ${message}
        </div>
      </div>
    `;
  }

  async function initAuth() {
    showAuthStatus('Signing in…', false);

    try {
      const authSuccess = await Auth.init();
      if (authSuccess) {
        console.log('[App] Auth succeeded — live SharePoint mode');
        showAuthStatus('Connected. Loading…', false);
      } else {
        console.log('[App] Auth failed — falling back to mock mode');
        API.setMockMode();
        showAuthStatus('Offline mode — using local data', false);
      }
    } catch (err) {
      console.error('[App] Auth error:', err);
      API.setMockMode();
      showAuthStatus('Auth error — using local data', true);
    }

    // Fire initial screen:enter for Dashboard so it renders
    document.dispatchEvent(new CustomEvent('screen:enter', {
      detail: { tab: 'dashboard', screen: 'dashboard-main' }
    }));
  }

  // --- Init ---

  function init() {
    bindEvents();
    registerServiceWorker();
    // Kick off auth — dashboard renders after auth resolves
    initAuth();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API for use by feature modules
  return {
    switchTab,
    navigateToScreen,
    getWeekKey,
    getCurrentWeekBounds,
    formatDateInput,
    formatCurrency,
    get activeTab() { return activeTab; }
  };
})();
