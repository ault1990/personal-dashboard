/* ============================================================
   PersonalDashboard — Auth
   Microsoft OAuth via MSAL.js 2.x (SPA with PKCE)
   Handles login, silent token refresh, and session state.
   ============================================================ */

const Auth = (() => {
  'use strict';

  // --- MSAL Configuration ---
  const CLIENT_ID = '52d0b8ea-e074-48b6-803c-e50d2d4ef887';
  const AUTHORITY = 'https://login.microsoftonline.com/common';
  const REDIRECT_URI = window.location.origin + '/index.html';
  const SITE_URL = 'https://batterandbake.sharepoint.com/sites/PersonalDashboard';

  // Scopes needed for SharePoint list CRUD
  const SCOPES = [`${SITE_URL}/.default`];
  // Fallback if .default doesn't work with delegated perms
  const SCOPES_FALLBACK = ['https://batterandbake.sharepoint.com/.default'];

  let msalInstance = null;
  let activeAccount = null;

  // --- Initialize MSAL ---

  function createMsalInstance() {
    const msalConfig = {
      auth: {
        clientId: CLIENT_ID,
        authority: AUTHORITY,
        redirectUri: REDIRECT_URI,
        navigateToLoginRequestUrl: true
      },
      cache: {
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false
      }
    };

    msalInstance = new msal.PublicClientApplication(msalConfig);
  }

  // --- Login Flow ---

  async function login() {
    try {
      // Try silent login first (returning user with cached token)
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        activeAccount = accounts[0];
        msalInstance.setActiveAccount(activeAccount);
        console.log('[Auth] Found cached account:', activeAccount.username);
        return true;
      }

      // Handle redirect response (if returning from login redirect)
      const redirectResponse = await msalInstance.handleRedirectPromise();
      if (redirectResponse) {
        activeAccount = redirectResponse.account;
        msalInstance.setActiveAccount(activeAccount);
        console.log('[Auth] Login via redirect:', activeAccount.username);
        return true;
      }

      // No cached session — trigger interactive login via popup
      const loginResponse = await msalInstance.loginPopup({
        scopes: ['User.Read'],
        prompt: 'select_account'
      });
      activeAccount = loginResponse.account;
      msalInstance.setActiveAccount(activeAccount);
      console.log('[Auth] Login via popup:', activeAccount.username);
      return true;

    } catch (err) {
      console.error('[Auth] Login failed:', err);

      // If popup was blocked, fall back to redirect
      if (err.errorCode === 'popup_window_error' || err.errorCode === 'empty_window_error') {
        console.log('[Auth] Popup blocked — falling back to redirect');
        await msalInstance.loginRedirect({
          scopes: ['User.Read'],
          prompt: 'select_account'
        });
        return false; // Page will redirect
      }

      return false;
    }
  }

  // --- Token Acquisition ---

  async function getAccessToken() {
    if (!activeAccount) {
      throw new Error('No active account. Call Auth.login() first.');
    }

    const tokenRequest = {
      scopes: SCOPES,
      account: activeAccount
    };

    try {
      // Try silent token acquisition (uses cached/refreshed token)
      const response = await msalInstance.acquireTokenSilent(tokenRequest);
      return response.accessToken;
    } catch (silentErr) {
      console.warn('[Auth] Silent token failed, trying fallback scopes...', silentErr);

      // Try fallback scopes
      try {
        const fallbackRequest = { scopes: SCOPES_FALLBACK, account: activeAccount };
        const response = await msalInstance.acquireTokenSilent(fallbackRequest);
        return response.accessToken;
      } catch (fallbackErr) {
        console.warn('[Auth] Fallback silent failed, trying popup...', fallbackErr);

        // Silent failed — need interactive consent
        try {
          const response = await msalInstance.acquireTokenPopup(tokenRequest);
          return response.accessToken;
        } catch (popupErr) {
          console.error('[Auth] Token acquisition failed:', popupErr);
          throw popupErr;
        }
      }
    }
  }

  // --- Logout ---

  function logout() {
    msalInstance.logoutPopup({
      account: activeAccount,
      postLogoutRedirectUri: REDIRECT_URI
    });
    activeAccount = null;
  }

  // --- Public Init ---

  async function init() {
    createMsalInstance();
    const success = await login();
    if (success) {
      // Get an initial token and wire it into the API layer
      try {
        const token = await getAccessToken();
        API.setAuth(token, SITE_URL);
        console.log('[Auth] API layer connected to SharePoint');
        return true;
      } catch (err) {
        console.error('[Auth] Failed to get initial access token:', err);
        console.log('[Auth] Falling back to mock data');
        return false;
      }
    }
    return false;
  }

  return {
    init,
    getAccessToken,
    logout,
    get isAuthenticated() { return activeAccount !== null; },
    get account() { return activeAccount; },
    get siteUrl() { return SITE_URL; }
  };
})();
