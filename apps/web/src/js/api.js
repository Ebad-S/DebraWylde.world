/* ============================================
   DebraWylde.world - Small API helper
   Single source of truth for talking to the FastAPI backend.
   Usage: window.DebraApi.postJson('/contact', payload)
   ============================================ */
(function (window) {
  'use strict';

  function getApiBaseUrl() {
    // Explicit override wins (set window.DEBRA_API_BASE_URL before this script).
    if (window.DEBRA_API_BASE_URL) {
      return String(window.DEBRA_API_BASE_URL).replace(/\/+$/, '');
    }
    // Local static-dev convenience: when serving the static site on :3000,
    // point at the API dev server on :8000. Otherwise use same-origin /api.
    var loc = window.location;
    if (
      (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1') &&
      loc.port === '3000'
    ) {
      return 'http://localhost:8000/api';
    }
    return '/api';
  }

  function buildUrl(endpoint) {
    var base = getApiBaseUrl();
    var path = endpoint.charAt(0) === '/' ? endpoint : '/' + endpoint;
    return base + path;
  }

  async function postJson(endpoint, payload) {
    var response;
    try {
      response = await fetch(buildUrl(endpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(payload || {})
      });
    } catch (networkErr) {
      var netError = new Error('network_error');
      netError.isNetwork = true;
      throw netError;
    }

    var data = null;
    try {
      data = await response.json();
    } catch (parseErr) {
      data = null;
    }

    if (!response.ok) {
      var reqError = new Error('request_failed');
      reqError.status = response.status;
      reqError.data = data;
      throw reqError;
    }

    return data;
  }

  async function getJson(endpoint) {
    var response;
    try {
      response = await fetch(buildUrl(endpoint), {
        method: 'GET',
        headers: { Accept: 'application/json' }
      });
    } catch (networkErr) {
      var netError = new Error('network_error');
      netError.isNetwork = true;
      throw netError;
    }

    var data = null;
    try {
      data = await response.json();
    } catch (parseErr) {
      data = null;
    }

    if (!response.ok) {
      var reqError = new Error('request_failed');
      reqError.status = response.status;
      reqError.data = data;
      throw reqError;
    }

    return data;
  }

  window.DebraApi = {
    getApiBaseUrl: getApiBaseUrl,
    postJson: postJson,
    getJson: getJson
  };
})(window);
