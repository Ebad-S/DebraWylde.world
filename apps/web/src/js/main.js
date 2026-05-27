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

  /* --- Form Validation & Static Submit --- */
  const forms = document.querySelectorAll('[data-prototype-form]');

  forms.forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      let isValid = true;

      form.querySelectorAll('.form-group').forEach(function (group) {
        group.classList.remove('has-error');
      });

      const required = form.querySelectorAll('[required]');
      required.forEach(function (field) {
        const group = field.closest('.form-group');
        const value = field.value.trim();

        if (!value) {
          if (group) group.classList.add('has-error');
          isValid = false;
          return;
        }

        if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          if (group) group.classList.add('has-error');
          isValid = false;
        }
      });

      if (!isValid) {
        const firstError = form.querySelector('.has-error input, .has-error textarea') || form.querySelector('[required]');
        if (firstError) firstError.focus();
        return;
      }

      if (form.hasAttribute('data-mailto-form')) {
        console.info('Contact form uses mailto in this static build. No backend email service is connected yet.');
        window.location.href = buildMailtoHref(form);
      }

      form.style.display = 'none';
      const successEl = form.parentElement.querySelector('.form-success');
      if (successEl) {
        successEl.classList.add('is-visible');
      }
    });

    form.querySelectorAll('[required]').forEach(function (field) {
      field.addEventListener('blur', function () {
        const group = field.closest('.form-group');
        if (!group) return;

        const value = field.value.trim();
        if (value) {
          if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
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
