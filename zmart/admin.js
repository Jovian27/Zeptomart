/* ============================================================
   Z MART® — admin app
   Session auth → catalogue CRUD → image upload
   ============================================================ */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const INR = n => '₹' + Number(n).toLocaleString('en-IN');
  const USD = n => '$' + Number(n).toFixed(2);
  const pad2 = n => String(Number(n) || 0).padStart(2, '0');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const fmtDate = iso => {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  };
  const fmtDateTime = iso => {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).toUpperCase();
  };

  const CATS = { discord: 'Discord Services', gaming: 'Gaming', ai: 'AI Subscriptions', software: 'Software' };
  const ART_LABEL = { nitro: 'N', boost: 'B', minecraft: 'M', steam: 'S', owo: 'O', generic: 'D' };

  const loginView = $('#loginView');
  const dashView = $('#dashView');
  const logoutBtn = $('#logoutBtn');
  const loginForm = $('#loginForm');
  const loginError = $('#loginError');
  const loginBtn = $('#loginBtn');
  const discordBlock = $('#discordBlock');

  const listEl = $('#adList');
  const emptyEl = $('#adEmpty');
  const searchEl = $('#adSearch');
  const adCount = $('#adCount');
  const form = $('#productForm');
  const drawer = $('#adDrawer');
  const overlay = $('#adOverlay');
  const drawerTitle = $('#drawerTitle');
  const drawerKicker = $('#drawerKicker');
  const formError = $('#formError');
  const saveBtn = $('#saveBtn');
  const imgPreview = $('#imgPreview');
  const imgFile = $('#imgFile');
  const toastEl = $('#adToast');

  const custListEl = $('#custList');
  const custEmptyEl = $('#custEmpty');
  const custSearchEl = $('#custSearch');
  const custSortEl = $('#custSort');
  const custStatusEl = $('#custStatus');
  const custDrawer = $('#custDrawer');
  const custOverlay = $('#custOverlay');
  const custDetail = $('#custDetail');
  const custDrawerKicker = $('#custDrawerKicker');
  const custDrawerTitle = $('#custDrawerTitle');

  let products = [];
  let customers = [];
  let editingId = null;
  let imageUrl = '';
  let busy = false;
  let activeCustomer = null;
  let custBusy = false;
  let custSearchTimer = null;

  /* ------------------------------------------------------------
     API
     ------------------------------------------------------------ */
  async function api(path, opts = {}) {
    const res = await fetch(path, {
      credentials: 'same-origin',
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(opts.headers || {})
      }
    });
    let data = {};
    try { data = await res.json(); } catch {}
    if (res.status === 401) {
      showLogin();
      throw new Error('SESSION EXPIRED — SIGN IN AGAIN');
    }
    if (!res.ok) throw new Error(data.error || 'REQUEST FAILED');
    return data;
  }

  function toast(msg, isError = false) {
    toastEl.textContent = msg;
    toastEl.classList.toggle('is-error', isError);
    toastEl.classList.add('is-show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('is-show'), 2800);
  }

  /* ------------------------------------------------------------
     TABS
     ------------------------------------------------------------ */
  function setAdminTab(name) {
    $$('[data-ad-tab]').forEach(b => b.classList.toggle('is-active', b.dataset.adTab === name));
    $$('[data-ad-panel]').forEach(p => { p.hidden = p.dataset.adPanel !== name; });
    if (name === 'customers') loadCustomers();
  }

  $$('[data-ad-tab]').forEach(b => b.addEventListener('click', () => setAdminTab(b.dataset.adTab)));

  /* ------------------------------------------------------------
     AUTH
     ------------------------------------------------------------ */
  async function boot() {
    loadAuthConfig();
    handleDiscordStatus();
    try {
      const s = await api('/api/session');
      if (s.authenticated) enterApp();
      else showLogin();
    } catch {
      showLogin();
    }
  }

  async function loadAuthConfig() {
    try {
      const cfg = await api('/api/auth-config');
      if (discordBlock) discordBlock.hidden = !cfg.discordLogin;
    } catch {}
  }

  function handleDiscordStatus() {
    const status = new URLSearchParams(location.search).get('discord');
    if (!status) return;
    const messages = {
      denied: 'THAT DISCORD ACCOUNT IS NOT THE OWNER.',
      invalid: 'DISCORD LOGIN EXPIRED — TRY AGAIN.',
      unconfigured: 'DISCORD LOGIN IS NOT SET UP YET.',
      error: 'DISCORD LOGIN FAILED — TRY AGAIN.'
    };
    if (messages[status]) loginError.textContent = messages[status];
    history.replaceState({}, '', '/admin');
  }

  function showLogin() {
    dashView.hidden = true;
    loginView.hidden = false;
    logoutBtn.hidden = true;
    document.body.classList.remove('is-locked');
    closeDrawer(true);
    closeCustomer(true);
    setTimeout(() => $('#loginUser').focus(), 60);
  }

  function enterApp() {
    loginView.hidden = true;
    dashView.hidden = false;
    logoutBtn.hidden = false;
    loginPass.value = '';
    loginError.textContent = '';
    loadProducts();
    loadCustomers();
  }

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const user = $('#loginUser').value.trim();
    const password = $('#loginPass').value;
    if (!user || !password) { loginError.textContent = 'ENTER USERNAME AND PASSWORD.'; return; }

    loginBtn.disabled = true;
    loginBtn.textContent = 'CHECKING…';
    loginError.textContent = '';
    try {
      await api('/api/login', { method: 'POST', body: JSON.stringify({ user, password }) });
      enterApp();
    } catch (err) {
      loginError.textContent = err.message.toUpperCase();
      $('#loginPass').select();
    } finally {
      loginBtn.disabled = false;
      loginBtn.innerHTML = 'ENTER <span aria-hidden="true">→</span>';
    }
  });

  logoutBtn.addEventListener('click', async () => {
    try { await api('/api/logout', { method: 'POST', body: '{}' }); } catch {}
    products = [];
    showLogin();
    toast('SIGNED OUT');
  });

  /* ------------------------------------------------------------
     LIST
     ------------------------------------------------------------ */
  async function loadProducts() {
    try {
      const data = await api('/api/products?all=1');
      products = Array.isArray(data.products) ? data.products : [];
      renderList();
    } catch (err) {
      toast(err.message, true);
    }
  }

  function renderList() {
    const q = searchEl.value.trim().toLowerCase();
    const list = products.filter(p =>
      !q || p.name.toLowerCase().includes(q) || String(p.id).toLowerCase().includes(q)
    );

    listEl.innerHTML = list.map(rowHTML).join('');
    emptyEl.hidden = products.length !== 0;
    listEl.hidden = list.length === 0;

    adCount.textContent = String(products.length).padStart(2, '0');
    $('#statTotal').textContent = String(products.length).padStart(2, '0');
    $('#statLive').textContent = String(products.filter(p => p.available !== false).length).padStart(2, '0');
    $('#statHidden').textContent = String(products.filter(p => p.available === false).length).padStart(2, '0');
  }

  function rowHTML(p) {
    const live = p.available !== false;
    const thumb = p.image
      ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">`
      : `<span>${esc(ART_LABEL[p.art] || 'D')}</span>`;
    return `<article class="ad-row${live ? '' : ' is-hidden'}" data-id="${esc(p.id)}">
      <div class="ad-row__thumb">${thumb}</div>
      <div class="ad-row__main">
        <h3>${esc(p.name)}</h3>
        <div class="ad-row__meta"><span>${esc(p.id)}</span><span>·</span><span>${esc(CATS[p.category] || p.category)}</span></div>
        <div class="ad-row__price">
          <strong>${INR(p.price)}</strong>
          ${p.oldPrice ? `<s>${INR(p.oldPrice)}</s>` : ''}
          ${p.usd ? `<em>${USD(p.usd)}</em>` : ''}
        </div>
        <div class="ad-row__dur">${esc(p.duration || 'Instant delivery')}</div>
      </div>
      <div class="ad-row__state">
        <span class="ad-pill${live ? '' : ' ad-pill--off'}">${live ? 'LIVE' : 'HIDDEN'}</span>
        <button class="ad-toggle" data-act="toggle" data-id="${esc(p.id)}">${live ? 'HIDE FROM SHOP' : 'MAKE LIVE'}</button>
      </div>
      <div class="ad-row__actions">
        <button class="ad-act" data-act="edit" data-id="${esc(p.id)}">EDIT</button>
        <button class="ad-act ad-act--del" data-act="delete" data-id="${esc(p.id)}">DELETE</button>
      </div>
    </article>`;
  }

  listEl.addEventListener('click', async e => {
    const btn = e.target.closest('[data-act]');
    if (!btn || busy) return;
    const p = products.find(x => x.id === btn.dataset.id);
    if (!p) return;

    if (btn.dataset.act === 'edit') { openDrawer(p); return; }

    if (btn.dataset.act === 'toggle') {
      busy = true;
      try {
        await api('/api/products/' + encodeURIComponent(p.id), {
          method: 'PUT',
          body: JSON.stringify({ ...p, available: p.available === false })
        });
        await loadProducts();
        toast(p.available === false ? 'PRODUCT IS LIVE' : 'PRODUCT HIDDEN');
      } catch (err) { toast(err.message, true); }
      finally { busy = false; }
      return;
    }

    if (btn.dataset.act === 'delete') {
      if (!confirm(`Delete “${p.name}” (${p.id})?\n\nThis cannot be undone.`)) return;
      busy = true;
      try {
        await api('/api/products/' + encodeURIComponent(p.id), { method: 'DELETE' });
        await loadProducts();
        toast('PRODUCT DELETED');
      } catch (err) { toast(err.message, true); }
      finally { busy = false; }
    }
  });

  searchEl.addEventListener('input', renderList);
  $('#addBtn').addEventListener('click', () => openDrawer(null));
  $('#addEmpty').addEventListener('click', () => openDrawer(null));

  /* ------------------------------------------------------------
     DRAWER
     ------------------------------------------------------------ */
  function openDrawer(p) {
    editingId = p ? p.id : null;
    imageUrl = p?.image || '';
    form.reset();
    formError.textContent = '';

    drawerTitle.textContent = p ? 'EDIT PRODUCT' : 'ADD PRODUCT';
    drawerKicker.textContent = p ? `EDITING / ${p.id}` : 'NEW LISTING';

    if (p) {
      const f = form.elements;
      f.name.value = p.name || '';
      f.id.value = p.id || '';
      f.category.value = p.category || 'discord';
      f.price.value = p.price ?? '';
      f.oldPrice.value = p.oldPrice ?? '';
      f.usd.value = p.usd ?? '';
      f.oldUsd.value = p.oldUsd ?? '';
      f.duration.value = p.duration || '';
      f.description.value = p.description || '';
      f.art.value = p.art || 'generic';
      f.tone.value = p.tone || '#2a1742';
      f.available.checked = p.available !== false;
    } else {
      form.elements.available.checked = true;
      form.elements.art.value = 'generic';
      form.elements.tone.value = '#2a1742';
    }

    renderPreview();
    imgFile.value = '';

    drawer.hidden = false;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    let painted = false;
    const paint = () => { if (painted) return; painted = true; drawer.classList.add('is-open'); };
    requestAnimationFrame(paint);
    setTimeout(paint, 60);
    setTimeout(() => form.elements.name.focus(), 220);
  }

  function closeDrawer(instant = false) {
    if (drawer.hidden) return;
    drawer.classList.remove('is-open');
    overlay.hidden = true;
    document.body.style.overflow = '';
    const finish = () => { if (!drawer.classList.contains('is-open')) drawer.hidden = true; };
    instant ? finish() : setTimeout(finish, 520);
    editingId = null;
    imageUrl = '';
  }

  $('#drawerClose').addEventListener('click', () => closeDrawer());
  $('#drawerCancel').addEventListener('click', () => closeDrawer());
  overlay.addEventListener('click', () => closeDrawer());
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !drawer.hidden) closeDrawer();
  });

  /* ------------------------------------------------------------
     CUSTOMERS
     ------------------------------------------------------------ */
  const orderStatus = s => {
    const v = String(s || 'pending');
    return ['pending', 'processing', 'completed', 'cancelled'].includes(v) ? v : 'pending';
  };
  const orderStatusLabel = s => {
    const v = orderStatus(s);
    return v.charAt(0).toUpperCase() + v.slice(1);
  };

  function customerRowHTML(c) {
    const status = c.status === 'suspended' ? 'suspended' : 'active';
    return `<article class="ad-cust" data-cust-id="${esc(c.id)}">
      <div class="ad-cust__avatar">
        <img src="${esc(c.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer">
      </div>
      <div class="ad-cust__main">
        <h3>${esc(c.displayName || c.username)}</h3>
        <div class="ad-cust__meta">@${esc(c.username)} <span>·</span> ${esc(c.id)}</div>
        <div class="ad-cust__id">DISCORD ID ${esc(c.discordId)}</div>
      </div>
      <div class="ad-cust__dates">
        <div><span>REGISTERED</span><b>${esc(fmtDate(c.createdAt))}</b></div>
        <div><span>LAST LOGIN</span><b>${esc(fmtDateTime(c.lastLoginAt))}</b></div>
      </div>
      <div class="ad-cust__stats">
        <div><strong>${pad2(c.totalOrders)}</strong><span>ORDERS</span></div>
        <span class="ad-pill${status === 'suspended' ? ' ad-pill--suspended' : ''}">${status.toUpperCase()}</span>
      </div>
      <div class="ad-row__actions">
        <button class="ad-act" type="button" data-cust-view="${esc(c.id)}">VIEW →</button>
      </div>
    </article>`;
  }

  function renderCustomers(data) {
    const list = Array.isArray(data.customers) ? data.customers : [];
    customers = list;

    $('#custCount').textContent = pad2(list.length);
    $('#custTabCount').textContent = pad2(data.total);
    $('#custStatTotal').textContent = pad2(data.total);
    $('#custStatActive').textContent = pad2(data.active);
    $('#custStatSuspended').textContent = pad2(data.suspended);
    $('#custStatOrders').textContent = pad2(list.reduce((n, c) => n + (Number(c.totalOrders) || 0), 0));

    custListEl.innerHTML = list.map(customerRowHTML).join('');
    custEmptyEl.hidden = list.length > 0;
  }

  async function loadCustomers() {
    const params = new URLSearchParams();
    const q = custSearchEl.value.trim();
    if (q) params.set('q', q);
    if (custSortEl.value) params.set('sort', custSortEl.value);
    if (custStatusEl.value && custStatusEl.value !== 'all') params.set('status', custStatusEl.value);

    try {
      const data = await api('/api/admin/customers' + (params.toString() ? '?' + params : ''));
      renderCustomers(data);
    } catch (err) {
      if (err.message !== 'SESSION EXPIRED — SIGN IN AGAIN') toast(err.message.toUpperCase(), true);
    }
  }

  async function openCustomer(id) {
    if (!id) return;
    closeDrawer(true);
    custDrawer.hidden = false;
    custOverlay.hidden = false;
    custDetail.innerHTML = '<p class="ad-cust-none">LOADING CUSTOMER…</p>';
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => custDrawer.classList.add('is-open'));

    try {
      const data = await api('/api/admin/customers/' + encodeURIComponent(id));
      activeCustomer = data.customer;
      renderCustomerDetail(data);
    } catch (err) {
      custDetail.innerHTML = `<p class="ad-cust-none">${esc(String(err.message || 'COULD NOT LOAD CUSTOMER').toUpperCase())}</p>`;
    }
  }

  function closeCustomer(instant = false) {
    if (custDrawer.hidden) return;
    custDrawer.classList.remove('is-open');
    custOverlay.hidden = true;
    document.body.style.overflow = '';
    const finish = () => { if (!custDrawer.classList.contains('is-open')) custDrawer.hidden = true; };
    instant ? finish() : setTimeout(finish, 520);
    activeCustomer = null;
  }

  function renderCustomerDetail(data) {
    const c = data.customer;
    const history = Array.isArray(data.orders) ? data.orders : [];
    const logins = Array.isArray(data.recentLogins) ? data.recentLogins : [];
    const status = c.status === 'suspended' ? 'suspended' : 'active';
    const accent = c.accent || '#a855f7';

    custDrawerKicker.textContent = `CUSTOMER / ${c.id}`;
    custDrawerTitle.textContent = c.displayName || c.username;

    const bannerStyle = c.banner
      ? ` style="background-image:linear-gradient(180deg,rgba(11,6,20,.2),rgba(30,16,50,.88)),url(&quot;${esc(c.banner)}&quot;)"`
      : '';

    const fact = (label, value, accentValue = false) =>
      `<div class="ad-cust-fact"><span>${label}</span><b${accentValue ? ` style="color:${esc(accent)}"` : ''}>${esc(value)}</b></div>`;

    const orderHTML = history.length
      ? history.map(o => {
        const st = orderStatus(o.status);
        return `<div class="ad-cust-order">
          <div class="ad-cust-order__main">
            <span class="ad-cust-order__id">${esc(o.id)}</span>
            <h4>${esc(o.productName || 'Z MART ORDER')}</h4>
            <span class="ad-cust-order__date">${esc(fmtDateTime(o.createdAt))}</span>
          </div>
          <div class="ad-cust-order__side">
            <strong>${esc(INR(o.price))}</strong>
            <span class="ad-cust-status ad-cust-status--${st}">${esc(orderStatusLabel(st))}</span>
          </div>
        </div>`;
      }).join('')
      : '<p class="ad-cust-none">NO ORDERS RECORDED FOR THIS CUSTOMER.</p>';

    const loginHTML = logins.length
      ? logins.map(iso => `<div class="ad-cust-login"><span>SUCCESSFUL LOGIN</span><b>${esc(fmtDateTime(iso))}</b></div>`).join('')
      : '<p class="ad-cust-none">NO LOGIN RECORDS YET.</p>';

    custDetail.innerHTML = `
      <div class="ad-cust-banner"${bannerStyle}>
        <span>Z MART / CUSTOMER FILE</span>
        <span class="ad-pill${status === 'suspended' ? ' ad-pill--suspended' : ''}">${status.toUpperCase()}</span>
      </div>

      <div class="ad-cust-identity">
        <div class="ad-cust-identity__avatar"><img src="${esc(c.avatar)}" alt="" referrerpolicy="no-referrer"></div>
        <div class="ad-cust-identity__main">
          <h3>${esc(c.displayName || c.username)}</h3>
          <p>@${esc(c.username)} · ${esc(c.id)}</p>
          <span class="ad-cust-verified"><i></i>DISCORD VERIFIED</span>
        </div>
      </div>

      <section class="ad-cust-sec">
        <h3>PROFILE <span>FULL RECORD</span></h3>
        <div class="ad-cust-facts">
          ${fact('Customer ID', c.id, true)}
          ${fact('Discord user ID', c.discordId)}
          ${fact('Discord username', '@' + c.username)}
          ${fact('Display name', c.displayName || c.username)}
          ${fact('Registered', fmtDate(c.createdAt))}
          ${fact('Last updated', fmtDateTime(c.updatedAt))}
          ${fact('Last login', fmtDateTime(c.lastLoginAt))}
          ${fact('Login count', c.loginCount)}
          ${fact('Total orders', c.totalOrders)}
          ${fact('Completed orders', c.completedOrders)}
          ${fact('Custom avatar', c.avatarCustom ? 'UPLOADED' : 'DISCORD DEFAULT')}
          ${fact('Custom banner', c.banner ? 'UPLOADED' : 'NONE')}
          ${fact('Accent colour', accent, true)}
          ${fact('Status', status.toUpperCase())}
        </div>
        <div class="ad-cust-bio">
          <span>BIO / ABOUT ME</span>
          <p>${c.bio ? esc(c.bio) : 'NO BIO PROVIDED.'}</p>
        </div>
        <div class="ad-cust-actions">
          <button class="btn ${status === 'suspended' ? 'btn--orange' : 'btn--ghost'}" type="button" data-cust-status="${status === 'suspended' ? 'active' : 'suspended'}">
            ${status === 'suspended' ? 'REACTIVATE ACCOUNT' : 'SUSPEND ACCOUNT'}
          </button>
        </div>
      </section>

      <section class="ad-cust-sec">
        <h3>ORDER HISTORY <span>${pad2(history.length)}</span></h3>
        <div class="ad-cust-orders">${orderHTML}</div>
      </section>

      <section class="ad-cust-sec">
        <h3>LOGIN ACTIVITY <span>${pad2(c.loginCount)}</span></h3>
        <p class="ad-cust-note">Dates only — no passwords, OAuth tokens or device fingerprints are stored.</p>
        <div class="ad-cust-logins">${loginHTML}</div>
      </section>`;
  }

  custListEl.addEventListener('click', e => {
    const button = e.target.closest('[data-cust-view]');
    const row = e.target.closest('.ad-cust');
    const id = button ? button.dataset.custView : row ? row.dataset.custId : '';
    if (id) openCustomer(id);
  });

  custSearchEl.addEventListener('input', () => {
    clearTimeout(custSearchTimer);
    custSearchTimer = setTimeout(loadCustomers, 220);
  });
  custSortEl.addEventListener('change', loadCustomers);
  custStatusEl.addEventListener('change', loadCustomers);

  $('#custDrawerClose').addEventListener('click', () => closeCustomer());
  custOverlay.addEventListener('click', () => closeCustomer());
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !custDrawer.hidden) closeCustomer();
  });

  custDetail.addEventListener('click', async e => {
    const btn = e.target.closest('[data-cust-status]');
    if (!btn || custBusy || !activeCustomer) return;
    const next = btn.dataset.custStatus;
    const label = activeCustomer.displayName || activeCustomer.username;
    if (next === 'suspended' && !confirm(`Suspend “${label}”?\n\nTheir active customer sessions will be ended immediately.`)) return;

    custBusy = true;
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = next === 'suspended' ? 'SUSPENDING…' : 'REACTIVATING…';

    try {
      await api('/api/admin/customers/' + encodeURIComponent(activeCustomer.id), {
        method: 'PUT',
        body: JSON.stringify({ status: next })
      });
      const data = await api('/api/admin/customers/' + encodeURIComponent(activeCustomer.id));
      activeCustomer = data.customer;
      renderCustomerDetail(data);
      await loadCustomers();
      toast(next === 'suspended' ? 'CUSTOMER SUSPENDED' : 'CUSTOMER REACTIVATED');
    } catch (err) {
      btn.disabled = false;
      btn.textContent = original;
      if (err.message !== 'SESSION EXPIRED — SIGN IN AGAIN') toast(err.message.toUpperCase(), true);
    } finally {
      custBusy = false;
    }
  });

  /* ------------------------------------------------------------
     IMAGE UPLOAD
     ------------------------------------------------------------ */
  function renderPreview() {
    imgPreview.innerHTML = imageUrl
      ? `<img src="${esc(imageUrl)}" alt="Product preview">`
      : '<span>NO IMAGE<br>FALLBACK ART</span>';
  }

  $('#imgClear').addEventListener('click', () => {
    imageUrl = '';
    imgFile.value = '';
    renderPreview();
  });

  imgFile.addEventListener('change', async () => {
    const file = imgFile.files && imgFile.files[0];
    if (!file) return;
    formError.textContent = '';

    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      formError.textContent = 'USE A PNG, JPG OR WEBP IMAGE.';
      imgFile.value = '';
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      formError.textContent = 'IMAGE TOO LARGE — MAX 8 MB.';
      imgFile.value = '';
      return;
    }

    imgPreview.innerHTML = '<span>UPLOADING…</span>';
    try {
      const dataUrl = await resizeImage(file, 1000);
      const data = await api('/api/upload', { method: 'POST', body: JSON.stringify({ dataUrl }) });
      imageUrl = data.url;
      renderPreview();
      toast('IMAGE UPLOADED');
    } catch (err) {
      formError.textContent = err.message.toUpperCase();
      imgFile.value = '';
      renderPreview();
    }
  });

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
          let out = canvas.toDataURL('image/webp', 0.86);
          if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/jpeg', 0.86);
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

  /* ------------------------------------------------------------
     SAVE
     ------------------------------------------------------------ */
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (busy) return;
    formError.textContent = '';

    const f = form.elements;
    const payload = {
      id: String(f.id.value || '').trim().toUpperCase(),
      name: String(f.name.value || '').trim(),
      category: f.category.value,
      price: f.price.value === '' ? null : Number(f.price.value),
      oldPrice: f.oldPrice.value === '' ? null : Number(f.oldPrice.value),
      usd: f.usd.value === '' ? null : Number(f.usd.value),
      oldUsd: f.oldUsd.value === '' ? null : Number(f.oldUsd.value),
      duration: String(f.duration.value || '').trim(),
      description: String(f.description.value || '').trim(),
      image: imageUrl,
      art: f.art.value,
      tone: f.tone.value,
      available: f.available.checked
    };

    if (!payload.name) { formError.textContent = 'PRODUCT NAME IS REQUIRED.'; f.name.focus(); return; }
    if (!/^[A-Z0-9][A-Z0-9._-]{1,39}$/.test(payload.id)) {
      formError.textContent = 'PRODUCT ID: 2–40 CHARACTERS — A–Z, 0–9, . _ -';
      f.id.focus();
      return;
    }
    if (payload.price === null || Number.isNaN(payload.price) || payload.price < 0) {
      formError.textContent = 'ENTER A VALID INR PRICE.';
      f.price.focus();
      return;
    }
    if (!payload.description) { formError.textContent = 'DESCRIPTION IS REQUIRED.'; f.description.focus(); return; }

    busy = true;
    saveBtn.disabled = true;
    const label = saveBtn.textContent;
    saveBtn.textContent = 'SAVING…';

    try {
      if (editingId) {
        await api('/api/products/' + encodeURIComponent(editingId), {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await api('/api/products', { method: 'POST', body: JSON.stringify(payload) });
      }
      closeDrawer();
      await loadProducts();
      toast('PRODUCT SAVED — LIVE ON THE STOREFRONT');
    } catch (err) {
      formError.textContent = err.message.toUpperCase();
    } finally {
      busy = false;
      saveBtn.disabled = false;
      saveBtn.textContent = label;
    }
  });

  boot();
})();
