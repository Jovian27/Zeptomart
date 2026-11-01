/* ============================================================
   Z MART® — storefront
   Vanilla JS · CSS 3D · server-backed catalogue
   ============================================================ */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CART_KEY = 'zmart-cart-v2';

  const INR = n => '₹' + Number(n).toLocaleString('en-IN');
  const USD = n => '$' + Number(n).toFixed(2);
  const pad2 = n => String(n).padStart(2, '0');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const CATS = {
    all: 'All Products',
    discord: 'Discord Services',
    gaming: 'Gaming',
    ai: 'AI Subscriptions',
    software: 'Software'
  };

  /* ------------------------------------------------------------
     FALLBACK CATALOGUE (used only if the API is unreachable)
     ------------------------------------------------------------ */
  const SEED = [
    { id: 'DIS-001', name: 'Nitro IDs', category: 'discord', price: 45, oldPrice: 50, usd: 0.46, oldUsd: 0.5, duration: '25–28 Days Warranty', art: 'nitro', tone: '#2a1742', image: '', available: true,
      description: 'Get Nitro IDs with a 25–28 days warranty. Enjoy premium Discord features, including Animated Profile Pictures, Profile Banners, Custom Name Styling, Profile Customization, and more. Upgrade your Discord profile and enjoy a premium experience.' },
    { id: 'DIS-002', name: 'Server Boosts', category: 'discord', price: 280, oldPrice: 300, usd: 2.8, oldUsd: null, duration: '28–30 Days', art: 'boost', tone: '#221236', image: '', available: true,
      description: 'Enhance your Discord server with premium Server Boosts. Unlock additional server perks, improve audio quality, enjoy enhanced customization options, and give your community a premium experience. Fast delivery with warranty support.' },
    { id: 'GAM-001', name: 'Minecraft Account', category: 'gaming', price: 670, oldPrice: 755, usd: null, oldUsd: null, duration: 'Lifetime', art: 'minecraft', tone: '#1a0d2b', image: '', available: true,
      description: 'Get a Minecraft Account and enjoy an amazing gaming experience. Explore endless worlds, build incredible creations, and experience everything Minecraft has to offer. A great choice for Minecraft enthusiasts.' },
    { id: 'GAM-002', name: 'Steam Account', category: 'gaming', price: 150, oldPrice: 200, usd: null, oldUsd: null, duration: 'Lifetime', art: 'steam', tone: '#221236', image: '', available: true,
      description: 'Get a Steam Account and explore the world of PC gaming. Discover exciting games, build your gaming library, and enjoy a great gaming experience at an affordable price.' },
    { id: 'DIS-003', name: 'OwO 20 Level Account', category: 'discord', price: 315, oldPrice: 345, usd: null, oldUsd: null, duration: 'Lifetime', art: 'owo', tone: '#2a1742', image: '', available: true,
      description: 'Get an OwO Bot Account with Level 20 progress, ready to use. Save time and jump straight into the OwO Bot experience with an account that already has Level 20 progression. Perfect for OwO Bot enthusiasts.' }
  ];

  /* ------------------------------------------------------------
     PRODUCT ART — inline SVG, no image requests
     ------------------------------------------------------------ */
  const ART = {
    nitro: `<svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Purple Nitro membership illustration">
      <defs>
        <linearGradient id="nG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#bda6ff"/><stop offset=".5" stop-color="#7c5cff"/><stop offset="1" stop-color="#3d20b5"/>
        </linearGradient>
      </defs>
      <ellipse cx="160" cy="280" rx="94" ry="11" fill="#14150d" opacity=".14"/>
      <ellipse cx="160" cy="164" rx="132" ry="44" fill="none" stroke="#14150d" stroke-width="1.5" opacity=".32" transform="rotate(-16 160 164)"/>
      <path d="M160 50l74 30v88c0 46-32 82-74 104-42-22-74-58-74-104V80Z" fill="url(#nG)" stroke="#14150d" stroke-width="6" stroke-linejoin="round"/>
      <path d="M160 50l74 30v88c0 46-32 82-74 104" fill="none" stroke="#efeada" stroke-width="2.5" opacity=".45"/>
      <path d="M160 82l46 19v61c0 31-21 56-46 70-25-14-46-39-46-70V101Z" fill="none" stroke="#efeada" stroke-width="2" opacity=".25"/>
      <text x="160" y="198" text-anchor="middle" font-family="Arial Black,Arial" font-size="86" font-weight="900" fill="#efeada">N</text>
      <path d="M94 94l7 18 18 7-18 7-7 18-7-18-18-7 18-7Z" fill="#c9ff3d" stroke="#14150d" stroke-width="2.2"/>
      <path d="M238 76l5 12 12 5-12 5-5 12-5-12-12-5 12-5Z" fill="#ff4d0d" stroke="#14150d" stroke-width="2.2"/>
      <circle cx="252" cy="196" r="7" fill="#c9ff3d" stroke="#14150d" stroke-width="2.2"/>
      <rect x="52" y="196" width="30" height="9" fill="#efeada" stroke="#14150d" stroke-width="2" transform="rotate(-18 67 200)"/>
      <path d="M246 240h22M257 229v22" stroke="#14150d" stroke-width="2.5" opacity=".45"/>
    </svg>`,

    boost: `<svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Server boost gem illustration">
      <defs>
        <linearGradient id="bG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffb3e6"/><stop offset=".45" stop-color="#ff5cc8"/><stop offset="1" stop-color="#b3268f"/>
        </linearGradient>
        <linearGradient id="bP" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#8f6cff"/><stop offset="1" stop-color="#5a35d8"/>
        </linearGradient>
      </defs>
      <ellipse cx="160" cy="284" rx="92" ry="10" fill="#14150d" opacity=".14"/>
      <g stroke="#14150d" stroke-width="5">
        <rect x="56" y="52" width="208" height="48" rx="4" fill="#efeada"/>
        <rect x="56" y="112" width="208" height="48" rx="4" fill="#efeada"/>
      </g>
      <g fill="#14150d" opacity=".8">
        <circle cx="76" cy="76" r="5" fill="#c9ff3d"/><circle cx="94" cy="76" r="5" fill="#ff4d0d"/><circle cx="112" cy="76" r="5" fill="#7c5cff"/>
        <circle cx="76" cy="136" r="5" fill="#ff4d0d"/><circle cx="94" cy="136" r="5" fill="#c9ff3d"/><circle cx="112" cy="136" r="5" fill="#ff5cc8"/>
      </g>
      <g stroke="#14150d" stroke-width="2" opacity=".35">
        <path d="M142 64h100M142 84h82M142 124h100M142 144h64"/>
      </g>
      <path d="M188 88l-62 104h40l-18 78 76-116h-46l28-66Z" fill="url(#bG)" stroke="#14150d" stroke-width="6" stroke-linejoin="round"/>
      <path d="M188 88l-62 104h40" fill="none" stroke="#efeada" stroke-width="2.2" opacity=".5"/>
      <path d="M64 190l6 16 16 6-16 6-6 16-6-16-16-6 16-6Z" fill="#c9ff3d" stroke="#14150d" stroke-width="2"/>
      <path d="M262 206l5 12 12 5-12 5-5 12-5-12-12-5 12-5Z" fill="url(#bP)" stroke="#14150d" stroke-width="2"/>
      <path d="M96 232c18 12 42 16 64 16s46-4 64-16" fill="none" stroke="#14150d" stroke-width="1.5" opacity=".3" stroke-dasharray="4 5"/>
      <rect x="224" y="170" width="42" height="16" rx="2" fill="#14150d" opacity=".85"/>
      <text x="245" y="182" text-anchor="middle" font-family="Courier New,monospace" font-size="9" fill="#c9ff3d">BOOST</text>
    </svg>`,

    minecraft: `<svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Block world illustration">
      <defs>
        <linearGradient id="mTop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a8b26f"/><stop offset="1" stop-color="#7d8a4a"/></linearGradient>
      </defs>
      <ellipse cx="160" cy="286" rx="104" ry="11" fill="#14150d" opacity=".14"/>
      <g stroke="#14150d" stroke-linejoin="round">
        <path d="M160 62l92 46-92 46-92-46Z" fill="url(#mTop)" stroke-width="6"/>
        <path d="M68 108l92 46v88l-92-46Z" fill="#7b6647" stroke-width="6"/>
        <path d="M252 108l-92 46v88l92-46Z" fill="#5d4c33" stroke-width="6"/>
      </g>
      <g fill="#a8b26f" opacity=".85">
        <rect x="96" y="88" width="14" height="14"/><rect x="130" y="104" width="10" height="10"/>
        <rect x="176" y="82" width="12" height="12"/><rect x="206" y="100" width="16" height="16"/>
        <rect x="152" y="122" width="10" height="10"/><rect x="112" y="118" width="8" height="8"/>
      </g>
      <g fill="#efeada" opacity=".16">
        <rect x="88" y="132" width="16" height="16"/><rect x="120" y="160" width="20" height="20"/>
        <rect x="92" y="192" width="12" height="12"/><rect x="136" y="200" width="14" height="14"/>
        <rect x="188" y="140" width="18" height="18"/><rect x="214" y="172" width="14" height="14"/>
        <rect x="190" y="200" width="20" height="20"/><rect x="228" y="128" width="10" height="10"/>
      </g>
      <path d="M160 154v88" stroke="#14150d" stroke-width="2" opacity=".35"/>
      <g stroke="#14150d" stroke-width="4">
        <path d="M58 196l26-13 26 13-26 13Z" fill="#c9ff3d"/>
        <path d="M58 196v18l26 13v-18Z" fill="#93bd2b"/>
        <path d="M110 196v18l-26 13v-18Z" fill="#7aa323"/>
      </g>
      <g stroke="#14150d" stroke-width="4">
        <path d="M214 86l20-10 20 10-20 10Z" fill="#ff4d0d"/>
        <path d="M214 86v14l20 10v-14Z" fill="#d63f06"/>
        <path d="M254 86v14l-20 10v-14Z" fill="#b83805"/>
      </g>
      <path d="M42 130l4 10 10 4-10 4-4 10-4-10-10-4 10-4Z" fill="#c9ff3d" stroke="#14150d" stroke-width="2"/>
      <path d="M282 228l4 10 10 4-10 4-4 10-4-10-10-4 10-4Z" fill="#efeada" stroke="#14150d" stroke-width="2"/>
    </svg>`,

    steam: `<svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="PC gaming library illustration">
      <ellipse cx="160" cy="288" rx="106" ry="10" fill="#14150d" opacity=".14"/>
      <rect x="42" y="62" width="236" height="158" rx="10" fill="#efeada" stroke="#14150d" stroke-width="6"/>
      <rect x="58" y="78" width="204" height="112" fill="#14150d"/>
      <rect x="58" y="78" width="204" height="18" fill="#2b2d1e"/>
      <circle cx="69" cy="87" r="3.5" fill="#ff4d0d"/><circle cx="80" cy="87" r="3.5" fill="#c9ff3d"/><circle cx="91" cy="87" r="3.5" fill="#7c5cff"/>
      <g stroke="#efeada" stroke-width="1.2" opacity=".35">
        <path d="M95 108h152M95 174h152"/>
      </g>
      <g stroke="#14150d" stroke-width="2">
        <rect x="70" y="108" width="52" height="60" fill="#7c5cff"/>
        <rect x="128" y="108" width="52" height="60" fill="#ff4d0d"/>
        <rect x="186" y="108" width="52" height="60" fill="#8e9468"/>
      </g>
      <g fill="#efeada" opacity=".55">
        <rect x="78" y="116" width="36" height="5"/><rect x="78" y="126" width="24" height="4"/>
        <rect x="136" y="116" width="36" height="5"/><rect x="136" y="126" width="28" height="4"/>
        <rect x="194" y="116" width="36" height="5"/><rect x="194" y="126" width="20" height="4"/>
      </g>
      <g fill="#c9ff3d">
        <rect x="78" y="150" width="36" height="4"/><rect x="136" y="150" width="28" height="4"/><rect x="194" y="150" width="32" height="4"/>
      </g>
      <path d="M132 220h56l12 26h-80Z" fill="#efeada" stroke="#14150d" stroke-width="5"/>
      <rect x="120" y="246" width="80" height="8" rx="3" fill="#14150d"/>
      <g stroke="#14150d" stroke-width="5">
        <path d="M112 266c-6-16 4-30 20-32l8 14 12-8 22 4c16 4 24 18 18 30-6 12-24 16-44 12-14-3-32-10-36-20Z" fill="#b5b891"/>
        <path d="M138 244l14 10" stroke-width="4"/>
        <circle cx="186" cy="262" r="8" fill="#ff4d0d"/>
      </g>
      <circle cx="186" cy="262" r="3" fill="#c9ff3d"/>
      <path d="M250 206l6 16 16 6-16 6-6 16-6-16-16-6 16-6Z" fill="#c9ff3d" stroke="#14150d" stroke-width="2"/>
      <path d="M56 232l5 13 13 5-13 5-5 13-5-13-13-5 13-5Z" fill="#ff4d0d" stroke="#14150d" stroke-width="2"/>
    </svg>`,

    owo: `<svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Cute OwO bot illustration">
      <defs>
        <linearGradient id="oG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b79cff"/><stop offset="1" stop-color="#6a45e6"/></linearGradient>
      </defs>
      <ellipse cx="160" cy="284" rx="88" ry="10" fill="#14150d" opacity=".14"/>
      <path d="M160 44v22" stroke="#14150d" stroke-width="5"/>
      <path d="M160 60c-9-14-24-10-24 2 0 10 13 17 24 24 11-7 24-14 24-24 0-12-15-16-24-2Z" fill="#ff5cc8" stroke="#14150d" stroke-width="4"/>
      <rect x="52" y="118" width="20" height="52" rx="10" fill="url(#oG)" stroke="#14150d" stroke-width="5"/>
      <rect x="248" y="118" width="20" height="52" rx="10" fill="url(#oG)" stroke="#14150d" stroke-width="5"/>
      <rect x="66" y="92" width="188" height="152" rx="38" fill="#efeada" stroke="#14150d" stroke-width="6"/>
      <rect x="82" y="108" width="156" height="60" rx="18" fill="#14150d"/>
      <circle cx="130" cy="138" r="16" fill="#c9ff3d"/>
      <circle cx="190" cy="138" r="16" fill="#c9ff3d"/>
      <circle cx="134" cy="142" r="6" fill="#14150d"/>
      <circle cx="194" cy="142" r="6" fill="#14150d"/>
      <path d="M142 186c6-8 12-8 18 0 6 8 12 8 18 0" fill="none" stroke="#14150d" stroke-width="5" stroke-linecap="round"/>
      <circle cx="104" cy="180" r="7" fill="#ff9ae0" opacity=".8"/>
      <circle cx="216" cy="180" r="7" fill="#ff9ae0" opacity=".8"/>
      <path d="M92 214h24M204 214h24" stroke="#14150d" stroke-width="3" opacity=".35"/>
      <circle cx="236" cy="226" r="26" fill="#c9ff3d" stroke="#14150d" stroke-width="5"/>
      <text x="236" y="236" text-anchor="middle" font-family="Arial Black,Arial" font-size="22" font-weight="900" fill="#14150d">20</text>
      <g stroke="#14150d" stroke-width="2" opacity=".5">
        <path d="M76 236l6 6m0-6l-6 6M246 96l6 6m0-6l-6 6"/>
      </g>
      <path d="M58 80l5 13 13 5-13 5-5 13-5-13-13-5 13-5Z" fill="#c9ff3d" stroke="#14150d" stroke-width="2"/>
      <path d="M262 70l4 9 9 4-9 4-4 9-4-9-9-4 9-4Z" fill="#ff4d0d" stroke="#14150d" stroke-width="2"/>
    </svg>`,

    generic: `<svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Digital product illustration">
      <ellipse cx="160" cy="278" rx="92" ry="11" fill="#14150d" opacity=".14"/>
      <rect x="70" y="78" width="180" height="150" rx="10" fill="#efeada" stroke="#14150d" stroke-width="6"/>
      <rect x="86" y="94" width="148" height="26" fill="#14150d"/>
      <circle cx="99" cy="107" r="5" fill="#c9ff3d"/><circle cx="115" cy="107" r="5" fill="#ff4d0d"/>
      <path d="M86 132h148M86 156h104M86 180h132" stroke="#14150d" stroke-width="3" opacity=".35"/>
      <rect x="86" y="196" width="60" height="16" fill="#c9ff3d" stroke="#14150d" stroke-width="3"/>
      <path d="M132 228h56l10 22h-76Z" fill="#efeada" stroke="#14150d" stroke-width="5"/>
      <rect x="120" y="250" width="80" height="8" rx="3" fill="#14150d"/>
      <path d="M232 58l8 20 20 8-20 8-8 20-8-20-20-8 20-8Z" fill="#ff4d0d" stroke="#14150d" stroke-width="2"/>
    </svg>`
  };

  /* ------------------------------------------------------------
     STATE
     ------------------------------------------------------------ */
  let PRODUCTS = [];
  let byId = {};
  let filter = 'all';
  let query = '';
  let featIndex = 0;
  let featTimer = null;
  let cart = loadCart();

  function loadCart() {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw
        .filter(i => i && typeof i.id === 'string' && Number(i.qty) > 0)
        .map(i => ({ id: i.id, qty: Math.min(99, Number(i.qty) || 1) }));
    } catch { return []; }
  }
  const saveCart = () => { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {} };

  const catLabel = key => CATS[key] || String(key || '').replace(/^\w/, c => c.toUpperCase());
  const available = () => PRODUCTS.filter(p => p.available !== false);

  /* ------------------------------------------------------------
     BOOT
     ------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', async () => {
    hydrateStaticArt();
    await loadProducts();

    renderShop();
    renderFeatured();
    renderCart();
    renderCounts();

    initPreloader();
    initHeader();
    initMenu();
    initHeroParallax();
    initDiscordParallax();
    initCursor();
    initReveals();
    initShopEvents();
    initFeaturedEvents();
    initCartEvents();
    initPDP();
    initMisc();
    routeFromHash();
  });

  async function loadProducts() {
    try {
      const res = await fetch('/api/products', { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('offline');
      const data = await res.json();
      PRODUCTS = Array.isArray(data.products) ? data.products : [];
      document.documentElement.removeAttribute('data-offline');
    } catch {
      PRODUCTS = SEED.map(p => ({ ...p }));
      document.documentElement.setAttribute('data-offline', '1');
    }

    PRODUCTS = PRODUCTS.filter(p => p && p.id && p.name);
    byId = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));

    // drop cart lines whose product no longer exists
    const before = cart.length;
    cart = cart.filter(i => byId[i.id]);
    if (cart.length !== before) saveCart();
  }

  function hydrateStaticArt() {
    $$('[data-art]').forEach(el => {
      if (el.children.length) return;
      const art = ART[el.dataset.art];
      if (art) el.innerHTML = art;
    });
  }

  /* ------------------------------------------------------------
     PRELOADER
     ------------------------------------------------------------ */
  function initPreloader() {
    const loader = $('#loader');
    if (!loader) return;

    if (new URLSearchParams(location.search).has('nopreload')) {
      loader.remove();
      document.body.classList.add('is-loaded');
      return;
    }

    const seen = (() => { try { return sessionStorage.getItem('zmart-seen'); } catch { return '1'; } })();
    let done = false;
    let fallback = null;

    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(fallback);
      loader.classList.add('is-done');
      document.body.classList.remove('is-locked');
      document.body.classList.add('is-loaded');
      try { sessionStorage.setItem('zmart-seen', '1'); } catch {}
      setTimeout(() => loader.remove(), 1000);
    };

    if (reduced || seen) { finish(); return; }

    document.body.classList.add('is-locked');
    const numEl = $('#loaderNum');
    const barEl = $('#loaderBar');
    const wordEl = $('#loaderWord');
    const words = [[0, 'CALIBRATING'], [34, 'SYNCING STOCK'], [68, 'VERIFYING GOODS'], [94, 'READY']];
    const dur = 1500;
    const start = performance.now();

    fallback = setTimeout(finish, 2800);

    const tick = now => {
      if (done) return;
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = Math.round(eased * 100);
      numEl.textContent = String(v).padStart(3, '0');
      barEl.style.width = v + '%';
      for (let i = words.length - 1; i >= 0; i--) {
        if (v >= words[i][0]) { wordEl.textContent = words[i][1]; break; }
      }
      if (t < 1) requestAnimationFrame(tick);
      else finish();
    };
    requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------------
     HEADER / MENU
     ------------------------------------------------------------ */
  function initHeader() {
    const header = $('#header');
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const navLinks = $$('[data-nav]');
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(en => {
          if (!en.isIntersecting) return;
          navLinks.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id));
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      ['home', 'shop', 'categories', 'about', 'contact'].forEach(id => {
        const el = document.getElementById(id);
        if (el) io.observe(el);
      });
    }
  }

  function initMenu() {
    const burger = $('#burger');
    const menu = $('#mobileMenu');
    if (!burger || !menu) return;

    const open = () => {
      menu.classList.add('is-open');
      menu.setAttribute('aria-hidden', 'false');
      burger.setAttribute('aria-expanded', 'true');
      document.body.classList.add('menu-open', 'is-locked');
    };
    const close = () => {
      if (!menu.classList.contains('is-open')) return;
      menu.classList.remove('is-open');
      menu.setAttribute('aria-hidden', 'true');
      burger.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open', 'is-locked');
    };

    burger.addEventListener('click', () => menu.classList.contains('is-open') ? close() : open());
    $$('[data-close-menu]', menu).forEach(a => a.addEventListener('click', close));
    window.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    window.ZMcloseMenu = close;
  }

  /* ------------------------------------------------------------
     HERO PARALLAX
     ------------------------------------------------------------ */
  function initHeroParallax() {
    const hero = $('#home');
    if (!hero || reduced || !window.matchMedia('(pointer:fine)').matches) return;
    let raf = null, tx = 0, ty = 0;

    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      ty = ((e.clientY - r.top) / r.height) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(() => {
        hero.style.setProperty('--mx', tx.toFixed(3));
        hero.style.setProperty('--my', ty.toFixed(3));
        raf = null;
      });
    });
    hero.addEventListener('pointerleave', () => {
      hero.style.setProperty('--mx', '0');
      hero.style.setProperty('--my', '0');
    });
  }

  /* ------------------------------------------------------------
     DISCORD STAGE PARALLAX
     ------------------------------------------------------------ */
  function initDiscordParallax() {
    const stage = $('#discordStage');
    const mark = $('#discord3d');
    if (!stage || !mark || reduced || !window.matchMedia('(pointer:fine)').matches) return;
    let raf = null;

    stage.addEventListener('pointermove', e => {
      const r = stage.getBoundingClientRect();
      const dx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const dy = ((e.clientY - r.top) / r.height) * 2 - 1;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        mark.style.setProperty('--dx', dx.toFixed(3));
        mark.style.setProperty('--dy', dy.toFixed(3));
        raf = null;
      });
    });
    stage.addEventListener('pointerleave', () => {
      mark.style.setProperty('--dx', '0');
      mark.style.setProperty('--dy', '0');
    });
  }

  /* ------------------------------------------------------------
     CUSTOM CURSOR
     ------------------------------------------------------------ */
  function initCursor() {
    const fine = window.matchMedia('(pointer:fine)').matches;
    if (!fine || reduced) return;
    const cursor = $('#cursor');
    const label = $('#cursorLabel');
    if (!cursor) return;
    const dot = $('.cursor__dot', cursor);
    const ring = $('.cursor__ring', cursor);
    document.body.classList.add('has-cursor');

    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    document.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
    }, { passive: true });

    const loop = () => {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
      if (label) label.style.transform = `translate(${rx}px,${ry}px) translate(16px,16px)`;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    const hot = 'a,button,input,summary,[data-cursor]';
    document.addEventListener('pointerover', e => {
      const el = e.target.closest(hot);
      if (!el) return;
      cursor.classList.add('is-hover');
      if (label) {
        const txt = el.dataset.cursor || '';
        label.textContent = txt;
        label.style.opacity = txt ? '1' : '0';
      }
    });
    document.addEventListener('pointerout', e => {
      if (!e.target.closest(hot)) return;
      cursor.classList.remove('is-hover');
      if (label) label.style.opacity = '0';
    });
  }

  /* ------------------------------------------------------------
     REVEALS
     ------------------------------------------------------------ */
  let revealIO = null;
  function initReveals() {
    if (!('IntersectionObserver' in window) || reduced) {
      $$('.reveal').forEach(el => el.classList.add('is-in'));
      return;
    }
    revealIO = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          en.target.classList.add('is-in');
          revealIO.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    observeReveals();
  }
  function observeReveals(root = document) {
    if (!revealIO) return;
    $$('.reveal:not(.is-in)', root).forEach(el => revealIO.observe(el));
  }

  /* ------------------------------------------------------------
     SHOP
     ------------------------------------------------------------ */
  const mediaHTML = p => p.image
    ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" decoding="async">`
    : (ART[p.art] || ART.generic);

  function cardHTML(p, i) {
    const off = p.available === false;
    return `<article class="card reveal${off ? ' card--sold' : ''}" style="--card:${esc(p.tone || '#221236')}" data-id="${esc(p.id)}">
      <div class="card__media">
        <span class="card__badge">${esc(p.id)}</span>
        <div class="card__art">${mediaHTML(p)}</div>
        <button class="card__quick" data-action="view" data-id="${esc(p.id)}">QUICK VIEW ↗</button>
      </div>
      <div class="card__body">
        <div class="card__top"><span>${esc(catLabel(p.category))}</span><span class="card__id">${off ? 'UNAVAILABLE' : 'IN STOCK'}</span></div>
        <h3 class="card__name">${esc(p.name)}</h3>
        <div class="card__price">
          <strong>${INR(p.price)}</strong>
          ${p.oldPrice ? `<s>${INR(p.oldPrice)}</s>` : ''}
          ${p.usd ? `<span class="card__usd">${USD(p.usd)}</span>` : ''}
        </div>
        <div class="card__dur">${esc(p.duration || 'Instant delivery')}</div>
        <div class="card__actions">
          <button class="card__view" data-action="view" data-id="${esc(p.id)}">VIEW DETAILS</button>
          <button class="card__add" data-action="add" data-id="${esc(p.id)}"${off ? ' disabled' : ''}>${off ? 'SOLD OUT' : 'ADD TO CART +'}</button>
        </div>
      </div>
    </article>`;
  }

  function renderShop() {
    const q = query.trim().toLowerCase();
    const list = available().filter(p => {
      const okCat = filter === 'all' || p.category === filter;
      const haystack = `${p.name} ${p.id} ${catLabel(p.category)} ${p.description} ${p.duration}`.toLowerCase();
      return okCat && (!q || haystack.includes(q));
    });

    const grid = $('#productGrid');
    grid.innerHTML = list.map(cardHTML).join('');
    $('#resultCount').textContent = `${pad2(list.length)} PRODUCT${list.length === 1 ? '' : 'S'}`;

    const empty = $('#emptyState');
    const isEmpty = list.length === 0;
    empty.hidden = !isEmpty;
    grid.hidden = isEmpty;
    if (isEmpty) setEmptyCopy();

    observeReveals(grid);
  }

  function setEmptyCopy() {
    const text = $('#emptyText');
    if (!text) return;
    if (query.trim()) {
      text.textContent = `NO PRODUCTS MATCH “${query.trim().toUpperCase()}”.`;
    } else if (filter !== 'all') {
      text.textContent = `NO PRODUCTS IN ${catLabel(filter).toUpperCase()} YET.`;
    } else {
      text.textContent = 'THE SHELF IS BEING RESTOCKED.';
    }
  }

  function renderCounts() {
    const list = available();
    const counts = { all: list.length };
    Object.keys(CATS).forEach(k => { if (k !== 'all') counts[k] = list.filter(p => p.category === k).length; });
    $$('[data-count]').forEach(el => {
      const key = el.dataset.count;
      el.textContent = key === 'all' ? pad2(counts.all) : `${pad2(counts[key] || 0)} ITEMS`;
    });
    const stat = $('#statProducts');
    if (stat) stat.textContent = pad2(list.length);
    $$('.chip-filter').forEach(b => {
      const key = b.dataset.filter;
      const span = $('[data-count]', b);
      if (span) span.textContent = key === 'all' ? pad2(counts.all) : pad2(counts[key] || 0);
    });
  }

  function setFilter(next, scroll) {
    filter = CATS[next] ? next : 'all';
    $$('.chip-filter').forEach(b => b.classList.toggle('is-active', b.dataset.filter === filter));
    $$('.cat-card').forEach(b => b.classList.toggle('is-active', b.dataset.cat === filter));
    renderShop();
    if (scroll) {
      const shop = $('#shop');
      if (shop) shop.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    }
  }

  function initShopEvents() {
    $('#filters').addEventListener('click', e => {
      const btn = e.target.closest('.chip-filter');
      if (!btn) return;
      setFilter(btn.dataset.filter, false);
    });

    const search = $('#search');
    let sTimer = null;
    search.addEventListener('input', () => {
      clearTimeout(sTimer);
      sTimer = setTimeout(() => { query = search.value; renderShop(); }, 90);
    });

    $('#resetFilters').addEventListener('click', () => {
      query = '';
      search.value = '';
      setFilter('all', false);
    });

    const grid = $('#productGrid');
    grid.addEventListener('click', e => {
      const btn = e.target.closest('button[data-action]');
      if (btn) {
        if (btn.dataset.action === 'add') addToCart(btn.dataset.id, 1);
        else openPDP(btn.dataset.id);
        return;
      }
      const card = e.target.closest('.card');
      if (card) openPDP(card.dataset.id);
    });

    if (!reduced && window.matchMedia('(pointer:fine)').matches) {
      grid.addEventListener('pointermove', e => {
        const card = e.target.closest('.card');
        if (!card) return;
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty('--ry', (px * 9).toFixed(2) + 'deg');
        card.style.setProperty('--rx', (-py * 9).toFixed(2) + 'deg');
      });
      grid.addEventListener('pointerout', e => {
        const card = e.target.closest('.card');
        if (!card || card.contains(e.relatedTarget)) return;
        card.style.setProperty('--ry', '0deg');
        card.style.setProperty('--rx', '0deg');
      });
    }

    const cats = $('#categoryGrid');
    if (cats) {
      cats.addEventListener('click', e => {
        const btn = e.target.closest('.cat-card');
        if (!btn) return;
        setFilter(btn.dataset.cat, true);
      });
    }
  }

  /* ------------------------------------------------------------
     FEATURED
     ------------------------------------------------------------ */
  function featPool() {
    const list = available();
    return list.length ? list : PRODUCTS;
  }

  function renderFeatured(silent) {
    const pool = featPool();
    if (!pool.length) return;
    if (featIndex >= pool.length) featIndex = 0;
    const p = pool[featIndex];

    const art = $('#featArt');
    if (silent) art.classList.add('is-swapping');
    const apply = () => {
      art.innerHTML = mediaHTML(p);
      art.classList.remove('is-swapping');
    };
    silent ? setTimeout(apply, 160) : apply();

    $('#featIndex').textContent = `${pad2(featIndex + 1)} / ${pad2(pool.length)}`;
    $('#featCat').textContent = `${catLabel(p.category).toUpperCase()} / ${p.id}`;
    $('#featName').textContent = p.name;
    $('#featDesc').textContent = p.description;
    $('#featPrice').textContent = INR(p.price);
    const mrp = $('#featMrp');
    mrp.textContent = p.oldPrice ? INR(p.oldPrice) : '';
    mrp.hidden = !p.oldPrice;
    const usd = $('#featUsd');
    usd.textContent = p.usd ? USD(p.usd) : '';
    usd.hidden = !p.usd;
    $('#featDur').textContent = p.duration || 'Instant delivery';

    $('#featSpecs').innerHTML = [
      ['PRODUCT ID', p.id],
      ['CATEGORY', catLabel(p.category)],
      ['DELIVERY', 'Instant / manual'],
      ['AVAILABILITY', p.available === false ? 'Unavailable' : 'In stock']
    ].map(([k, v]) => `<li><span>${esc(k)}</span><span>${esc(v)}</span></li>`).join('');

    $('#featThumbs').innerHTML = pool.map((x, i) =>
      `<button class="feat__thumb${i === featIndex ? ' is-active' : ''}" data-thumb="${i}" aria-label="${esc(x.name)}" aria-pressed="${i === featIndex}">${mediaHTML(x)}</button>`
    ).join('');
  }

  function initFeaturedEvents() {
    $('#featThumbs').addEventListener('click', e => {
      const b = e.target.closest('[data-thumb]');
      if (!b) return;
      featIndex = Number(b.dataset.thumb);
      renderFeatured(true);
      restartFeatAuto();
    });

    $('#featBuy').addEventListener('click', () => {
      const pool = featPool();
      const p = pool[featIndex];
      if (!p) return;
      addToCart(p.id, 1);
      openCart();
    });

    $('#featMore').addEventListener('click', () => {
      const p = featPool()[featIndex];
      if (p) openPDP(p.id);
    });

    const feat = $('.feat');
    if (feat) {
      feat.addEventListener('pointerenter', () => clearInterval(featTimer));
      feat.addEventListener('pointerleave', restartFeatAuto);
    }
    restartFeatAuto();
  }

  function restartFeatAuto() {
    clearInterval(featTimer);
    if (reduced) return;
    featTimer = setInterval(() => {
      const pool = featPool();
      if (!pool.length) return;
      featIndex = (featIndex + 1) % pool.length;
      renderFeatured(true);
    }, 7500);
  }

  /* ------------------------------------------------------------
     CART
     ------------------------------------------------------------ */
  const cartQty = () => cart.reduce((n, i) => n + i.qty, 0);

  function addToCart(id, qty = 1) {
    const p = byId[id];
    if (!p) return;
    if (p.available === false) { showToast('THIS PRODUCT IS CURRENTLY UNAVAILABLE'); return; }
    const found = cart.find(i => i.id === id);
    if (found) found.qty = Math.min(99, found.qty + qty);
    else cart.push({ id, qty: Math.min(99, qty) });
    saveCart();
    renderCart();
    showToast(`ADDED — ${p.name.toUpperCase()} × ${qty}`);
  }

  function renderCart() {
    const count = cartQty();
    $$('.cart-btn__count').forEach(el => { el.textContent = `[${count}]`; });
    const head = $('#cartHeadCount');
    if (head) head.textContent = `${count} ITEM${count === 1 ? '' : 'S'}`;

    const empty = $('#cartEmpty');
    const items = $('#cartItems');
    const foot = $('#cartFoot');

    if (!cart.length) {
      empty.hidden = false;
      items.innerHTML = '';
      foot.hidden = true;
      return;
    }
    empty.hidden = true;
    foot.hidden = false;

    items.innerHTML = cart.map(line => {
      const p = byId[line.id];
      if (!p) return '';
      return `<div class="cart-item" data-key="${esc(p.id)}">
        <div class="cart-item__art">${mediaHTML(p)}</div>
        <div>
          <div class="cart-item__name">${esc(p.name)}</div>
          <div class="cart-item__meta">${esc(p.id)} · ${esc(catLabel(p.category).toUpperCase())}</div>
          <div class="cart-item__price">${INR(p.price * line.qty)}${p.usd ? ` <span class="card__usd">${USD(p.usd * line.qty)}</span>` : ''}</div>
          <div class="qty">
            <button data-cart="dec" aria-label="Decrease quantity">−</button>
            <span>${line.qty}</span>
            <button data-cart="inc" aria-label="Increase quantity">+</button>
          </div>
        </div>
        <button class="cart-item__remove" data-cart="remove" aria-label="Remove ${esc(p.name)}">✕</button>
      </div>`;
    }).join('');

    const subtotal = cart.reduce((n, l) => n + (byId[l.id]?.price || 0) * l.qty, 0);
    $('#cartSubtotal').textContent = INR(subtotal);
    $('#cartTotal').textContent = INR(subtotal);

    const usdRow = $('#cartUsdRow');
    const allUsd = cart.every(l => byId[l.id]?.usd);
    if (usdRow) {
      usdRow.hidden = !allUsd;
      if (allUsd) {
        const usdTotal = cart.reduce((n, l) => n + byId[l.id].usd * l.qty, 0);
        $('#cartUsd').textContent = USD(usdTotal);
      }
    }
  }

  /* apply a transition class even if requestAnimationFrame is throttled */
  function paintClass(el, cls = 'is-open') {
    let done = false;
    const apply = () => {
      if (done) return;
      done = true;
      el.classList.add(cls);
    };
    requestAnimationFrame(apply);
    setTimeout(apply, 60);
  }

  let lastFocus = null;
  function openCart() {
    lastFocus = document.activeElement;
    const cartEl = $('#cart');
    const overlay = $('#overlay');
    overlay.hidden = false;
    renderCart();
    paintClass(overlay);
    cartEl.classList.add('is-open');
    cartEl.setAttribute('aria-hidden', 'false');
    document.body.classList.add('cart-open');
    setTimeout(() => $('#cartClose').focus(), 80);
  }
  function closeCart() {
    const cartEl = $('#cart');
    const overlay = $('#overlay');
    cartEl.classList.remove('is-open');
    cartEl.setAttribute('aria-hidden', 'true');
    overlay.classList.remove('is-open');
    document.body.classList.remove('cart-open');
    setTimeout(() => { overlay.hidden = true; }, 400);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function goShop() {
    closeCart();
    const shop = document.getElementById('shop');
    if (shop) shop.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  }

  function initCartEvents() {
    $('#cartBtn').addEventListener('click', openCart);
    $('#cartClose').addEventListener('click', closeCart);
    $('#overlay').addEventListener('click', closeCart);
    $('#cartShop').addEventListener('click', goShop);
    $('#cartContinue').addEventListener('click', goShop);

    $('#cartItems').addEventListener('click', e => {
      const btn = e.target.closest('[data-cart]');
      if (!btn) return;
      const row = e.target.closest('.cart-item');
      if (!row) return;
      const line = cart.find(i => i.id === row.dataset.key);
      if (!line) return;

      if (btn.dataset.cart === 'inc') line.qty = Math.min(99, line.qty + 1);
      if (btn.dataset.cart === 'dec') line.qty -= 1;
      if (btn.dataset.cart === 'remove' || line.qty <= 0) cart = cart.filter(i => i !== line);

      saveCart();
      renderCart();
    });

    $('#checkout').addEventListener('click', () => {
      if (!cart.length) return;
      showToast('CHECKOUT — DEMO ONLY. CONNECT RAZORPAY / STRIPE IN APP.JS');
    });
  }

  function showToast(msg) {
    const toast = $('#toast');
    toast.textContent = msg;
    toast.classList.add('is-show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('is-show'), 2800);
  }

  /* ------------------------------------------------------------
     PRODUCT DETAIL
     ------------------------------------------------------------ */
  let pdpState = null;
  let pdpLastFocus = null;

  function pdpHTML(p) {
    const pool = available();
    const related = (pool.length > 1 ? pool : PRODUCTS)
      .filter(x => x.id !== p.id)
      .sort((a, b) => (a.category === p.category ? -1 : 0) - (b.category === p.category ? -1 : 0))
      .slice(0, 3);

    const index = PRODUCTS.findIndex(x => x.id === p.id) + 1;
    const off = p.available === false;

    return `<div class="pdp__bar">
      <button class="pdp__back" id="pdpBack">← BACK TO SHOP</button>
      <a class="logo" href="#home" aria-label="Z Mart home"><span class="logo__mark">Z</span><span class="logo__word">MART</span></a>
      <button class="cart-btn" id="pdpCart" aria-label="Open cart"><span>CART</span><span class="cart-btn__count">[${cartQty()}]</span></button>
    </div>

    <div class="pdp__inner wrap">
      <div class="pdp__grid">
        <div class="pdp__stage" style="background:${esc(p.tone || '#221236')}">
          <span class="pdp__stage-tag">OBJECT ${pad2(index)} / ${pad2(PRODUCTS.length)} · ${esc(p.id)}</span>
          <div class="pdp__art" id="pdpArt">${mediaHTML(p)}</div>
          <div class="pdp__views">
            <button class="pdp__view is-active" data-view="0">01</button>
            <button class="pdp__view" data-view="1">02</button>
            <button class="pdp__view" data-view="2">03</button>
          </div>
        </div>

        <div class="pdp__info">
          <p class="eyebrow">${esc(catLabel(p.category).toUpperCase())} / ${esc(p.id)}</p>
          <h1 class="pdp__name">${esc(p.name)}</h1>

          <div class="pdp__price">
            <strong>${INR(p.price)}</strong>
            ${p.oldPrice ? `<s>${INR(p.oldPrice)}</s>` : ''}
            ${p.usd ? `<span class="pdp__usd">${USD(p.usd)}</span>` : ''}
          </div>

          <p class="pdp__desc">${esc(p.description)}</p>

          <span class="pdp__label">DELIVERY &amp; WARRANTY</span>
          <div class="pdp__dur">${esc(p.duration || 'Instant delivery')}</div>

          ${off
            ? `<div class="pdp__unavailable">THIS PRODUCT IS CURRENTLY UNAVAILABLE. CHECK BACK SOON.</div>`
            : `<div class="pdp__buy">
                 <div class="pdp__qty">
                   <button id="pdpMinus" aria-label="Decrease quantity">−</button>
                   <span id="pdpQty">1</span>
                   <button id="pdpPlus" aria-label="Increase quantity">+</button>
                 </div>
                 <button class="btn btn--orange" id="pdpAdd">ADD TO CART <span aria-hidden="true">+</span></button>
                 <button class="btn btn--ghost" id="pdpBuy">BUY NOW</button>
               </div>`}

          <div class="pdp__meta"><span>INSTANT DELIVERY</span><span>WARRANTY SUPPORT</span><span>SECURE CHECKOUT</span></div>

          <div class="pdp__accordion">
            <details open><summary>WHAT YOU GET</summary><p>${esc(p.description)}</p></details>
            <details><summary>DELIVERY &amp; WARRANTY</summary><p>${esc(p.duration || 'Instant delivery')}. Orders are processed manually by our team, usually within 5–30 minutes. Keep your order ID handy when contacting support.</p></details>
            <details><summary>PRODUCT DETAILS</summary><ul>
              <li><span>PRODUCT ID</span><span>${esc(p.id)}</span></li>
              <li><span>CATEGORY</span><span>${esc(catLabel(p.category))}</span></li>
              <li><span>PRICE (INR)</span><span>${INR(p.price)}</span></li>
              ${p.usd ? `<li><span>PRICE (USD)</span><span>${USD(p.usd)}</span></li>` : ''}
              <li><span>AVAILABILITY</span><span>${off ? 'Unavailable' : 'In stock'}</span></li>
            </ul></details>
            <details><summary>SUPPORT</summary><p>Message us any time at hello@zmart.store. Include your product ID and order reference and we'll sort it out.</p></details>
          </div>
        </div>
      </div>

      <div class="pdp__related">
        <div class="pdp__related-head"><h3>KEEP LOOKING</h3><span class="eyebrow">${pad2(related.length)} OBJECTS</span></div>
        <div class="pdp__related-grid">${related.map(cardHTML).join('')}</div>
      </div>
    </div>`;
  }

  function openPDP(id, push = true) {
    const p = byId[id];
    if (!p) return;
    const view = $('#productView');
    if (!pdpState) pdpLastFocus = document.activeElement;
    pdpState = { id, qty: 1, view: 0 };
    view.innerHTML = pdpHTML(p);
    view.hidden = false;
    view.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-locked');
    paintClass(view);
    view.scrollTop = 0;
    observeReveals(view);
    if (push) history.pushState({ pdp: id }, '', '#/product/' + encodeURIComponent(id));
    if (window.ZMcloseMenu) window.ZMcloseMenu();
    const back = $('#pdpBack');
    if (back) back.focus({ preventScroll: true });
  }

  function closePDP(push = true) {
    const view = $('#productView');
    if (!view || view.hidden) return;
    view.classList.remove('is-open');
    view.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-locked');
    setTimeout(() => {
      if (!view.classList.contains('is-open')) { view.hidden = true; view.innerHTML = ''; }
    }, 520);
    pdpState = null;
    if (push && location.hash.startsWith('#/product/')) history.pushState({}, '', '#shop');
    if (pdpLastFocus && pdpLastFocus.focus) pdpLastFocus.focus();
  }

  function initPDP() {
    $('#productView').addEventListener('click', e => {
      const view = e.target.closest('[data-view]');
      if (view && pdpState) {
        const n = Number(view.dataset.view);
        pdpState.view = n;
        $$('.pdp__view').forEach(b => b.classList.toggle('is-active', b === view));
        const art = $('#pdpArt');
        if (art) art.style.transform = ['none', 'rotate(-7deg) scale(1.06)', 'rotate(6deg) scale(.92)'][n];
        return;
      }

      if (e.target.closest('#pdpBack')) { closePDP(); return; }
      if (e.target.closest('#pdpCart')) { openCart(); return; }

      if (e.target.closest('#pdpMinus') && pdpState) {
        pdpState.qty = Math.max(1, pdpState.qty - 1);
        $('#pdpQty').textContent = pdpState.qty;
        return;
      }
      if (e.target.closest('#pdpPlus') && pdpState) {
        pdpState.qty = Math.min(99, pdpState.qty + 1);
        $('#pdpQty').textContent = pdpState.qty;
        return;
      }
      if (e.target.closest('#pdpAdd') && pdpState) {
        addToCart(pdpState.id, pdpState.qty);
        const b = $('#pdpAdd');
        if (b) {
          b.innerHTML = 'ADDED ✓';
          setTimeout(() => {
            const again = $('#pdpAdd');
            if (again) again.innerHTML = 'ADD TO CART <span aria-hidden="true">+</span>';
          }, 1400);
        }
        return;
      }
      if (e.target.closest('#pdpBuy') && pdpState) {
        addToCart(pdpState.id, pdpState.qty);
        openCart();
        return;
      }

      const add = e.target.closest('[data-action="add"]');
      if (add) { addToCart(add.dataset.id, 1); return; }

      const card = e.target.closest('.card');
      if (card) openPDP(card.dataset.id);
    });

    window.addEventListener('popstate', () => {
      if (location.hash.startsWith('#/product/')) {
        const id = decodeURIComponent(location.hash.replace('#/product/', ''));
        if (byId[id] && (!pdpState || pdpState.id !== id)) openPDP(id, false);
      } else {
        closePDP(false);
      }
    });
  }

  function routeFromHash() {
    if (location.hash.startsWith('#/product/')) {
      const id = decodeURIComponent(location.hash.replace('#/product/', ''));
      if (byId[id]) setTimeout(() => openPDP(id, false), 60);
    }
  }

  /* ------------------------------------------------------------
     MISC
     ------------------------------------------------------------ */
  function initMisc() {
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const href = a.getAttribute('href');
      if (href.startsWith('#/product/')) return;
      if (!$('#productView').hidden) closePDP(false);
      if (href.length > 1) {
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
          history.replaceState({}, '', href);
        }
      }
    });

    window.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      const cartEl = $('#cart');
      if (cartEl.classList.contains('is-open')) closeCart();
      else if (!$('#productView').hidden) closePDP();
    });

    const form = $('#newsletter');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const input = $('#email');
      const msg = $('#newsletterMsg');
      const val = input.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        msg.textContent = 'ENTER A VALID EMAIL.';
        msg.style.color = 'var(--orange)';
        input.focus();
        return;
      }
      msg.style.color = 'var(--neon)';
      msg.textContent = 'YOU’RE ON THE LIST — NEW DROPS SOON.';
      form.reset();
    });
  }
})();
