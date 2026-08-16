/* ============================================
   DebraWylde.world - Pay Online (Stripe-hosted Checkout)
   The payment form is the primary entry. If the API reports Stripe is not
   configured, we swap to the inactive fallback. No card details are collected
   here; we redirect to Stripe Checkout.
   ============================================ */
(function () {
  'use strict';

  const panel = document.getElementById('stripe-payment-widget');
  const inactive = document.getElementById('payment-inactive');
  const form = document.getElementById('payment-form');
  const widgetText = document.getElementById('payment-widget-text');
  const widgetTitle = document.getElementById('payment-widget-title');
  if (!panel || !form) return;

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const COPY = {
    readyTitle: 'Pay an approved invoice',
    readyText:
      'Enter the details Debra confirmed with you, then continue to Stripe Checkout to pay securely.',
    inactiveTitle: 'Payment temporarily unavailable',
    inactiveText:
      'Online payment is not available right now. Please contact Debra if you need help with an invoice or reference.'
  };

  function setCopy(ready) {
    if (widgetTitle) {
      widgetTitle.textContent = ready ? COPY.readyTitle : COPY.inactiveTitle;
    }
    if (widgetText) {
      widgetText.textContent = ready ? COPY.readyText : COPY.inactiveText;
    }
  }

  function activateForm() {
    if (inactive) inactive.hidden = true;
    form.hidden = false;
    panel.setAttribute('data-stripe-ready', 'true');
    setCopy(true);
  }

  function showInactive() {
    if (inactive) inactive.hidden = false;
    form.hidden = true;
    panel.setAttribute('data-stripe-ready', 'false');
    setCopy(false);
  }

  function feedbackEl() {
    return form.querySelector('.form-feedback');
  }

  function showError(message) {
    const el = feedbackEl();
    if (el) {
      el.textContent = message;
      el.classList.add('is-visible');
    }
  }

  function clearError() {
    const el = feedbackEl();
    if (el) {
      el.textContent = '';
      el.classList.remove('is-visible');
    }
  }

  function validate() {
    let valid = true;
    form.querySelectorAll('.form-group').forEach(function (group) {
      group.classList.remove('has-error');
    });
    form.querySelectorAll('[required]').forEach(function (field) {
      const group = field.closest('.form-group');
      const value = field.value.trim();
      if (!value) {
        if (group) group.classList.add('has-error');
        valid = false;
        return;
      }
      if (field.type === 'email' && !EMAIL_RE.test(value)) {
        if (group) group.classList.add('has-error');
        valid = false;
      }
    });
    const amount = parseFloat(form.querySelector('[name="amount_aud"]').value);
    if (!(amount > 0)) {
      const group = form.querySelector('#pay-amount').closest('.form-group');
      if (group) group.classList.add('has-error');
      valid = false;
    }
    return valid;
  }

  function buildPayload() {
    return {
      name: form.querySelector('[name="name"]').value.trim(),
      email: form.querySelector('[name="email"]').value.trim(),
      reference: form.querySelector('[name="reference"]').value.trim(),
      amount_aud: parseFloat(form.querySelector('[name="amount_aud"]').value),
      note: form.querySelector('[name="note"]').value.trim(),
      website: (form.querySelector('[name="hp_website"]') || { value: '' }).value.trim(),
      source: 'pay-online',
      page: window.location.pathname
    };
  }

  function messageForError(err) {
    if (err && err.isNetwork) {
      return 'We could not reach the payment service. Please try again shortly, or contact Debra.';
    }
    if (err && err.status === 503) {
      return 'Online payment is not available yet. Please contact Debra to confirm your invoice details.';
    }
    const data = err && err.data;
    if (data) {
      if (data.detail && typeof data.detail.message === 'string') return data.detail.message;
      if (typeof data.message === 'string') return data.message;
    }
    return 'We could not start the payment. Please try again, or contact Debra.';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearError();
    if (!validate()) {
      const firstError = form.querySelector('.has-error input, .has-error textarea');
      if (firstError) firstError.focus();
      return;
    }

    const button = form.querySelector('[type="submit"]');
    const originalText = button ? button.textContent : '';
    if (button) {
      button.textContent = 'Redirecting...';
      button.disabled = true;
    }

    if (!window.DebraApi || typeof window.DebraApi.postJson !== 'function') {
      if (button) {
        button.textContent = originalText;
        button.disabled = false;
      }
      showError('Payment is not available in this browser session. Please refresh and try again.');
      return;
    }

    window.DebraApi.postJson('/payments/create-checkout-session', buildPayload())
      .then(function (data) {
        if (data && data.checkout_url) {
          window.location.href = data.checkout_url;
        } else {
          throw new Error('no_checkout_url');
        }
      })
      .catch(function (err) {
        if (button) {
          button.textContent = originalText;
          button.disabled = false;
        }
        if (err && err.status === 503) {
          showInactive();
        }
        showError(messageForError(err));
      });
  });

  // Keep the form visible by default. Only swap to inactive when the API
  // explicitly says Stripe is not configured.
  activateForm();
  if (window.DebraApi && typeof window.DebraApi.getJson === 'function') {
    window.DebraApi.getJson('/health')
      .then(function (data) {
        if (data && data.stripe_configured === false) {
          showInactive();
        } else {
          activateForm();
        }
      })
      .catch(function () {
        // Keep the form available for local testing if health is briefly unreachable.
        activateForm();
      });
  }
})();
