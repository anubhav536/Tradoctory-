/* ===================================================
   TRADOCTORY — MAIN JAVASCRIPT
   =================================================== */

'use strict';

/* ===== SCROLL PROGRESS BAR ===== */
(function initScrollProgress() {
  const bar = document.getElementById('scroll-progress');
  if (!bar) return;

  function update() {
    const scrollTop  = window.scrollY;
    const docHeight  = document.documentElement.scrollHeight - window.innerHeight;
    const pct        = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width  = pct + '%';
  }

  window.addEventListener('scroll', update, { passive: true });
  update();
})();


/* ===== NAVBAR SCROLL + MOBILE MENU ===== */
(function initNavbar() {
  const navbar     = document.getElementById('navbar');
  const hamburger  = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  const navLinks   = document.querySelectorAll('.nav-link');

  /* Scrolled state */
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 30);
  }, { passive: true });

  /* Hamburger toggle */
  function openMenu(open) {
    hamburger.classList.toggle('open', open);
    mobileMenu.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', open);
  }

  hamburger.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.contains('open');
    openMenu(!isOpen);
  });

  /* Close on link click */
  document.querySelectorAll('.mobile-link, .mobile-cta').forEach(link => {
    link.addEventListener('click', () => openMenu(false));
  });

  /* Close on outside click */
  document.addEventListener('click', e => {
    if (
      mobileMenu.classList.contains('open') &&
      !mobileMenu.contains(e.target) &&
      !hamburger.contains(e.target)
    ) {
      openMenu(false);
    }
  });

  /* Close on Escape */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && mobileMenu.classList.contains('open')) {
      openMenu(false);
      hamburger.focus();
    }
  });

  /* Active nav link on scroll */
  const sections = document.querySelectorAll('section[id]');
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(l => l.classList.remove('active'));
        const active = document.querySelector(`.nav-link[href="#${entry.target.id}"]`);
        if (active) active.classList.add('active');
      }
    });
  }, { threshold: 0.35, rootMargin: '-60px 0px 0px 0px' });

  sections.forEach(s => io.observe(s));
})();


/* ===== BACKGROUND CHART CANVAS ===== */
(function initBgCanvas() {
  const canvas = document.getElementById('chartCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  const points  = [];
  const N       = 80;

  function generate() {
    points.length = 0;
    let y = canvas.height * 0.5;
    for (let i = 0; i <= N; i++) {
      y += (Math.random() - 0.48) * 30;
      y  = Math.max(canvas.height * 0.2, Math.min(canvas.height * 0.8, y));
      points.push({ x: (canvas.width / N) * i, y });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (points.length < 2) return;

    /* Green line */
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const cx = (points[i - 1].x + points[i].x) / 2;
      const cy = (points[i - 1].y + points[i].y) / 2;
      ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, cx, cy);
    }
    ctx.strokeStyle = 'rgba(0, 210, 106, 0.35)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    /* Green fill */
    ctx.lineTo(points[points.length - 1].x, canvas.height);
    ctx.lineTo(points[0].x, canvas.height);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, 'rgba(0, 210, 106, 0.05)');
    grad.addColorStop(1, 'rgba(0, 210, 106, 0)');
    ctx.fillStyle = grad;
    ctx.fill();

    /* Blue offset line */
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y + 60);
    for (let i = 1; i < points.length; i++) {
      const cx = (points[i - 1].x + points[i].x) / 2;
      const cy = (points[i - 1].y + points[i].y) / 2 + 60;
      ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y + 60, cx, cy);
    }
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.15)';
    ctx.lineWidth   = 1;
    ctx.stroke();
  }

  generate();
  draw();

  setInterval(() => {
    points.forEach((p, i) => {
      if (i === 0 || i === points.length - 1) return;
      p.y += (Math.random() - 0.5) * 4;
      p.y  = Math.max(canvas.height * 0.2, Math.min(canvas.height * 0.8, p.y));
    });
    draw();
  }, 80);
})();


/* ===== LIVE PRICE TICKER ===== */
(function initLivePrice() {
  const priceEl = document.getElementById('livePrice');
  if (!priceEl) return;

  let base = 67432.80;

  setInterval(() => {
    const change = (Math.random() - 0.49) * 45;
    base = Math.max(60000, Math.min(75000, base + change));
    priceEl.textContent = '$' + base.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    priceEl.style.color = change >= 0 ? 'var(--green)' : '#ef4444';
    setTimeout(() => { priceEl.style.color = ''; }, 350);
  }, 1200);
})();


/* ===== MINI CHART (SVG PATH) ===== */
(function initMiniChart() {
  const container = document.getElementById('miniChart');
  if (!container) return;

  const W       = container.clientWidth || 300;
  const H       = 52;
  const rawData = [30, 38, 33, 51, 46, 55, 49, 60, 57, 65, 62, 70, 67, 75, 71, 80, 76, 78, 74, 82];

  const min  = Math.min(...rawData);
  const max  = Math.max(...rawData);
  const norm = v => H - ((v - min) / (max - min)) * (H * 0.88) - H * 0.06;
  const step = W / (rawData.length - 1);

  let d = `M 0 ${norm(rawData[0])}`;
  rawData.forEach((v, i) => {
    if (i === 0) return;
    const x  = i * step;
    const y  = norm(v);
    const px = (i - 1) * step;
    const py = norm(rawData[i - 1]);
    d += ` C ${px + step / 2} ${py} ${px + step / 2} ${y} ${x} ${y}`;
  });

  const fill = d + ` L ${W} ${H} L 0 ${H} Z`;

  container.innerHTML = `
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"
         preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="rgba(0,210,106,0.3)"/>
          <stop offset="100%" stop-color="rgba(0,210,106,0)"/>
        </linearGradient>
      </defs>
      <path d="${fill}" fill="url(#mg)"/>
      <path d="${d}" fill="none" stroke="rgba(0,210,106,0.9)"
            stroke-width="1.8" stroke-linecap="round"/>
    </svg>`;
  container.style.background  = 'none';
  container.style.marginBottom = '0';
})();


/* ===== TICKER TAPE DATA ===== */
(function initTickerTape() {
  const track = document.getElementById('tickerTrack');
  if (!track) return;

  const assets = [
    { sym: 'BTC/USD',  price: '$67,432',   chg: '+4.21%', up: true  },
    { sym: 'ETH/USD',  price: '$3,521',    chg: '+2.87%', up: true  },
    { sym: 'SOL/USD',  price: '$182.40',   chg: '-0.83%', up: false },
    { sym: 'BNB/USD',  price: '$598.10',   chg: '+1.45%', up: true  },
    { sym: 'AAPL',     price: '$212.35',   chg: '+1.12%', up: true  },
    { sym: 'TSLA',     price: '$248.70',   chg: '-0.34%', up: false },
    { sym: 'NVDA',     price: '$1,142.80', chg: '+3.67%', up: true  },
    { sym: 'EUR/USD',  price: '1.0842',    chg: '-0.12%', up: false },
    { sym: 'GBP/USD',  price: '1.2734',    chg: '+0.08%', up: true  },
    { sym: 'GOLD',     price: '$2,398.50', chg: '+0.55%', up: true  },
    { sym: 'XRP/USD',  price: '$0.5821',   chg: '+5.32%', up: true  },
    { sym: 'ADA/USD',  price: '$0.4612',   chg: '-1.20%', up: false },
  ];

  [...assets, ...assets].forEach(asset => {
    const el = document.createElement('div');
    el.className = 'ticker-item';
    el.innerHTML = `
      <span class="ticker-symbol">${asset.sym}</span>
      <span class="ticker-price">${asset.price}</span>
      <span class="ticker-change ${asset.up ? 'up' : 'down'}">${asset.chg}</span>`;
    track.appendChild(el);
  });
})();


/* ===== HERO STAT COUNTER ANIMATION ===== */
(function initStatCounters() {
  const stats = document.querySelectorAll('.stat-value');
  if (!stats.length) return;

  function parseValue(text) {
    const raw   = text.replace(/[$,+×%]/g, '').trim();
    const num   = parseFloat(raw);
    const prefix = text.startsWith('$') ? '$' : '';
    const suffix = text.includes('%') ? '%'
                 : text.includes('×') ? '×'
                 : text.endsWith('K+') ? 'K+'
                 : text.endsWith('+') ? '+'
                 : text.endsWith('ms') ? 'ms' : '';
    return { num, prefix, suffix };
  }

  function formatNum(n, suffix) {
    if (suffix === 'ms') return n.toFixed(1);
    if (n >= 1000 && !suffix.includes('K')) return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
    return n % 1 !== 0 ? n.toFixed(1) : Math.round(n).toString();
  }

  function animateCounter(el) {
    const original   = el.textContent.trim();
    const { num, prefix, suffix } = parseValue(original);
    if (isNaN(num)) return;

    const duration = 1400;
    const start    = performance.now();

    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const ease     = 1 - Math.pow(1 - progress, 3);
      el.textContent = prefix + formatNum(num * ease, suffix) + suffix;
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = original;
    }

    requestAnimationFrame(step);
  }

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  stats.forEach(el => io.observe(el));
})();


/* ===== SCROLL REVEAL ANIMATIONS ===== */
(function initReveal() {
  /* Add base reveal class to elements we want to animate */
  const selectors = [
    '.section-header',
    '.feature-card',
    '.why-card',
    '.why-trust-bar',
    '.about-content',
    '.about-visual',
    '.about-card',
    '.about-badge',
    '.metric',
    '.cta-content',
    '.ai-main-card',
    '.ai-health-card',
    '.ai-trades-card',
  ];

  const elements = document.querySelectorAll(selectors.join(','));

  /* Inject the reveal CSS dynamically so it only applies to JS-enhanced sessions */
  const style = document.createElement('style');
  style.textContent = `
    .js-reveal {
      opacity: 0;
      transform: translateY(26px);
      transition: opacity 0.65s cubic-bezier(0.16,1,0.3,1),
                  transform 0.65s cubic-bezier(0.16,1,0.3,1);
    }
    .js-reveal.is-visible {
      opacity: 1;
      transform: translateY(0);
    }
  `;
  document.head.appendChild(style);

  elements.forEach(el => el.classList.add('js-reveal'));

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      /* If element is inside a grid, stagger siblings */
      const parent   = entry.target.parentElement;
      const siblings = parent
        ? [...parent.querySelectorAll('.js-reveal:not(.is-visible)')]
        : [];

      const idx = siblings.indexOf(entry.target);

      setTimeout(() => {
        entry.target.classList.add('is-visible');
      }, idx >= 0 ? idx * 80 : 0);

      io.unobserve(entry.target);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

  elements.forEach(el => io.observe(el));
})();


/* ===== SMOOTH SCROLL (Safari polyfill) ===== */
(function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const id     = anchor.getAttribute('href');
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
})();
