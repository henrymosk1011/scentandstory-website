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
  var introTl = null;

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
    if (introTl && introTl.progress() < 1) introTl.progress(1);
    if (lenis) {
      lenis.scrollTo(target, {
        offset: target.id === 'main' ? 0 : -headerOffset() + 16,
        duration: 1.5,
        force: true,
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
    var queued = false; // a submit waiting for the spam check token
    var queueTimer = 0;
    var fallbackMessage = 'Sorry, something went wrong and your inquiry was not sent. Please try again, or email us directly at info@scentandstory.co.';
    var captchaMessage = 'Our spam check could not run. Please refresh the page and try again, or email us directly at info@scentandstory.co.';
    var checkMessage = 'Please complete the quick security check above the Send button, and your inquiry will go out.';
    var captcha = initCaptcha(form, {
      token: function () { if (queued) { stopQueue(); attempt(); } },
      fail: function () { if (queued) { stopQueue(); showStatusError(captchaMessage); } },
      interactive: function () { if (queued) status.textContent = checkMessage; },
    });
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

    function showStatusError(msg) {
      status.className = 'form__status is-error';
      status.textContent = msg;
    }

    function stopQueue() {
      queued = false;
      clearTimeout(queueTimer);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      attempt();
    });

    function attempt() {
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

      // Wait for the Turnstile token, then send automatically.
      if (captcha && !captcha.token()) {
        if (captcha.failed()) { showStatusError(captchaMessage); return; }
        queued = true;
        captcha.start();
        status.textContent = captcha.interactive() ? checkMessage : 'One moment while we confirm you are not a bot.';
        clearTimeout(queueTimer);
        queueTimer = setTimeout(function () {
          if (queued && !captcha.interactive()) { stopQueue(); showStatusError(captchaMessage); }
        }, 20000);
        return;
      }

      sending = true;
      submit.setAttribute('aria-disabled', 'true');
      $('.btn__label', submit).textContent = 'Sending';
      status.textContent = 'Sending your inquiry.';

      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = typeof v === 'string' ? v.trim() : v; });
      if (captcha) data['cf-turnstile-response'] = captcha.token();

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
          if (captcha) captcha.remove();
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
          if (captcha) captcha.reset(); // the server may have used up the token
          var fieldErrors = (err && err.errors) || {};
          var first = null;
          Object.keys(fieldErrors).forEach(function (name) {
            var input = form.elements[name];
            if (input && input.id) {
              showError(input, fieldErrors[name]);
              if (!first) first = input;
            }
          });
          showStatusError((err && err.message) || fallbackMessage);
          if (first) first.focus();
        })
        .then(function () {
          sending = false;
          submit.removeAttribute('aria-disabled');
          var label = $('.btn__label', submit);
          if (label) label.textContent = 'Send inquiry';
        });
    }
  }

  /* Cloudflare Turnstile spam check for the inquiry form. The script only loads
     once the form is near the screen or gets focus, and the widget stays hidden
     unless Cloudflare asks the visitor to tick a box. The server verifies the
     token in src/worker.js. */
  function initCaptcha(form, on) {
    var box = $('[data-turnstile]', form);
    if (!box) return null;
    var token = '';
    var failed = false;
    var interactive = false;
    var widget = null;
    var requested = false;

    function show(visible) {
      box.classList.toggle('is-visible', visible);
      if (window.ScrollTrigger) setTimeout(function () { ScrollTrigger.refresh(); }, 400);
    }

    function fail() {
      token = '';
      failed = true;
      on.fail();
    }

    function render() {
      widget = window.turnstile.render(box, {
        sitekey: box.getAttribute('data-turnstile'),
        action: 'inquiry',
        theme: 'light',
        size: box.clientWidth < 300 ? 'compact' : 'flexible',
        appearance: 'interaction-only',
        callback: function (t) { token = t; failed = false; interactive = false; on.token(); },
        'expired-callback': function () { token = ''; },
        'error-callback': function () { show(true); fail(); }, // Cloudflare's widget explains the problem
        'before-interactive-callback': function () { interactive = true; show(true); on.interactive(); },
        'after-interactive-callback': function () { interactive = false; },
      });
    }

    function start() {
      if (requested) return;
      requested = true;
      window.__ssTurnstileReady = render;
      var script = doc.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__ssTurnstileReady';
      script.async = true;
      script.onerror = fail;
      doc.head.appendChild(script);
    }

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); start(); }
      }, { rootMargin: '600px 0px' });
      io.observe(form);
    } else start();
    form.addEventListener('focusin', start);

    return {
      start: start,
      token: function () { return token; },
      failed: function () { return failed; },
      interactive: function () { return interactive; },
      reset: function () {
        token = '';
        if (widget === null) return;
        show(false);
        window.turnstile.reset(widget);
      },
      remove: function () {
        if (widget !== null) window.turnstile.remove(widget);
        widget = null;
      },
    };
  }

  /* -------------------------------------------------------------- gallery lightbox */
  var lightbox = $('[data-lightbox]');
  if (lightbox && typeof lightbox.showModal === 'function') initLightbox(lightbox);

  function initLightbox(dialog) {
    var links = $$('[data-gallery-open]');
    var img = $('[data-lightbox-img]', dialog);
    var countEl = $('[data-lightbox-count]', dialog);
    var totalEl = $('[data-lightbox-total]', dialog);
    var index = 0;
    var opener = null;
    if (totalEl) totalEl.textContent = String(links.length);

    function show(i) {
      index = (i + links.length) % links.length;
      var link = links[index];
      var thumb = $('img', link);
      img.src = link.getAttribute('href').replace(/\.jpg$/, '.webp');
      img.alt = thumb ? thumb.alt : '';
      if (countEl) countEl.textContent = String(index + 1);
      if (window.gsap && root.classList.contains('motion')) gsap.fromTo(img, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.7, ease: 'expo.out' });
    }

    links.forEach(function (link, i) {
      link.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
        e.preventDefault();
        opener = link;
        show(i);
        dialog.showModal();
        root.classList.add('lightbox-open');
        if (lenis) lenis.stop();
      });
    });
    $('[data-lightbox-prev]', dialog).addEventListener('click', function () { show(index - 1); });
    $('[data-lightbox-next]', dialog).addEventListener('click', function () { show(index + 1); });
    $('[data-lightbox-close]', dialog).addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
    });
    dialog.addEventListener('close', function () {
      root.classList.remove('lightbox-open');
      if (lenis) lenis.start();
      if (opener) opener.focus({ preventScroll: true });
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
    var introDone = initIntro();
    // Scroll driven pieces are created in page order so pinned sections measure correctly.
    initHeroScroll();
    initSplits();
    initFades();
    initReveals();
    initStatement();
    initMarquee();
    initNotes();
    initProcess();
    initStack();
    initOccasions();
    initGallery();
    initVoices();
    initFooter();
    initMagnetic();
    initVelocity();
    ScrollTrigger.refresh();
    introDone.then(initHeroIntro);
    if (location.hash) {
      var t = doc.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (t) setTimeout(function () { lenis ? lenis.scrollTo(t, { offset: -headerOffset() + 16, immediate: true }) : t.scrollIntoView(); }, 60);
    }
  });

  window.addEventListener('load', function () { ScrollTrigger.refresh(); });

  /* -------------------------------------------------------------- intro curtain (first visit per session) */
  function initIntro() {
    var intro = $('[data-intro]');
    if (!intro || !root.classList.contains('intro-on')) return Promise.resolve();
    if (location.hash) { root.classList.remove('intro-on'); return Promise.resolve(); }
    return new Promise(function (resolve) {
      if (lenis) lenis.stop();
      var events = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
      var tl;
      var skip = function () { if (tl) tl.timeScale(3.5); };
      tl = introTl = gsap.timeline({
        defaults: { ease: 'expo.inOut' },
        onComplete: function () {
          root.classList.remove('intro-on');
          events.forEach(function (ev) { window.removeEventListener(ev, skip); });
          if (lenis) lenis.start();
        },
      });
      tl.to('.intro__mono', { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3 }, 0.1)
        .from('.intro__mono', { scale: 1.14, rotate: -5, duration: 1.8, ease: 'expo.out' }, 0.1)
        .to('.intro__word', { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1 }, 0.6)
        .to('.intro__inner', { yPercent: -45, opacity: 0, duration: 0.9, ease: 'expo.in' }, 1.75)
        .call(resolve, null, 1.9)
        .to(intro, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.2 }, 1.85);
      events.forEach(function (ev) { window.addEventListener(ev, skip, { passive: true }); });
    });
  }

  /* -------------------------------------------------------------- hero entrance */
  function initHeroIntro() {
    var hero = $('.hero');
    if (!hero) return;
    var title = $('[data-hero-title]');
    var tl = gsap.timeline({ delay: 0.1 });
    if (title) {
      SplitText.create(title, {
        type: 'lines,chars',
        mask: 'lines',
        linesClass: 'split-line',
        charsClass: 'split-char',
        aria: 'none',
        autoSplit: true,
        onSplit: function (self) {
          gsap.set(title, { visibility: 'visible' });
          return gsap.from(self.chars, { yPercent: 120, rotate: 10, transformOrigin: '0% 100%', duration: 1.5, stagger: 0.025, ease: 'expo.out', delay: 0.15 });
        },
      });
    }
    var frame = $('[data-hero-frame] picture');
    if (frame) {
      tl.fromTo(frame, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.8, ease: 'expo.inOut' }, 0);
      tl.from($('img', frame), { scale: 1.35, duration: 2.4, ease: 'expo.out' }, 0.2);
    }
    tl.to('[data-hero-fade]', { opacity: 1, y: 0, duration: 1.4, stagger: 0.1 }, 0.55);
    tl.fromTo('.hero__eyebrow', { letterSpacing: '0.7em' }, { letterSpacing: '0.28em', duration: 2, ease: 'expo.out' }, 0.55);
    tl.from('[data-hero-badge] circle, [data-hero-badge] text', { scale: 0.4, opacity: 0, transformOrigin: '50% 50%', duration: 1.6, stagger: 0.05 }, 0.9);
    tl.from('[data-hero-monogram]', { opacity: 0, scale: 1.08, duration: 2.6, ease: 'power2.out' }, 0);
  }

  /* -------------------------------------------------------------- hero scroll: zoom through on desktop */
  function initHeroScroll() {
    var hero = $('.hero');
    if (!hero) return;
    var frame = $('[data-hero-frame]');
    var media = $('.hero__media');
    var copy = $('.hero__copy');
    var revealLines = $$('[data-hero-reveal] .hero__reveal-line > span');

    gsap.to('[data-hero-monogram]', { yPercent: 18, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('[data-hero-badge]', { rotate: 220, ease: 'none', scrollTrigger: { trigger: doc.body, start: 'top top', end: 'bottom bottom', scrub: 0.6 } });

    // Pointer depth: the monogram and badge drift against the cursor.
    if (finePointer) {
      var mx = gsap.quickTo('[data-hero-monogram]', 'x', { duration: 1.4, ease: 'expo.out' });
      var my = gsap.quickTo('[data-hero-monogram]', 'y', { duration: 1.4, ease: 'expo.out' });
      var bx = gsap.quickTo('[data-hero-badge]', 'x', { duration: 1, ease: 'expo.out' });
      var by = gsap.quickTo('[data-hero-badge]', 'y', { duration: 1, ease: 'expo.out' });
      hero.addEventListener('pointermove', function (e) {
        var nx = e.clientX / window.innerWidth - 0.5;
        var ny = e.clientY / window.innerHeight - 0.5;
        mx(nx * -50); my(ny * -30); bx(nx * 26); by(ny * 20);
      });
    }

    var mm = gsap.matchMedia();
    mm.add({ zoom: '(min-width: 64em) and (min-height: 36em)', simple: '(max-width: 63.99em), (max-height: 35.99em)' }, function (ctx) {
      if (!ctx.conditions.zoom) {
        gsap.to('.hero__img img', { yPercent: 10, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
        gsap.to(copy, { yPercent: -12, ease: 'none', scrollTrigger: { trigger: hero, start: 'center center', end: 'bottom top', scrub: true } });
        return;
      }

      hero.classList.add('has-zoom');
      gsap.set(revealLines, { yPercent: 115 });
      var revealed = false;
      var reveal = function (on) {
        if (on === revealed) return;
        revealed = on;
        gsap.to(revealLines, on
          ? { yPercent: 0, duration: 1.3, stagger: 0.1, ease: 'expo.out', overwrite: true }
          : { yPercent: 115, duration: 0.5, ease: 'power3.in', overwrite: true });
      };
      // Layout based geometry, unaffected by the transforms being animated.
      var geo = function () {
        var vw = hero.clientWidth;
        var vh = window.innerHeight;
        var w = frame.offsetWidth;
        var h = frame.offsetHeight;
        var left = media.offsetLeft + frame.offsetLeft;
        var top = media.offsetTop + frame.offsetTop;
        return { dx: vw / 2 - (left + w / 2), dy: vh / 2 - (top + h / 2), s: Math.max(vw / w, vh / h) * 1.02 };
      };
      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: hero,
          start: 'top top',
          end: '+=120%',
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: function (self) { reveal(self.progress > 0.62); },
        },
      });
      tl.fromTo(frame,
        { x: 0, y: 0, scale: 1 },
        { x: function () { return geo().dx; }, y: function () { return geo().dy; }, scale: function () { return geo().s; }, borderRadius: 0, ease: 'power2.inOut', duration: 1 }, 0)
        .to('[data-hero-frame] picture', { scale: 1.1, ease: 'none', duration: 1.3 }, 0)
        .to('[data-hero-shade]', { opacity: 1, ease: 'power1.in', duration: 0.6 }, 0.35)
        .to('[data-hero-badge]', { scale: 0, opacity: 0, duration: 0.3, ease: 'power2.in' }, 0)
        .to(copy, { y: -90, ease: 'none', duration: 1 }, 0)
        .to({}, { duration: 0.3 });

      // Keyboard users tabbing back into the hero always see it unzoomed.
      var onFocus = function () { if (tl.scrollTrigger && tl.scrollTrigger.progress > 0.02 && lenis) lenis.scrollTo(0, { immediate: true }); };
      copy.addEventListener('focusin', onFocus);
      return function () {
        hero.classList.remove('has-zoom');
        copy.removeEventListener('focusin', onFocus);
        gsap.set(revealLines, { clearProps: 'all' });
      };
    });
  }

  /* -------------------------------------------------------------- headings */
  function initSplits() {
    $$('[data-split]').forEach(function (el) {
      SplitText.create(el, {
        type: 'lines,chars',
        mask: 'lines',
        linesClass: 'split-line',
        charsClass: 'split-char',
        autoSplit: true,
        onSplit: function (self) {
          gsap.set(el, { visibility: 'visible' });
          return gsap.from(self.chars, {
            yPercent: 120,
            rotate: 9,
            transformOrigin: '0% 100%',
            duration: 1.3,
            stagger: 0.018,
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
      onEnter: function (batch) {
        gsap.to(batch, { opacity: 1, y: 0, duration: 1.3, stagger: 0.08, overwrite: true });
        batch.forEach(function (el) {
          if (el.classList.contains('eyebrow')) gsap.fromTo(el, { letterSpacing: '0.7em' }, { letterSpacing: '0.28em', duration: 1.8, ease: 'expo.out' });
        });
      },
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
    // Each photo grows into place while the picture drifts vertically inside its frame.
    [['.statement__img--a', 0.82, -1], ['.statement__img--b', 0.88, 1]].forEach(function (set) {
      var fig = $(set[0]);
      if (!fig) return;
      var frame = $('.statement__frame', fig);
      var pic = $('picture', frame);
      gsap.fromTo(frame, { scale: set[1] }, { scale: 1, ease: 'none', scrollTrigger: { trigger: fig, start: 'top bottom', end: 'center 45%', scrub: true } });
      if (pic) {
        gsap.fromTo(pic, { scale: 1.18, yPercent: 7 * set[2] }, { scale: 1.18, yPercent: -7 * set[2], ease: 'none', scrollTrigger: { trigger: fig, start: 'top bottom', end: 'bottom top', scrub: true } });
      }
    });
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

    gsap.fromTo(section, { clipPath: 'inset(0% 4% 0% 4% round 2.5rem)' }, {
      clipPath: 'inset(0% 0% 0% 0% round 0rem)',
      ease: 'none',
      scrollTrigger: { trigger: section, start: 'top bottom', end: 'top top', scrub: true },
    });

    // Pin and scroll sideways only when the window is tall enough for the
    // steps to fit; shorter windows (or heavy browser zoom) get the stacked grid.
    var mm = gsap.matchMedia();
    mm.add('(min-height: 34em)', function () {
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

      return function () { section.classList.remove('is-horizontal'); };
    });

    mm.add('(max-height: 33.99em)', function () {
      gsap.to($$('[data-fade]', track), { opacity: 1, y: 0, stagger: 0.1, scrollTrigger: { trigger: section, start: 'top 80%', once: true } });
    });
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
              scale: 0.9 + i * 0.02,
              transformOrigin: '50% 0%',
              '--shade': 0.16,
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

  /* -------------------------------------------------------------- fragrance notes: pinned three act sequence */
  function initNotes() {
    var section = $('[data-notes]');
    if (!section) return;
    var pin = $('[data-notes-pin]', section);
    var notes = $$('[data-note]', section);
    var pics = $$('[data-notes-frame] picture', section);
    var words = $$('[data-notes-word]', section);
    var count = $('[data-notes-count]', section);
    var numerals = ['I', 'II', 'III'];
    var colors = ['#fff8f6', '#f8eae8', '#ecd2d7'];
    var mm = gsap.matchMedia();

    mm.add('(min-height: 46em)', function () {
      section.classList.add('is-pinned');
      var current = 0;
      var z = 2;
      gsap.set(notes.slice(1), { opacity: 0 });
      gsap.set(words.slice(1), { yPercent: 100, opacity: 0 });
      gsap.set(pin, { backgroundColor: colors[0] });

      function show(i) {
        if (i === current) return;
        var prev = current;
        var down = i > prev;
        current = i;
        gsap.to(notes[prev], { opacity: 0, y: down ? -50 : 50, duration: 0.55, ease: 'power3.in', overwrite: true });
        gsap.fromTo(notes[i], { opacity: 0, y: down ? 70 : -70 }, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', delay: 0.25, overwrite: true });
        gsap.fromTo(notes[i].children, { y: down ? 36 : -36 }, { y: 0, duration: 1.4, stagger: 0.07, ease: 'expo.out', delay: 0.25, overwrite: true });
        if (pics[i]) {
          gsap.set(pics[i], { zIndex: ++z });
          gsap.fromTo(pics[i], { clipPath: down ? 'inset(100% 0% 0% 0%)' : 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'expo.inOut', overwrite: true });
          gsap.fromTo($('img', pics[i]), { scale: 1.3 }, { scale: 1, duration: 2, ease: 'expo.out', overwrite: true });
        }
        gsap.to(words[prev], { yPercent: down ? -100 : 100, opacity: 0, duration: 0.8, ease: 'power3.in', overwrite: true });
        gsap.fromTo(words[i], { yPercent: down ? 100 : -100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.4, ease: 'expo.out', delay: 0.15, overwrite: true });
        gsap.to(pin, { backgroundColor: colors[i], duration: 1.2, ease: 'power2.inOut', overwrite: true });
        if (count) {
          gsap.to(count, {
            yPercent: down ? -60 : 60, opacity: 0, duration: 0.25, overwrite: true,
            onComplete: function () {
              count.textContent = numerals[i];
              gsap.fromTo(count, { yPercent: down ? 60 : -60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.7, ease: 'expo.out' });
            },
          });
        }
      }

      var length = function () { return window.innerHeight * 2.4; };
      ScrollTrigger.create({
        trigger: pin,
        start: 'top top',
        end: function () { return '+=' + length(); },
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: function (self) { show(Math.min(notes.length - 1, Math.floor(self.progress * notes.length * 0.999))); },
      });
      gsap.fromTo('.notes__word', { xPercent: 4 }, { xPercent: -10, ease: 'none', scrollTrigger: { trigger: pin, start: 'top top', end: function () { return '+=' + length(); }, scrub: true } });

      return function () {
        section.classList.remove('is-pinned');
        gsap.set(notes.concat(words, pics, [pin]), { clearProps: 'all' });
        if (count) { gsap.set(count, { clearProps: 'all' }); count.textContent = numerals[0]; }
      };
    });
  }

  /* -------------------------------------------------------------- occasions: sticky frame follows the active item */
  function initOccasions() {
    var section = $('[data-occasions]');
    if (!section) return;
    var items = $$('[data-occasion]', section);
    var pics = $$('[data-occasion-frame] picture', section);
    var count = $('[data-occasion-count]', section);
    var current = -1;
    var z = 2;

    function activate(i, down) {
      if (i === current) return;
      var prev = current;
      current = i;
      items.forEach(function (item, k) { item.classList.toggle('is-active', k === i); });
      if (prev === -1) return;
      var pic = pics[i];
      if (pic && window.matchMedia('(min-width: 64em)').matches) {
        gsap.set(pic, { zIndex: ++z });
        gsap.fromTo(pic, { clipPath: down ? 'inset(100% 0% 0% 0%)' : 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'expo.inOut', overwrite: true });
        gsap.fromTo($('img', pic), { scale: 1.3 }, { scale: 1, duration: 1.9, ease: 'expo.out', overwrite: true });
      }
      if (count) {
        gsap.to(count, {
          yPercent: down ? -60 : 60, opacity: 0, duration: 0.2, overwrite: true,
          onComplete: function () {
            count.textContent = String(i + 1).padStart(2, '0');
            gsap.fromTo(count, { yPercent: down ? 60 : -60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.6, ease: 'expo.out' });
          },
        });
      }
    }

    items.forEach(function (item, i) {
      gsap.from(item, { y: 70, opacity: 0, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: item, start: 'top 94%', once: true } });
      ScrollTrigger.create({
        trigger: item,
        start: 'top 58%',
        end: 'bottom 58%',
        onToggle: function (self) { if (self.isActive) activate(i, self.direction > 0); },
      });
    });
    activate(0, true);
  }

  /* -------------------------------------------------------------- gallery: tiles open like curtains */
  function initGallery() {
    var items = $$('[data-gallery-item]');
    if (!items.length) return;
    ScrollTrigger.batch(items, {
      start: 'top 92%',
      once: true,
      onEnter: function (batch) {
        gsap.to(batch, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, stagger: 0.09, ease: 'expo.inOut', onComplete: function () { gsap.set(this.targets(), { clipPath: 'none' }); } });
        batch.forEach(function (item, i) {
          var pic = $('picture', item);
          if (pic) gsap.fromTo(pic, { scale: 1.3 }, { scale: 1, duration: 2, delay: i * 0.09, ease: 'expo.out', clearProps: 'transform' });
        });
      },
    });
  }

  /* -------------------------------------------------------------- voices: card expands, then one quote at a time */
  function initVoices() {
    var section = $('[data-voices]');
    if (!section) return;
    var stage = $('[data-voices-stage]', section);
    var quotes = $$('[data-quote]', section);
    var count = $('[data-voice-count]', section);

    gsap.fromTo(section, { clipPath: 'inset(0% 5% 0% 5% round 2.5rem)' }, {
      clipPath: 'inset(0% 0% 0% 0% round 0rem)',
      ease: 'none',
      scrollTrigger: { trigger: section, start: 'top bottom', end: 'top 10%', scrub: true },
    });

    var mm = gsap.matchMedia();
    mm.add('(min-height: 36em)', function () {
      section.classList.add('is-sequenced');
      var current = 0;
      gsap.set(quotes.slice(1), { opacity: 0 });

      function show(i) {
        if (i === current) return;
        var prev = current;
        var down = i > prev;
        current = i;
        gsap.to(quotes[prev], { opacity: 0, y: down ? -70 : 70, filter: 'blur(10px)', duration: 0.6, ease: 'power3.in', overwrite: true });
        gsap.fromTo(quotes[i], { opacity: 0, y: down ? 90 : -90, filter: 'blur(14px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.3, ease: 'expo.out', delay: 0.25, overwrite: true });
        if (count) {
          gsap.to(count, {
            yPercent: down ? -60 : 60, opacity: 0, duration: 0.25, overwrite: true,
            onComplete: function () {
              count.textContent = String(i + 1).padStart(2, '0');
              gsap.fromTo(count, { yPercent: down ? 60 : -60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.7, ease: 'expo.out' });
            },
          });
        }
      }

      ScrollTrigger.create({
        trigger: stage,
        start: 'top top',
        end: function () { return '+=' + window.innerHeight * 1.8; },
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: function (self) { show(Math.min(quotes.length - 1, Math.floor(self.progress * quotes.length * 0.999))); },
      });

      return function () {
        section.classList.remove('is-sequenced');
        gsap.set(quotes, { clearProps: 'all' });
        if (count) { gsap.set(count, { clearProps: 'all' }); count.textContent = '01'; }
      };
    });
  }

  /* -------------------------------------------------------------- footer: lifts out from under the last section */
  function initFooter() {
    var footer = $('.site-footer');
    var logo = $('[data-footer-logo] img');
    var last = $('.inquire');
    if (logo) {
      gsap.to(logo, { opacity: 1, y: 0, ease: 'none', scrollTrigger: { trigger: '[data-footer-logo]', start: 'top bottom', end: 'bottom bottom', scrub: true } });
    }
    if (!footer) return;
    gsap.from('.site-footer__top', { y: -110, ease: 'none', scrollTrigger: { trigger: footer, start: 'top bottom', end: 'top 35%', scrub: true } });
    if (last) {
      var radius = function () { return Math.min(64, window.innerWidth * 0.05); };
      gsap.fromTo(last, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }, {
        borderBottomLeftRadius: radius,
        borderBottomRightRadius: radius,
        ease: 'none',
        scrollTrigger: { trigger: footer, start: 'top bottom', end: 'top 50%', scrub: true, invalidateOnRefresh: true },
      });
    }
  }

  /* -------------------------------------------------------------- velocity: type leans and photos swell with fast scrolling */
  function initVelocity() {
    if (!lenis) return;
    var setters = [];
    var add = function (sel, prop, map) {
      $$(sel).forEach(function (el) {
        var set = gsap.quickTo(el, prop, { duration: 0.7, ease: 'power3.out' });
        setters.push(function (v) { set(map(v)); });
      });
    };
    add('.marquee__track', 'skewX', function (v) { return v * -1.4; });
    var swell = function (v) { return 1 + Math.abs(v) * 0.012; };
    add('.step__media picture', 'scaleX', swell);
    add('.step__media picture', 'scaleY', swell);
    lenis.on('scroll', function (e) {
      var v = gsap.utils.clamp(-6, 6, e.velocity * 0.14);
      setters.forEach(function (set) { set(v); });
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
