/* ============================================
   DebraWylde.world - Static Site JS
   Mobile nav, FAQ accordion, form validation
   ============================================ */

(function () {
  'use strict';

  /* --- Mobile Navigation --- */
  const navToggle = document.querySelector('.mobile-nav-toggle');
  const nav = document.querySelector('.nav');

  if (navToggle && nav) {
    navToggle.addEventListener('click', function () {
      const isOpen = nav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });

    document.addEventListener('click', function (e) {
      if (!nav.contains(e.target) && !navToggle.contains(e.target) && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.focus();
      }
    });
  }

  /* --- FAQ Accordion --- */
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(function (item) {
    const btn = item.querySelector('.faq-item__question');
    if (!btn) return;

    btn.addEventListener('click', function () {
      const isOpen = item.classList.contains('is-open');

      faqItems.forEach(function (other) {
        other.classList.remove('is-open');
        const otherBtn = other.querySelector('.faq-item__question');
        if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
      });

      if (!isOpen) {
        item.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  function encodeMailtoBody(value) {
    return encodeURIComponent(value).replace(/%20/g, '+');
  }

  function labelForField(field) {
    const group = field.closest('.form-group');
    const label = group ? group.querySelector('label') : null;
    if (!label) return field.name || 'Field';
    return label.textContent.replace('*', '').replace(/\s+/g, ' ').trim();
  }

  function buildMailtoHref(form) {
    const recipient = form.dataset.mailtoRecipient || 'hello@debrawylde.world';
    const subject = form.dataset.mailtoSubject || 'Website enquiry';
    const lines = [
      'Hello Debra,',
      '',
      'I would like to send the following enquiry:',
      ''
    ];

    form.querySelectorAll('input, textarea, select').forEach(function (field) {
      if (!field.name || field.type === 'submit' || field.type === 'button') return;
      const value = field.value.trim();
      if (!value) return;
      lines.push(labelForField(field) + ': ' + value);
    });

    lines.push('', 'Please reply when you have a moment.', '');
    return 'mailto:' + encodeURIComponent(recipient) + '?subject=' + encodeMailtoBody(subject) + '&body=' + encodeMailtoBody(lines.join('\n'));
  }

  /* --- Form Validation & Submission --- */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validateForm(form) {
    let isValid = true;

    form.querySelectorAll('.form-group').forEach(function (group) {
      group.classList.remove('has-error');
    });

    form.querySelectorAll('[required]').forEach(function (field) {
      const group = field.closest('.form-group');
      const value = field.value.trim();

      if (!value) {
        if (group) group.classList.add('has-error');
        isValid = false;
        return;
      }

      if (field.type === 'email' && !EMAIL_RE.test(value)) {
        if (group) group.classList.add('has-error');
        isValid = false;
      }
    });

    return isValid;
  }

  function collectPayload(form) {
    const payload = {};
    form.querySelectorAll('input, textarea, select').forEach(function (field) {
      if (!field.name || field.type === 'submit' || field.type === 'button') return;
      if (field.type === 'checkbox') {
        payload[field.name] = field.checked;
        return;
      }
      payload[field.name] = field.value.trim();
    });

    // Normalise the name field so the backend always receives "name".
    if (!payload.name) {
      if (payload.full_name) payload.name = payload.full_name;
      else if (payload.first_name) payload.name = payload.first_name;
    }

    const pageFile = window.location.pathname.split('/').pop() || 'index.html';
    payload.page = window.location.pathname;
    if (!payload.source) payload.source = pageFile.replace(/\.html$/, '') || 'home';

    return payload;
  }

  function getFeedbackEl(form) {
    let el = form.querySelector('.form-feedback');
    if (!el) {
      el = document.createElement('p');
      el.className = 'form-feedback';
      el.setAttribute('role', 'alert');
      form.appendChild(el);
    }
    return el;
  }

  function clearFeedback(form) {
    const el = form.querySelector('.form-feedback');
    if (el) {
      el.textContent = '';
      el.classList.remove('is-visible');
    }
  }

  function showError(form, message) {
    const el = getFeedbackEl(form);
    el.textContent = message;
    el.classList.add('is-visible');
  }

  function setLoading(form, button, isLoading, restoreText) {
    if (isLoading) {
      if (button) {
        button.dataset.originalText = button.textContent;
        button.textContent = 'Sending...';
        button.disabled = true;
      }
      form.setAttribute('aria-busy', 'true');
    } else {
      if (button) {
        button.textContent = restoreText || button.dataset.originalText || button.textContent;
        button.disabled = false;
      }
      form.removeAttribute('aria-busy');
    }
  }

  function showSuccess(form) {
    form.style.display = 'none';
    const successEl = form.parentElement
      ? form.parentElement.querySelector('.form-success')
      : null;
    if (successEl) {
      successEl.classList.add('is-visible');
    }
  }

  function messageForError(err) {
    if (err && err.isNetwork) {
      return 'We could not reach the server right now. Please try again shortly, or email hello@debrawylde.world.';
    }
    if (err && err.status === 429) {
      return 'Too many attempts. Please wait a moment and try again.';
    }
    const data = err && err.data;
    if (data) {
      if (typeof data.message === 'string') return data.message;
      if (data.detail && typeof data.detail.message === 'string') return data.detail.message;
    }
    return 'Sorry, something went wrong sending your message. Please try again, or email hello@debrawylde.world.';
  }

  function submitToApi(form, endpoint) {
    if (!window.DebraApi || typeof window.DebraApi.postJson !== 'function') {
      // Helper missing: fall back to the static success state so the user is not stuck.
      showSuccess(form);
      return;
    }
    const button = form.querySelector('[type="submit"]');
    clearFeedback(form);
    setLoading(form, button, true);

    window.DebraApi.postJson(endpoint, collectPayload(form))
      .then(function () {
        showSuccess(form);
      })
      .catch(function (err) {
        setLoading(form, button, false);
        showError(form, messageForError(err));
      });
  }

  const forms = document.querySelectorAll('[data-prototype-form]');

  forms.forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      if (!validateForm(form)) {
        const firstError =
          form.querySelector('.has-error input, .has-error textarea') ||
          form.querySelector('[required]');
        if (firstError) firstError.focus();
        return;
      }

      const endpoint = form.getAttribute('data-api-endpoint');
      if (endpoint) {
        submitToApi(form, endpoint);
        return;
      }

      // Static fallback (no backend endpoint wired on this form).
      if (form.hasAttribute('data-mailto-form')) {
        window.location.href = buildMailtoHref(form);
      }
      showSuccess(form);
    });

    form.querySelectorAll('[required]').forEach(function (field) {
      field.addEventListener('blur', function () {
        const group = field.closest('.form-group');
        if (!group) return;

        const value = field.value.trim();
        if (value) {
          if (field.type === 'email' && !EMAIL_RE.test(value)) {
            group.classList.add('has-error');
          } else {
            group.classList.remove('has-error');
          }
        }
      });
    });
  });

  /* --- Smooth Scroll for Anchor Links --- */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  /* --- Active Nav Highlight --- */
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const isHomePath =
    currentPage === '' ||
    currentPage === 'index.html' ||
    currentPage === 'index';
  document.querySelectorAll('.nav-list a:not(.btn)').forEach(function (link) {
    const href = link.getAttribute('href');
    if (href === currentPage || (isHomePath && (href === './' || href === 'index.html'))) {
      link.classList.add('active');
    }
  });

})();
