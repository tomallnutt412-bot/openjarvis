(function () {
  document.documentElement.classList.add('js');

  // Header background once the hero is scrolled past
  var header = document.querySelector('.site-header');
  var onScroll = function () { header.classList.toggle('scrolled', window.scrollY > 40); };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Respect reduced motion: show the poster instead of playing the hero video
  var video = document.querySelector('.hero-media');
  if (video && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    video.removeAttribute('autoplay');
    video.pause();
  }

  // Gentle reveal on scroll
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('in'); });
  }

  // Gallery lightbox
  var lb = document.getElementById('lightbox');
  if (lb && typeof lb.showModal === 'function') {
    var lbImg = lb.querySelector('img');
    var lastBtn = null;
    document.querySelectorAll('.g-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var thumb = btn.querySelector('img');
        lbImg.src = btn.dataset.full;
        lbImg.alt = thumb.alt;
        lastBtn = btn;
        lb.showModal();
      });
    });
    var close = function () { lb.close(); };
    lb.querySelector('.lb-close').addEventListener('click', close);
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    lb.addEventListener('close', function () { if (lastBtn) lastBtn.focus(); });
  } else {
    // Old browsers: open full image in new tab
    document.querySelectorAll('.g-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { window.open(btn.dataset.full, '_blank', 'noopener'); });
    });
  }

  // Quote form: validate, then send via Formspree (or fall back to email)
  var form = document.getElementById('quote-form');
  if (form) {
    var status = form.querySelector('.form-status');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.className = 'form-status';
      status.textContent = '';

      var firstBad = null;
      form.querySelectorAll('[required]').forEach(function (f) {
        var bad = !f.value.trim();
        f.setAttribute('aria-invalid', bad ? 'true' : 'false');
        if (bad && !firstBad) firstBad = f;
      });
      if (firstBad) {
        status.classList.add('err');
        status.textContent = 'Please fill in all fields so Jesse can get back to you.';
        firstBad.focus();
        return;
      }

      var data = new FormData(form);
      if (data.get('_gotcha')) return; // spam bot

      // Not connected to Formspree yet → open the visitor's email app instead
      if (form.action.indexOf('YOUR_FORM_ID') !== -1) {
        var body = 'Name: ' + data.get('name') + '\nPhone: ' + data.get('phone') +
          '\nLocation: ' + data.get('location') + '\n\nProject details:\n' + data.get('details');
        window.location.href = 'mailto:cassius.dig@gmail.com?subject=' +
          encodeURIComponent('Quote request – ' + data.get('location')) + '&body=' + encodeURIComponent(body);
        status.classList.add('ok');
        status.textContent = 'Opening your email app… or call Jesse on 07787 555963.';
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Sending…';
      fetch(form.action, { method: 'POST', body: data, headers: { Accept: 'application/json' } })
        .then(function (r) {
          if (!r.ok) throw new Error('bad status');
          form.reset();
          status.classList.add('ok');
          status.textContent = 'Thanks — Jesse will be in touch shortly.';
        })
        .catch(function () {
          status.classList.add('err');
          status.textContent = 'Sorry, that didn’t send. Please call 07787 555963 or email cassius.dig@gmail.com.';
        })
        .finally(function () { btn.disabled = false; btn.textContent = 'Send quote request'; });
    });
  }

  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
