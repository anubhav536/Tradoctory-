/* ===================================================
   TRADOCTORY — MAIN JAVASCRIPT
   =================================================== */

'use strict';

/* ===== NAVBAR SCROLL ===== */
(function initNavbar() {
  const navbar    = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  const navLinks  = document.querySelectorAll('.nav-link');

  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 30);
  }, { passive: true });

  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    mobileMenu.classList.toggle('open');
  });

  // Close mobile menu on link click
  document.querySelectorAll('.mobile-link, .mobile-cta').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('open');
      mobileMenu.classList.remove('open');
    });
  });

  // Active nav link on scroll
  const sections = document.querySelectorAll('section[id]');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(l => l.classList.remove('active'));
        const active = document.querySelector(`.nav-link[href="#${entry.target.id}"]`);
        if (active) active.classList.add('active');
      }
    });
  }, { threshold: 0.4 });

  sections.forEach(s => observer.observe(s));
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

  const points = [];
  const NUM_POINTS = 80;

  function generatePoints() {
    points.length = 0;
    let y = canvas.height * 0.5;
    for (let i = 0; i <= NUM_POINTS; i++) {
      y += (Math.random() - 0.48) * 30;
      y = Math.max(canvas.height * 0.2, Math.min(canvas.height * 0.8, y));
      points.push({ x: (canvas.width / NUM_POINTS) * i, y });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (points.length < 2) return;

    // Line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const cx = (points[i - 1].x + points[i].x) / 2;
      const cy = (points[i - 1].y + points[i].y) / 2;
      ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, cx, cy);
    }
    ctx.strokeStyle = 'rgba(0, 210, 106, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Fill
    ctx.lineTo(points[points.length - 1].x, canvas.height);
    ctx.lineTo(points[0].x, canvas.height);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, 'rgba(0, 210, 106, 0.06)');
    grad.addColorStop(1, 'rgba(0, 210, 106, 0)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Second line (blue, offset)
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y + 60);
    for (let i = 1; i < points.length; i++) {
      const cx = (points[i - 1].x + points[i].x) / 2;
      const cy = (points[i - 1].y + points[i].y) / 2 + 60;
      ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y + 60, cx, cy);
    }
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  generatePoints();
  draw();

  // Slowly animate points
  setInterval(() => {
    points.forEach((p, i) => {
      if (i === 0 || i === points.length - 1) return;
      p.y += (Math.random() - 0.5) * 4;
      p.y = Math.max(canvas.height * 0.2, Math.min(canvas.height * 0.8, p.y));
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
    priceEl.textContent = '$' + base.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    priceEl.style.color = change >= 0 ? 'var(--green)' : '#ef4444';
    setTimeout(() => { priceEl.style.color = ''; }, 300);
  }, 1200);
})();


/* ===== MINI CHART (SVG PATH) ===== */
(function initMiniChart() {
  const container = document.getElementById('miniChart');
  if (!container) return;

  const W = container.clientWidth || 280;
  const H = 80;
  const rawData = [42, 38, 51, 46, 55, 49, 60, 57, 65, 62, 70, 67, 75, 71, 80, 76, 78, 74, 79];

  const min = Math.min(...rawData);
  const max = Math.max(...rawData);
  const normalize = v => H - ((v - min) / (max - min)) * (H * 0.85) - H * 0.05;

  const step = W / (rawData.length - 1);

  let d = `M 0 ${normalize(rawData[0])}`;
  rawData.forEach((v, i) => {
    if (i === 0) return;
    const x  = i * step;
    const y  = normalize(v);
    const px = (i - 1) * step;
    const py = normalize(rawData[i - 1]);
    const cpx = px + step / 2;
    d += ` C ${cpx} ${py} ${cpx} ${y} ${x} ${y}`;
  });

  const fillPath = d + ` L ${W} ${H} L 0 ${H} Z`;

  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="mg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="rgba(0,210,106,0.35)"/>
        <stop offset="100%" stop-color="rgba(0,210,106,0)"/>
      </linearGradient>
    </defs>
    <path d="${fillPath}" fill="url(#mg)"/>
    <path d="${d}" fill="none" stroke="rgba(0,210,106,0.9)" stroke-width="2" stroke-linecap="round"/>
  </svg>`;

  container.innerHTML = svg;
  container.style.background = 'none';
  container.style.marginBottom = '20px';
})();


/* ===== TICKER TAPE DATA ===== */
(function initTickerTape() {
  const track = document.getElementById('tickerTrack');
  if (!track) return;

  const assets = [
    { sym: 'BTC/USD',  price: '$67,432',  chg: '+4.21%', up: true  },
    { sym: 'ETH/USD',  price: '$3,521',   chg: '+2.87%', up: true  },
    { sym: 'SOL/USD',  price: '$182.40',  chg: '-0.83%', up: false },
    { sym: 'BNB/USD',  price: '$598.10',  chg: '+1.45%', up: true  },
    { sym: 'AAPL',     price: '$212.35',  chg: '+1.12%', up: true  },
    { sym: 'TSLA',     price: '$248.70',  chg: '-0.34%', up: false },
    { sym: 'NVDA',     price: '$1,142.80',chg: '+3.67%', up: true  },
    { sym: 'EUR/USD',  price: '1.0842',   chg: '-0.12%', up: false },
    { sym: 'GBP/USD',  price: '1.2734',   chg: '+0.08%', up: true  },
    { sym: 'GOLD',     price: '$2,398.50',chg: '+0.55%', up: true  },
    { sym: 'XRP/USD',  price: '$0.5821',  chg: '+5.32%', up: true  },
    { sym: 'ADA/USD',  price: '$0.4612',  chg: '-1.20%', up: false },
  ];

  // Duplicate for seamless loop
  const doubled = [...assets, ...assets];

  doubled.forEach(asset => {
    const el = document.createElement('div');
    el.className = 'ticker-item';
    el.innerHTML = `
      <span class="ticker-symbol">${asset.sym}</span>
      <span class="ticker-price">${asset.price}</span>
      <span class="ticker-change ${asset.up ? 'up' : 'down'}">${asset.chg}</span>
    `;
    track.appendChild(el);
  });
})();


/* ===== INTERSECTION OBSERVER — FADE IN CARDS ===== */
(function initAnimations() {
  const style = document.createElement('style');
  style.textContent = `
    .feature-card, .about-card, .hero-stats .stat, .metric {
      opacity: 0;
      transform: translateY(24px);
      transition: opacity 0.55s ease, transform 0.55s ease;
    }
    .feature-card.visible, .about-card.visible, .hero-stats .stat.visible, .metric.visible {
      opacity: 1;
      transform: translateY(0);
    }
  `;
  document.head.appendChild(style);

  const targets = document.querySelectorAll('.feature-card, .about-card, .hero-stats .stat, .metric');

  const io = new IntersectionObserver(entries => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 80);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  targets.forEach(el => io.observe(el));
})();


/* ===== SMOOTH SCROLL POLYFILL FOR OLDER SAFARI ===== */
(function smoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
})();
