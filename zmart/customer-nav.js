/* ============================================================
   Z MART® — shared customer navbar auth
   Renders LOGIN WITH DISCORD when signed out, avatar dropdown
   when signed in. Used by the storefront + profile page.
   ============================================================ */
(() => {
  'use strict';

  const desktop = document.querySelector('[data-auth-nav]');
  const mobile = document.querySelector('[data-auth-mobile]');
  if (!desktop && !mobile) return;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const DISCORD_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>';

  const loginHTML = `<a class="auth-nav__login" href="/auth/discord/customer" title="Sign in with Discord">${DISCORD_ICON}<span>LOGIN WITH DISCORD</span></a>`;

  let customer = null;
  let menuOpen = false;

  function signedInHTML(c) {
    const name = esc(c.displayName || c.username || 'PROFILE');
    const avatar = esc(c.avatar || '');
    return `
      <button class="auth-nav__trigger" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Open account menu">
        <img class="auth-nav__avatar" src="${avatar}" alt="" width="28" height="28" referrerpolicy="no-referrer">
        <span class="auth-nav__name">${name}</span>
        <span aria-hidden="true">▾</span>
      </button>
      <div class="auth-nav__menu" role="menu" hidden>
        <a role="menuitem" href="/profile#profile">MY PROFILE <span>01</span></a>
        <a role="menuitem" href="/profile#orders">MY ORDERS <span>02</span></a>
        <a role="menuitem" href="/profile#settings">ACCOUNT SETTINGS <span>03</span></a>
        <button role="menuitem" type="button" data-auth-logout>LOGOUT <span>✕</span></button>
      </div>`;
  }

  function mobileHTML(c) {
    const name = esc(c.displayName || c.username || 'PROFILE');
    const handle = esc(c.username || '');
    return `
      <a href="/profile#profile" data-close-menu>
        <img src="${esc(c.avatar || '')}" alt="" width="26" height="26" referrerpolicy="no-referrer">
        <span>${name}<br><small style="opacity:.45">@${handle}</small></span>
      </a>
      <a href="/profile#orders" data-close-menu>MY ORDERS</a>
      <a href="/profile#settings" data-close-menu>ACCOUNT SETTINGS</a>
      <button type="button" data-auth-logout>LOGOUT</button>`;
  }

  function closeMenu() {
    if (!desktop) return;
    menuOpen = false;
    const trigger = desktop.querySelector('.auth-nav__trigger');
    const menu = desktop.querySelector('.auth-nav__menu');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    if (menu) menu.hidden = true;
  }

  function bindDesktop() {
    if (!desktop) return;
    const trigger = desktop.querySelector('.auth-nav__trigger');
    const menu = desktop.querySelector('.auth-nav__menu');
    if (!trigger || !menu) return;

    trigger.addEventListener('click', e => {
      e.stopPropagation();
      menuOpen = !menuOpen;
      menu.hidden = !menuOpen;
      trigger.setAttribute('aria-expanded', String(menuOpen));
    });

    desktop.addEventListener('click', e => {
      if (e.target.closest('[data-auth-logout]')) logout();
      else if (e.target.closest('.auth-nav__menu a')) closeMenu();
    });

    document.addEventListener('click', e => {
      if (menuOpen && !desktop.contains(e.target)) closeMenu();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && menuOpen) {
        closeMenu();
        trigger.focus();
      }
    });
  }

  function bindMobile() {
    if (!mobile) return;
    mobile.addEventListener('click', e => {
      if (e.target.closest('[data-auth-logout]')) { logout(); return; }
      if (e.target.closest('[data-close-menu]') && window.ZMcloseMenu) window.ZMcloseMenu();
    });
  }

  async function logout() {
    closeMenu();
    try {
      await fetch('/api/customer/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: '{}'
      });
    } catch {}
    location.href = '/';
  }

  function render() {
    if (desktop) {
      desktop.innerHTML = customer ? signedInHTML(customer) : loginHTML;
      bindDesktop();
    }
    if (mobile) {
      mobile.innerHTML = customer
        ? mobileHTML(customer)
        : `<a class="auth-nav__login" href="/auth/discord/customer">${DISCORD_ICON}<span>LOGIN WITH DISCORD</span></a>`;
      bindMobile();
    }
  }

  fetch('/api/customer/session', {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    credentials: 'same-origin'
  })
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      if (!data) return; // share view / API unavailable — keep auth UI hidden
      customer = data.authenticated ? data.customer : null;
      render();
    })
    .catch(() => {});
})();
