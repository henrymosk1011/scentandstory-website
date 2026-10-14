/* Scent and Story: interactions and scroll choreography.
   Everything degrades gracefully: without JS, or with reduced motion turned on,
   the content renders as a calm static page and all controls still work. */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasGsap = !!(window.gsap && window.ScrollTrigger && window.SplitText);
  var motion = root.classList.contains('motion') && !reduceQuery.matches && hasGsap;
  var lenis = null;

  window.__ssReady = true;
  if (!motion) root.classList.remove('motion');

  var $ = function (sel, ctx) { return (ctx || doc).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); };

  /* -------------------------------------------------------------- year */
  $$('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

  /* -------------------------------------------------------------- smooth scroll */
  function headerOffset() {
    var header = $('[data-header]');
    return header ? header.offsetHeight + 16 : 0;
  }

  function focusTarget(target) {
    if (!target.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) {
      target.setAttribute('tabindex', '-1');
    }
    target.focus({ preventScroll: true });
  }

  function scrollToTarget(target) {
    if (lenis) {
      lenis.scrollTo(target, {
        offset: target.id === 'main' ? 0 : -headerOffset() + 16,
        duration: 1.5,
        onComplete: function () { focusTarget(target); },
      });
    } else {
      target.scrollIntoView({ block: 'start' });
      focusTarget(target);
    }
  }

  /* -------------------------------------------------------------- header */
  var header = $('[data-header]');
  var lastY = window.scrollY;
  function onScrollHeader(y) {
    if (!header) return;
    header.classList.toggle('is-scrolled', y > 24);
    var down = y > lastY;
    var focusInside = header.contains(doc.activeElement);
    var hide = motion && down && y > window.innerHeight * 0.6 && !focusInside && !root.classList.contains('menu-open');
    if (Math.abs(y - lastY) > 4) header.classList.toggle('is-hidden', hide);
    lastY = y;
  }
  if (header) {
    header.addEventListener('focusin', function () { header.classList.remove('is-hidden'); });
  }

  /* -------------------------------------------------------------- mobile menu */
  var menu = $('[data-menu]');
  var toggle = $('[data-menu-toggle]');
  var inertTargets = [$('#main'), $('.site-footer'), $('.skip-link')].filter(Boolean);

  function openMenu() {
    if (!menu || !toggle) return;
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    root.classList.add('menu-open');
    inertTargets.forEach(function (el) { el.inert = true; });
    if (lenis) lenis.stop();
    else doc.body.style.overflow = 'hidden';
    if (motion) {
      gsap.fromTo(menu, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'expo.inOut' });
      gsap.fromTo($$('.menu__link span', menu), { yPercent: 110 }, { yPercent: 0, duration: 1, ease: 'expo.out', stagger: 0.06, delay: 0.35 });
      gsap.fromTo($$('.menu__foot, .menu__monogram', menu), { opacity: 0 }, { opacity: 1, duration: 0.8, delay: 0.6 });
    }
    var first = $('.menu__link', menu);
    if (first) first.focus();
  }

  function closeMenu(returnFocus) {
    if (!menu || !toggle || menu.hidden) return;
    toggle.setAttribute('aria-expanded', 'false');
    root.classList.remove('menu-open');
    inertTargets.forEach(function (el) { el.inert = false; });
    if (lenis) lenis.start();
    else doc.body.style.overflow = '';
    var finish = function () { menu.hidden = true; };
    if (motion) {
      gsap.to(menu, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.7, ease: 'expo.inOut', onComplete: finish });
    } else finish();
    if (returnFocus) toggle.focus();
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      toggle.getAttribute('aria-expanded') === 'true' ? closeMenu(true) : openMenu();
    });
  }
  doc.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && root.classList.contains('menu-open')) closeMenu(true);
  });
  window.matchMedia('(min-width: 64em)').addEventListener('change', function (e) {
    if (e.matches) closeMenu(false);
  });

  /* -------------------------------------------------------------- in page links */
  var experienceSelect = $('[data-experience-select]');
  doc.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('a[href*="#"]');
    if (!link || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    var url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) return;
    var target = doc.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!target) return;
    e.preventDefault();
    if (link.dataset.experience && experienceSelect) experienceSelect.value = link.dataset.experience;
    var wasOpen = root.classList.contains('menu-open');
    closeMenu(false);
    if (target.id !== 'main' && history.pushState) history.pushState(null, '', url.hash);
    if (wasOpen && motion) setTimeout(function () { scrollToTarget(target); }, 350);
    else scrollToTarget(target);
  });

  /* -------------------------------------------------------------- faq accordion */
  $$('[data-faq-item]').forEach(function (item, index) {
    var button = $('.faq__button', item);
    if (!button) return;
    var set = function (open) {
      button.setAttribute('aria-expanded', String(open));
      item.classList.toggle('is-open', open);
      item.classList.toggle('is-closed', !open);
    };
    set(index === 0);
    button.addEventListener('click', function () {
      set(button.getAttribute('aria-expanded') !== 'true');
      if (window.ScrollTrigger) setTimeout(function () { ScrollTrigger.refresh(); }, 650);
    });
  });

  /* -------------------------------------------------------------- inquiry form */
  var form = $('[data-form]');
  if (form) initForm(form);

  function initForm(form) {
    var status = $('[data-form-status]', form);
    var submit = $('.form__submit', form);
    var started = $('[data-started]', form);
    var dateInput = $('#f-date', form);
    var sending = false;
    form.noValidate = true; // native validation stays on when JavaScript is unavailable
    if (started) started.value = String(Date.now());
    if (dateInput) {
      var t = new Date();
      dateInput.min = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
    }

    var labels = {
      'f-first': 'your first name',
      'f-last': 'your last name',
      'f-email': 'your email address',
      'f-message': 'a few details about your event',
    };

    function fieldError(input) {
      var v = input.value.trim();
      if (input.required && !v) return 'Please enter ' + (labels[input.id] || 'this field') + '.';
      if (input.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Please enter a valid email address, like name@example.com.';
      if (input.type === 'tel' && v && !/^[0-9+().\s]{7,}$/.test(v.replace(/[‐-―-]/g, ''))) return 'Please enter a valid phone number.';
      if (input.type === 'number' && v && (!/^\d+$/.test(v) || +v < 1 || +v > 5000)) return 'Please enter a guest count between 1 and 5000.';
      if (input.type === 'date' && v && input.min && v < input.min) return 'Please choose a date that has not already passed.';
      return '';
    }

    function showError(input, msg) {
      var holder = $('[data-error-for="' + input.id + '"]', form);
      if (msg) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
      if (holder) holder.textContent = msg;
    }

    var inputs = $$('.field__input', form);
    inputs.forEach(function (input) {
      input.addEventListener('blur', function () {
        if (input.value.trim() || input.getAttribute('aria-invalid')) showError(input, fieldError(input));
      });
      input.addEventListener('input', function () {
        if (input.getAttribute('aria-invalid')) showError(input, fieldError(input));
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (sending) return;
      var firstInvalid = null;
      var count = 0;
      inputs.forEach(function (input) {
        var msg = fieldError(input);
        showError(input, msg);
        if (msg) { count++; if (!firstInvalid) firstInvalid = input; }
      });
      status.className = 'form__status';
      if (firstInvalid) {
        status.classList.add('is-error');
        status.textContent = count === 1 ? 'Please correct the highlighted field.' : 'Please correct the ' + count + ' highlighted fields.';
        firstInvalid.focus();
        return;
      }

      sending = true;
      submit.setAttribute('aria-disabled', 'true');
      $('.btn__label', submit).textContent = 'Sending';
      status.textContent = 'Sending your inquiry.';

      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = typeof v === 'string' ? v.trim() : v; });

      fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data),
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (body) { return { ok: res.ok, body: body }; });
        })
        .then(function (r) {
          if (!r.ok || !r.body.ok) throw r.body;
          var success = doc.createElement('div');
          success.className = 'form-success';
          success.setAttribute('tabindex', '-1');
          success.setAttribute('role', 'status');
          success.innerHTML =
            '<p class="eyebrow">Inquiry received</p>' +
            '<h3>Thank you. <em>Your story begins here.</em></h3>' +
            '<p>We have your details and will be in touch soon to start planning something unforgettable.</p>';
          form.replaceWith(success);
          success.focus();
          if (motion) gsap.from(success, { opacity: 0, y: 24, duration: 1, ease: 'expo.out' });
          if (window.ScrollTrigger) ScrollTrigger.refresh();
        })
        .catch(function (err) {
          var fieldErrors = (err && err.errors) || {};
          var first = null;
          Object.keys(fieldErrors).forEach(function (name) {
            var input = form.elements[name];
            if (input && input.id) {
              showError(input, fieldErrors[name]);
              if (!first) first = input;
            }
          });
          status.className = 'form__status is-error';
          status.textContent = (err && err.message) || 'Sorry, something went wrong and your inquiry was not sent. Please try again, or email us directly at info@scentandstory.co.';
          if (first) first.focus();
        })
        .then(function () {
          sending = false;
          submit.removeAttribute('aria-disabled');
          var label = $('.btn__label', submit);
          if (label) label.textContent = 'Send inquiry';
        });
    });
  }

  /* -------------------------------------------------------------- static mode exits here */
  if (!motion) {
    var onStaticScroll = function () { onScrollHeader(window.scrollY); };
    window.addEventListener('scroll', onStaticScroll, { passive: true });
    onStaticScroll();
    return;
  }

  /* ============================================================== motion */
  gsap.registerPlugin(ScrollTrigger, SplitText);
  gsap.defaults({ ease: 'expo.out', duration: 1.2 });

  if (window.Lenis) {
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 1, smoothWheel: true });
    lenis.on('scroll', function (e) { ScrollTrigger.update(); onScrollHeader(e.scroll); });
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  } else {
    window.addEventListener('scroll', function () { onScrollHeader(window.scrollY); }, { passive: true });
  }

  // Bail out gracefully if the visitor turns on reduced motion mid visit.
  reduceQuery.addEventListener('change', function (e) { if (e.matches) location.reload(); });

  var fontsReady = Promise.race([
    doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve(),
    new Promise(function (r) { setTimeout(r, 1200); }),
  ]);

  fontsReady.then(function () {
    initHero();
    initSplits();
    initFades();
    initReveals();
    initStatement();
    initMarquee();
    initProcess();
    initStack();
    initOccasions();
    initGallery();
    initFooter();
    initMagnetic();
    ScrollTrigger.refresh();
    if (location.hash) {
      var t = doc.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (t) setTimeout(function () { lenis ? lenis.scrollTo(t, { offset: -headerOffset() + 16, immediate: true }) : t.scrollIntoView(); }, 60);
    }
  });

  window.addEventListener('load', function () { ScrollTrigger.refresh(); });

  /* -------------------------------------------------------------- hero */
  function initHero() {
    var title = $('[data-hero-title]');
    var tl = gsap.timeline({ delay: 0.15 });
    if (title) {
      SplitText.create(title, {
        type: 'lines',
        mask: 'lines',
        linesClass: 'split-line',
        aria: 'none',
        autoSplit: true,
        onSplit: function (self) {
          gsap.set(title, { visibility: 'visible' });
          return gsap.from(self.lines, { yPercent: 110, duration: 1.5, stagger: 0.12, ease: 'expo.out', delay: 0.2 });
        },
      });
    }
    var arch = $('[data-hero-arch] picture');
    if (arch) {
      tl.fromTo(arch, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.8, ease: 'expo.inOut' }, 0);
      tl.from($('img', arch), { scale: 1.35, duration: 2.4, ease: 'expo.out' }, 0.2);
    }
    tl.to('[data-hero-fade]', { opacity: 1, y: 0, duration: 1.4, stagger: 0.1 }, 0.55);
    tl.from('[data-hero-badge]', { scale: 0.4, rotate: -90, opacity: 0, duration: 1.6 }, 0.9);
    tl.from('[data-hero-monogram]', { opacity: 0, scale: 1.08, duration: 2.6, ease: 'power2.out' }, 0);

    var hero = $('.hero');
    gsap.to('[data-hero-monogram]', { yPercent: 18, rotate: -4, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero__img img', { yPercent: 10, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('[data-hero-badge]', { rotate: 220, ease: 'none', scrollTrigger: { trigger: doc.body, start: 'top top', end: 'bottom bottom', scrub: 0.6 } });
    gsap.to('.hero__copy', { yPercent: -12, ease: 'none', scrollTrigger: { trigger: hero, start: 'center center', end: 'bottom top', scrub: true } });
  }

  /* -------------------------------------------------------------- headings */
  function initSplits() {
    $$('[data-split]').forEach(function (el) {
      SplitText.create(el, {
        type: 'lines',
        mask: 'lines',
        linesClass: 'split-line',
        autoSplit: true,
        onSplit: function (self) {
          gsap.set(el, { visibility: 'visible' });
          return gsap.from(self.lines, {
            yPercent: 110,
            duration: 1.4,
            stagger: 0.1,
            ease: 'expo.out',
            scrollTrigger: { trigger: el, start: 'top 88%', once: true },
          });
        },
      });
    });
  }

  /* -------------------------------------------------------------- fades */
  function initFades() {
    var items = $$('[data-fade]').filter(function (el) { return !el.closest('[data-process-track]'); });
    ScrollTrigger.batch(items, {
      start: 'top 90%',
      once: true,
      onEnter: function (batch) { gsap.to(batch, { opacity: 1, y: 0, duration: 1.3, stagger: 0.08, overwrite: true }); },
    });
  }

  /* -------------------------------------------------------------- image reveals + parallax */
  function initReveals() {
    $$('[data-reveal]').forEach(function (el) {
      var img = $('img', el);
      var tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
      tl.to(el, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.6, ease: 'expo.inOut' });
      if (img) tl.from(img, { scale: 1.3, duration: 2.2, ease: 'expo.out' }, 0.1);
    });
    $$('[data-speed]').forEach(function (el) {
      var speed = parseFloat(el.getAttribute('data-speed')) || 0;
      gsap.to(el, { yPercent: speed * -22, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }

  /* -------------------------------------------------------------- statement word reveal */
  function initStatement() {
    var el = $('[data-words]');
    if (!el) return;
    var split = SplitText.create(el, { type: 'words', wordsClass: 'word', aria: 'none', tag: 'span' });
    gsap.fromTo(split.words, { opacity: 0.14 }, {
      opacity: 1,
      ease: 'none',
      stagger: 0.08,
      scrollTrigger: { trigger: el, start: 'top 78%', end: 'bottom 50%', scrub: true },
    });
  }

  /* -------------------------------------------------------------- marquee (scroll linked, never autoplays) */
  function initMarquee() {
    $$('[data-marquee]').forEach(function (track) {
      var dir = parseFloat(track.getAttribute('data-marquee')) || -1;
      gsap.fromTo(track, { xPercent: dir < 0 ? 0 : -50 }, {
        xPercent: dir < 0 ? -50 : 0,
        ease: 'none',
        scrollTrigger: { trigger: track.parentNode, start: 'top bottom', end: 'bottom top', scrub: 0.8 },
      });
    });
  }

  /* -------------------------------------------------------------- horizontal experience */
  function initProcess() {
    var section = $('[data-process]');
    if (!section) return;
    var pin = $('[data-process-pin]', section);
    var track = $('[data-process-track]', section);
    section.classList.add('is-horizontal');

    var distance = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
    var tween = gsap.to(track, {
      x: function () { return -distance(); },
      ease: 'none',
      scrollTrigger: {
        trigger: pin,
        start: 'top top',
        end: function () { return '+=' + distance(); },
        pin: true,
        scrub: 0.8,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });

    $$('.step', track).forEach(function (step) {
      var media = $('.step__media', step);
      var img = $('img', step);
      gsap.fromTo(media, { clipPath: 'inset(18% 10% 18% 10%)' }, {
        clipPath: 'inset(0% 0% 0% 0%)',
        ease: 'none',
        scrollTrigger: { trigger: step, containerAnimation: tween, start: 'left 100%', end: 'left 55%', scrub: true },
      });
      if (img) {
        gsap.fromTo(img, { xPercent: -6 }, {
          xPercent: 6,
          ease: 'none',
          scrollTrigger: { trigger: step, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true },
        });
      }
      gsap.from($('.step__body', step), {
        y: 40,
        opacity: 0,
        ease: 'none',
        scrollTrigger: { trigger: step, containerAnimation: tween, start: 'left 95%', end: 'left 60%', scrub: true },
      });
    });
    gsap.to($$('[data-fade]', track), { opacity: 1, y: 0, stagger: 0.1, scrollTrigger: { trigger: section, start: 'top 75%', once: true } });
  }

  /* -------------------------------------------------------------- stacked packages */
  function initStack() {
    var cards = $$('[data-stack-card]');
    var markers = $$('[data-stack-marker]');
    if (!cards.length) return;
    var stackCtx = null;
    var stacked = false;

    // Cards stick and stack only when each one fits fully on screen, so no
    // content (or keyboard focus) ever ends up trapped under the next card.
    function build() {
      if (stackCtx) { stackCtx.revert(); stackCtx = null; }
      stacked = false;
      if (!window.matchMedia('(min-width: 64em)').matches) return;
      var base = (header ? header.offsetHeight : 88) + 20;
      var tops = cards.map(function (c, i) { return base + i * 24; });
      var fits = cards.every(function (c, i) { return c.offsetHeight + tops[i] + 24 <= window.innerHeight; });
      if (!fits) return;
      stacked = true;
      stackCtx = gsap.context(function () {
        cards.forEach(function (card, i) {
          gsap.set(card, { position: 'sticky', top: tops[i] });
          var next = cards[i + 1];
          if (next) {
            gsap.to(card, {
              scale: 0.93 + i * 0.015,
              ease: 'none',
              scrollTrigger: { trigger: next, start: 'top bottom', end: 'top ' + (tops[i + 1] + 8) + 'px', scrub: true },
            });
          }
        });
      });
    }

    cards.forEach(function (card, i) {
      card.addEventListener('focusin', function () {
        if (!stacked || !markers[i]) return;
        var next = cards[i + 1];
        if (!next || next.getBoundingClientRect().top >= window.innerHeight) return;
        var y = markers[i].getBoundingClientRect().top + window.scrollY - (header ? header.offsetHeight : 0) - 20;
        if (lenis) lenis.scrollTo(y, { immediate: true });
        else window.scrollTo(0, y);
      });
      gsap.from(card, { y: 80, opacity: 0, duration: 1.4, scrollTrigger: { trigger: card, start: 'top 92%', once: true } });
      var img = $('.pkg__media img', card);
      if (img) gsap.fromTo(img, { scale: 1.18 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: card, start: 'top bottom', end: 'top 20%', scrub: true } });
    });

    build();
    var t;
    window.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () { build(); ScrollTrigger.refresh(); }, 250);
    });
  }

  /* -------------------------------------------------------------- occasions cursor preview */
  function initOccasions() {
    var preview = $('[data-occasion-preview]');
    var items = $$('[data-occasion]');
    if (!preview || !items.length || !finePointer) return;
    var section = $('[data-occasions]');
    // Only mount the preview images once the section is close, so they never
    // cost anything on first load.
    ScrollTrigger.create({ trigger: section, start: 'top 150%', once: true, onEnter: function () { section.classList.add('has-preview'); } });
    var pics = $$('picture', preview);
    var xTo = gsap.quickTo(preview, 'x', { duration: 0.7, ease: 'expo.out' });
    var yTo = gsap.quickTo(preview, 'y', { duration: 0.7, ease: 'expo.out' });
    var rTo = gsap.quickTo(preview, 'rotate', { duration: 0.9, ease: 'expo.out' });
    var lastX = 0;
    var list = $('.occasion-list');
    gsap.set(preview, { xPercent: -50, yPercent: -55 });

    list.addEventListener('pointermove', function (e) {
      xTo(e.clientX + 40);
      yTo(e.clientY);
      rTo(gsap.utils.clamp(-10, 10, (e.clientX - lastX) * 0.6));
      lastX = e.clientX;
    });
    items.forEach(function (item) {
      item.addEventListener('pointerenter', function (e) {
        var idx = +item.getAttribute('data-occasion');
        pics.forEach(function (p, i) { p.classList.toggle('is-active', i === idx); });
        if (gsap.getProperty(preview, 'opacity') < 0.05) {
          gsap.set(preview, { x: e.clientX + 40, y: e.clientY });
        }
        gsap.to(preview, { autoAlpha: 1, scale: 1, duration: 0.6, overwrite: 'auto' });
      });
    });
    list.addEventListener('pointerleave', function () {
      gsap.to(preview, { autoAlpha: 0, scale: 0.85, duration: 0.5, overwrite: 'auto' });
    });
  }

  /* -------------------------------------------------------------- gallery rows */
  function initGallery() {
    var section = $('[data-gallery]');
    if (!section) return;
    section.classList.add('is-marquee');
    $$('[data-gallery-row]', section).forEach(function (row) {
      var dir = parseFloat(row.getAttribute('data-gallery-row')) || -1;
      var dist = function () { return Math.max(0, row.scrollWidth - window.innerWidth); };
      gsap.fromTo(row,
        { x: function () { return dir < 0 ? 0 : -dist(); } },
        {
          x: function () { return dir < 0 ? -dist() : 0; },
          ease: 'none',
          scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: 0.8, invalidateOnRefresh: true },
        });
    });
    $$('.gallery__item img', section).forEach(function (img) {
      gsap.fromTo(img, { scale: 1.12 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: section, start: 'top bottom', end: 'center center', scrub: true } });
    });
  }

  /* -------------------------------------------------------------- footer */
  function initFooter() {
    var logo = $('[data-footer-logo] img');
    if (!logo) return;
    gsap.to(logo, {
      opacity: 1,
      y: 0,
      ease: 'none',
      scrollTrigger: { trigger: '[data-footer-logo]', start: 'top bottom', end: 'bottom bottom', scrub: true },
    });
  }

  /* -------------------------------------------------------------- magnetic buttons */
  function initMagnetic() {
    if (!finePointer) return;
    $$('[data-magnetic]').forEach(function (btn) {
      var label = $('.btn__label', btn);
      var xTo = gsap.quickTo(btn, 'x', { duration: 0.6, ease: 'expo.out' });
      var yTo = gsap.quickTo(btn, 'y', { duration: 0.6, ease: 'expo.out' });
      var lx = label ? gsap.quickTo(label, 'x', { duration: 0.6, ease: 'expo.out' }) : null;
      var ly = label ? gsap.quickTo(label, 'y', { duration: 0.6, ease: 'expo.out' }) : null;
      btn.addEventListener('pointermove', function (e) {
        var r = btn.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        xTo(dx * 0.22); yTo(dy * 0.3);
        if (lx) { lx(dx * 0.1); ly(dy * 0.12); }
      });
      btn.addEventListener('pointerleave', function () {
        xTo(0); yTo(0);
        if (lx) { lx(0); ly(0); }
      });
    });
  }
})();
