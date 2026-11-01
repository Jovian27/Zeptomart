/* ============================================================
   Z MART® — buyer profile dashboard
   Discord session → profile → orders → customization
   ============================================================ */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const pad2 = n => String(Number(n) || 0).padStart(2, '0');
  const INR = n => '₹' + Number(n || 0).toLocaleString('en-IN');

  const FALLBACK_ACCENTS = ['#a855f7', '#7c3aed', '#d946ef', '#22d3ee', '#f472b6', '#fbbf24', '#34d399', '#fb7185'];

  const loading = $('#pfLoading');
  const gate = $('#pfGate');
  const gateError = $('#gateError');
  const app = $('#pfApp');

  let me = null;
  let orders = [];
  let accents = FALLBACK_ACCENTS.slice();
  let draft = null;
  let busy = false;

  /* ------------------------------------------------------------
     FORMATTERS
     ------------------------------------------------------------ */
  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  }

  function fmtDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).toUpperCase();
  }

  const statusLabel = s => {
    const v = String(s || 'pending');
    return v.charAt(0).toUpperCase() + v.slice(1);
  };

  function setImg(img, src, fallback) {
    if (!img) return;
    img.onerror = () => {
      img.onerror = null;
      if (fallback && img.getAttribute('src') !== fallback) img.setAttribute('src', fallback);
    };
    img.src = src || fallback || '';
  }

  function toast(msg, isError = false) {
    const el = $('#pfToast');
    el.textContent = msg;
    el.classList.toggle('is-error', isError);
    el.classList.add('is-show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('is-show'), isError ? 3600 : 2600);
  }

  /* ------------------------------------------------------------
     GATE / SHELL
     ------------------------------------------------------------ */
  function gateMessage() {
    const reason = new URLSearchParams(location.search).get('discord');
    if (!reason) return '';
    if (reason === 'denied') return 'DISCORD AUTHORIZATION WAS CANCELLED.';
    if (reason === 'unconfigured') return 'DISCORD LOGIN IS NOT CONFIGURED ON THIS SERVER.';
    if (reason === 'suspended') return 'THIS ACCOUNT IS SUSPENDED. CONTACT SUPPORT.';
    return 'DISCORD SIGN-IN FAILED. PLEASE TRY AGAIN.';
  }

  function showGate(message) {
    loading.hidden = true;
    app.hidden = true;
    gate.hidden = false;
    gateError.textContent = message || '';
    document.title = 'Z MART® — Sign In';
  }

  function showApp() {
    loading.hidden = true;
    gate.hidden = true;
    app.hidden = false;
  }

  /* ------------------------------------------------------------
     FETCH
     ------------------------------------------------------------ */
  async function api(path, opts = {}) {
    const res = await fetch(path, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', ...(opts.headers || {}) },
      ...opts
    });
    let data = {};
    try { data = await res.json(); } catch {}
    if (!res.ok) {
      const err = new Error(data.error || `REQUEST FAILED (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async function loadProfile() {
    const data = await api('/api/customer/profile');
    me = data.customer;
  }

  async function loadOrders() {
    const data = await api('/api/customer/orders');
    orders = Array.isArray(data.orders) ? data.orders : [];
  }

  async function loadAccents() {
    try {
      const res = await fetch('/api/auth-config', { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      const cfg = await res.json();
      if (Array.isArray(cfg.accents) && cfg.accents.length) accents = cfg.accents;
    } catch {}
  }

  async function boot() {
    const accentsTask = loadAccents();
    try {
      const res = await fetch('/api/customer/session', {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      });
      const data = res.ok ? await res.json() : { authenticated: false };
      if (!data.authenticated) {
        await accentsTask;
        showGate(gateMessage());
        return;
      }
      me = data.customer;
      await Promise.all([loadProfile(), loadOrders(), accentsTask]);
      renderProfile();
      renderOrders();
      renderSettings();
      showApp();
      route();
    } catch (err) {
      if (err && err.status === 401) {
        showGate('YOUR SESSION EXPIRED — SIGN IN AGAIN.');
        return;
      }
      showGate('COULD NOT LOAD YOUR ACCOUNT. REFRESH TO TRY AGAIN.');
    }
  }

  /* ------------------------------------------------------------
     RENDER — PROFILE
     ------------------------------------------------------------ */
  function renderProfile() {
    if (!me) return;
    const accent = me.accent || FALLBACK_ACCENTS[0];
    document.documentElement.style.setProperty('--pf-accent', accent);

    $('#sideId').textContent = me.id;
    $('#pfName').textContent = me.displayName || me.username || 'Z MART BUYER';
    $('#pfHandle').textContent = '@' + (me.username || 'discord-user');
    $('#pfJoined').textContent = fmtDate(me.createdAt);
    $('#pfStatus').textContent = (me.status || 'active').toUpperCase();
    $('#coverStatus').textContent = (me.status || 'active').toUpperCase();

    setImg($('#pfAvatar'), me.avatar, me.discordAvatar);

    const cover = $('#pfCover');
    if (me.banner) {
      cover.style.backgroundImage =
        `linear-gradient(180deg, rgba(11,6,20,.12), rgba(22,11,37,.62)), url("${encodeURI(me.banner)}")`;
      cover.style.backgroundSize = 'cover';
      cover.style.backgroundPosition = 'center';
    } else {
      cover.style.backgroundImage = '';
      cover.style.backgroundSize = '';
      cover.style.backgroundPosition = '';
    }

    $('#pfChips').innerHTML =
      `<span class="pf-chip pf-chip--accent">DISCORD VERIFIED</span>` +
      `<span class="pf-chip">CUSTOMER ${esc(me.id)}</span>` +
      `<span class="pf-chip">MEMBER ${esc(fmtDate(me.createdAt))}</span>`;

    $('#statOrders').textContent = pad2(me.totalOrders);
    $('#statCompleted').textContent = pad2(me.completedOrders);
    $('#statLogins').textContent = pad2(me.loginCount);

    const bio = $('#pfBio');
    if (me.bio) {
      bio.textContent = me.bio;
      bio.classList.remove('is-empty');
    } else {
      bio.textContent = 'NO BIO YET — OPEN EDIT PROFILE TO ADD A SHORT INTRODUCTION.';
      bio.classList.add('is-empty');
    }

    $('#factId').textContent = me.id;
    $('#factHandle').textContent = '@' + (me.username || '—');
    $('#factDiscordId').textContent = me.discordId;
    $('#factJoined').textContent = fmtDate(me.createdAt);
    $('#factLastLogin').textContent = fmtDateTime(me.lastLoginAt);
    $('#factAccent').textContent = accent.toUpperCase();
  }

  /* ------------------------------------------------------------
     RENDER — ORDERS
     ------------------------------------------------------------ */
  function orderHTML(o) {
    const st = ['pending', 'processing', 'completed', 'cancelled'].includes(o.status) ? o.status : 'pending';
    return `<article class="pf-order" data-order-id="${esc(o.id)}">
      <div class="pf-order__main" role="button" tabindex="0" aria-expanded="false">
        <div>
          <div class="pf-order__id">ORDER / ${esc(o.id)}</div>
          <div class="pf-order__name">${esc(o.productName || 'Z MART ORDER')}</div>
          <div class="pf-order__date">${esc(fmtDateTime(o.createdAt))}</div>
        </div>
        <div class="pf-order__price"><span>PRICE</span>${esc(INR(o.price))}</div>
        <div><span class="pf-status pf-status--${st}"><i></i>${esc(statusLabel(st))}</span></div>
        <div class="pf-order__toggle">DETAILS ↓</div>
      </div>
      <div class="pf-order__details">
        <div class="pf-facts">
          <div class="pf-fact"><span>Order ID</span><b>${esc(o.id)}</b></div>
          <div class="pf-fact"><span>Product</span><b>${esc(o.productName || '—')}</b></div>
          <div class="pf-fact"><span>Product ID</span><b>${esc(o.productId || '—')}</b></div>
          <div class="pf-fact"><span>Price</span><b>${esc(INR(o.price))}</b></div>
          <div class="pf-fact"><span>Ordered</span><b>${esc(fmtDateTime(o.createdAt))}</b></div>
          <div class="pf-fact"><span>Last update</span><b>${esc(fmtDateTime(o.updatedAt || o.createdAt))}</b></div>
          <div class="pf-fact"><span>Status</span><b>${esc(statusLabel(st))}</b></div>
        </div>
      </div>
    </article>`;
  }

  function renderOrders() {
    const list = $('#ordersList');
    const empty = $('#ordersEmpty');
    $('#ordersCount').textContent = pad2(orders.length);
    $('#tabOrderCount').textContent = pad2(orders.length);

    if (!orders.length) {
      list.innerHTML = '';
      list.hidden = true;
      empty.hidden = false;
      return;
    }
    list.hidden = false;
    empty.hidden = true;
    list.innerHTML = orders.map(orderHTML).join('');
  }

  function toggleOrder(row) {
    const order = row.closest('.pf-order');
    if (!order) return;
    const open = order.classList.toggle('is-open');
    const main = order.querySelector('.pf-order__main');
    const toggle = order.querySelector('.pf-order__toggle');
    if (main) main.setAttribute('aria-expanded', String(open));
    if (toggle) toggle.textContent = open ? 'DETAILS ↑' : 'DETAILS ↓';
  }

  /* ------------------------------------------------------------
     RENDER — SETTINGS
     ------------------------------------------------------------ */
  function renderSettings() {
    if (!me) return;
    setImg($('#setAvatar'), me.avatar, me.discordAvatar);
    $('#setName').textContent = me.displayName || me.username;
    $('#setHandle').textContent = '@' + (me.username || '—');
    $('#setDiscordId').textContent = me.discordId;
    $('#setCustomerId').textContent = me.id;
    $('#setLastLogin').textContent = fmtDateTime(me.lastLoginAt);
    $('#setDisplayName').textContent = me.displayName || me.username;
    $('#setBio').textContent = me.bio ? (me.bio.length > 64 ? me.bio.slice(0, 64) + '…' : me.bio) : '—';
    $('#setAccent').textContent = (me.accent || FALLBACK_ACCENTS[0]).toUpperCase();
    $('#setAvatarState').textContent = me.avatarCustom ? 'CUSTOM UPLOAD' : 'DISCORD DEFAULT';
    $('#setBannerState').textContent = me.banner ? 'CUSTOM UPLOAD' : 'NONE';
  }

  /* ------------------------------------------------------------
     TABS
     ------------------------------------------------------------ */
  function route() {
    if (!me) return;
    const valid = ['profile', 'orders', 'settings'];
    const hash = location.hash.replace('#', '');
    const tab = valid.includes(hash) ? hash : 'profile';

    $$('.pf-tab').forEach(a => {
      const active = a.dataset.tab === tab;
      a.classList.toggle('is-active', active);
      if (active) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    $$('.pf-panel').forEach(p => { p.hidden = p.dataset.panel !== tab; });

    document.title = tab === 'orders'
      ? 'Z MART® — My Orders'
      : tab === 'settings'
        ? 'Z MART® — Account Settings'
        : 'Z MART® — My Profile';
  }

  /* ------------------------------------------------------------
     EDIT DRAWER
     ------------------------------------------------------------ */
  function openEditor() {
    if (!me || busy) return;
    draft = {
      name: me.displayName || me.username || '',
      bio: me.bio || '',
      accent: me.accent || FALLBACK_ACCENTS[0],
      avatar: me.avatarCustom ? me.avatar : '',
      banner: me.banner || ''
    };

    $('#fieldName').value = draft.name;
    $('#fieldBio').value = draft.bio;
    $('#avatarFile').value = '';
    $('#bannerFile').value = '';
    $('#formError').textContent = '';
    renderSwatches();
    updatePreview();

    const drawer = $('#pfDrawer');
    const overlay = $('#pfOverlay');
    drawer.hidden = false;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => drawer.classList.add('is-open'));
    setTimeout(() => $('#fieldName').focus(), 220);
  }

  function closeEditor() {
    const drawer = $('#pfDrawer');
    if (drawer.hidden) return;
    drawer.classList.remove('is-open');
    $('#pfOverlay').hidden = true;
    document.body.style.overflow = '';
    setTimeout(() => { if (!drawer.classList.contains('is-open')) drawer.hidden = true; }, 520);
    draft = null;
  }

  function renderSwatches() {
    const wrap = $('#swatches');
    wrap.innerHTML = accents.map(color =>
      `<button type="button" class="pf-swatch${draft && draft.accent === color ? ' is-active' : ''}"
        data-accent="${esc(color)}" style="color:${esc(color)}" aria-label="Accent ${esc(color)}"></button>`
    ).join('');
  }

  function updatePreview() {
    if (!draft) return;
    const name = ($('#fieldName').value || '').trim() || me.displayName || me.username || '—';
    const bio = $('#fieldBio').value || '';
    const accent = draft.accent || FALLBACK_ACCENTS[0];

    $('#previewName').textContent = name;
    $('#previewHandle').textContent = '@' + (me.username || '—');

    const previewBio = $('#previewBio');
    if (bio.trim()) {
      previewBio.textContent = bio.trim();
      previewBio.classList.remove('is-empty');
    } else {
      previewBio.textContent = 'NO BIO ADDED YET.';
      previewBio.classList.add('is-empty');
    }

    const avatarSrc = draft.avatar || me.discordAvatar;
    setImg($('#previewAvatar'), avatarSrc, me.discordAvatar);

    const banner = $('#previewBanner');
    if (draft.banner) {
      banner.style.backgroundImage =
        `linear-gradient(180deg, transparent 30%, rgba(30,16,50,.8)), url("${encodeURI(draft.banner)}")`;
    } else {
      banner.style.backgroundImage = '';
    }

    $('#previewAccent').innerHTML =
      `<i style="color:${esc(accent)};background:${esc(accent)}"></i>` +
      `<i style="color:${esc(accent)};background:${esc(accent)}"></i>` +
      `<i style="color:${esc(accent)};background:${esc(accent)}"></i>`;

    const avatarPrev = $('#avatarPreview');
    avatarPrev.innerHTML = draft.avatar
      ? `<img src="${esc(draft.avatar)}" alt="Avatar preview">`
      : '<span>DISCORD<br>AVATAR</span>';

    const bannerPrev = $('#bannerPreview');
    bannerPrev.innerHTML = draft.banner
      ? `<img src="${esc(draft.banner)}" alt="Banner preview">`
      : '<span>NO BANNER</span>';

    $$('.pf-swatch', $('#swatches')).forEach(b => {
      b.classList.toggle('is-active', b.dataset.accent === draft.accent);
    });

    const nLen = $('#fieldName').value.length;
    const bLen = $('#fieldBio').value.length;
    $('#nameCount').textContent = `${nLen} / 32`;
    $('#bioCount').textContent = `${bLen} / 280`;
    $('#nameCount').parentElement.classList.toggle('is-over', nLen > 32);
    $('#bioCount').parentElement.classList.toggle('is-over', bLen > 280);
  }

  /* ------------------------------------------------------------
     IMAGE UPLOAD
     ------------------------------------------------------------ */
  function resizeImage(file, max) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);
          let out = canvas.toDataURL('image/webp', 0.88);
          if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/jpeg', 0.88);
          URL.revokeObjectURL(url);
          resolve(out);
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('COULD NOT READ IMAGE')); };
      img.src = url;
    });
  }

  async function uploadFile(kind, file) {
    if (!draft || !file || busy) return;
    const isAvatar = kind === 'avatar';
    const maxBytes = (isAvatar ? 2 : 5) * 1024 * 1024;
    $('#formError').textContent = '';

    if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) {
      $('#formError').textContent = 'USE A PNG, JPG OR WEBP IMAGE.';
      return;
    }
    if (file.size > maxBytes) {
      $('#formError').textContent = `IMAGE TOO LARGE — MAX ${isAvatar ? '2' : '5'} MB.`;
      return;
    }

    const prev = isAvatar ? $('#avatarPreview') : $('#bannerPreview');
    prev.innerHTML = '<span>UPLOADING…</span>';

    try {
      const dataUrl = await resizeImage(file, isAvatar ? 512 : 1600);
      const res = await fetch('/api/customer/upload', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ kind, dataUrl })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'UPLOAD FAILED');
      draft[kind] = data.url;
      updatePreview();
      toast(`${isAvatar ? 'AVATAR' : 'BANNER'} UPLOADED — SAVE CHANGES TO APPLY`);
    } catch (err) {
      $('#formError').textContent = String(err.message || 'UPLOAD FAILED').toUpperCase();
      updatePreview();
    }
  }

  /* ------------------------------------------------------------
     SAVE
     ------------------------------------------------------------ */
  async function saveProfile(e) {
    e.preventDefault();
    if (!draft || busy) return;
    const formError = $('#formError');
    formError.textContent = '';

    const name = ($('#fieldName').value || '').trim();
    const bio = ($('#fieldBio').value || '').trim();

    if (name.length < 2 || name.length > 32) {
      formError.textContent = 'DISPLAY NAME MUST BE 2–32 CHARACTERS.';
      $('#fieldName').focus();
      return;
    }
    if (bio.length > 280) {
      formError.textContent = 'BIO MUST BE 280 CHARACTERS OR LESS.';
      $('#fieldBio').focus();
      return;
    }

    const saveBtn = $('#formSave');
    busy = true;
    saveBtn.disabled = true;
    const label = saveBtn.textContent;
    saveBtn.textContent = 'SAVING…';

    try {
      const data = await api('/api/customer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: name,
          bio,
          accent: draft.accent,
          avatar: draft.avatar,
          banner: draft.banner
        })
      });
      me = data.customer;
      busy = false;
      closeEditor();
      renderProfile();
      renderSettings();
      toast('PROFILE UPDATED');
    } catch (err) {
      formError.textContent = String(err.message || 'COULD NOT SAVE').toUpperCase();
    } finally {
      busy = false;
      saveBtn.disabled = false;
      saveBtn.textContent = label;
    }
  }

  /* ------------------------------------------------------------
     LOGOUT
     ------------------------------------------------------------ */
  async function logout() {
    try {
      await fetch('/api/customer/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: '{}'
      });
    } catch {}
    location.href = '/';
  }

  /* ------------------------------------------------------------
     EVENTS
     ------------------------------------------------------------ */
  $('#sideLogout').addEventListener('click', logout);
  $('#settingsLogout').addEventListener('click', logout);
  $('#editBtn').addEventListener('click', openEditor);
  $('#settingsEdit').addEventListener('click', openEditor);
  $('#drawerClose').addEventListener('click', closeEditor);
  $('#formCancel').addEventListener('click', closeEditor);
  $('#pfOverlay').addEventListener('click', closeEditor);
  $('#pfForm').addEventListener('submit', saveProfile);

  $('#fieldName').addEventListener('input', updatePreview);
  $('#fieldBio').addEventListener('input', updatePreview);

  $('#swatches').addEventListener('click', e => {
    const swatch = e.target.closest('.pf-swatch');
    if (!swatch || !draft) return;
    draft.accent = swatch.dataset.accent;
    updatePreview();
  });

  $('#avatarFile').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (file) uploadFile('avatar', file);
  });

  $('#bannerFile').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (file) uploadFile('banner', file);
  });

  $('#avatarReset').addEventListener('click', () => {
    if (!draft) return;
    draft.avatar = '';
    $('#avatarFile').value = '';
    updatePreview();
  });

  $('#bannerReset').addEventListener('click', () => {
    if (!draft) return;
    draft.banner = '';
    $('#bannerFile').value = '';
    updatePreview();
  });

  $('#ordersList').addEventListener('click', e => {
    const main = e.target.closest('.pf-order__main');
    if (main) toggleOrder(main);
  });

  $('#ordersList').addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const main = e.target.closest('.pf-order__main');
    if (!main) return;
    e.preventDefault();
    toggleOrder(main);
  });

  window.addEventListener('hashchange', route);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('#pfDrawer').hidden) closeEditor();
  });

  boot();
})();
