# Z MART® — digital products marketplace

A premium, animated storefront for digital goods (Discord services, gaming accounts, AI subscriptions,
software) with a **password-protected admin** for managing the catalogue and **Discord buyer accounts**
for profiles, order history and account settings.

The design keeps the original retro-futuristic HUD language with a premium purple-and-black palette:
textured deep-purple background `#160b25`, neon-purple accents `#a855f7`, purple buttons `#7c3aed`,
subtle purple borders `#593477`, outlined display type, circular stage elements, a CSS-3D hero cube,
and cinematic scroll motion. No UI framework, no build step, no npm dependencies.

---

## Run it

```bash
cd zmart
npm start          # or: node server.js
```

- Storefront → <http://127.0.0.1:4173/>
- Admin → <http://127.0.0.1:4173/admin>

Add `?nopreload` to skip the intro loader while developing.

### Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4173` | HTTP port |
| `HOST` | `127.0.0.1` | Bind address (use `0.0.0.0` to expose on a LAN/VPS) |
| `ADMIN_USER` | `zmart` | Admin username override |
| `ADMIN_PASSWORD` | generated | Admin password override |
| `DISCORD_CLIENT_ID` | — | Discord app client ID |
| `DISCORD_CLIENT_SECRET` | — | Discord app client secret |
| `DISCORD_REDIRECT_URI` | — | Must match the Discord app redirect exactly |
| `ADMIN_DISCORD_ID` | — | Discord user ID allowed into the admin |
| `ZM_DATA_DIR` | `./data` | Optional data directory override (useful for isolated tests) |
| `ZM_UPLOAD_DIR` | `./uploads` | Optional upload directory override (useful for isolated tests) |

```bash
# Windows PowerShell
$env:ADMIN_PASSWORD="a-long-private-password"; node server.js

# bash
ADMIN_PASSWORD="a-long-private-password" node server.js
```

### Admin credentials

On first boot the server generates a random 14-character password and writes it to
`data/ADMIN-LOGIN.txt` (also printed once in the console). Only a scrypt hash + salt is stored in
`data/auth.json` — **the plaintext password never reaches the browser**.

- Change the password: set `ADMIN_PASSWORD` and restart, or delete `data/auth.json` and restart
  (a new password is generated).
- Delete `data/ADMIN-LOGIN.txt` once you have saved the password somewhere safe.

### Discord owner login

The admin can also be unlocked with a Discord account. The browser is sent to Discord, then the
server verifies the returned profile and compares **only the Discord user ID** with
`ADMIN_DISCORD_ID`. No other profile data is stored. The password login above keeps working as a
fallback.

1. Create an application at <https://discord.com/developers/applications>.
2. Open **OAuth2**, add this exact redirect: `http://localhost:4173/auth/discord/callback`
   (add your public HTTPS URL too if you will use a domain).
3. Copy `.env.example` to `.env` and fill in the values:

   ```
   DISCORD_CLIENT_ID=YOUR_CLIENT_ID
   DISCORD_CLIENT_SECRET=YOUR_CLIENT_SECRET
   DISCORD_REDIRECT_URI=http://localhost:4173/auth/discord/callback
   ADMIN_DISCORD_ID=YOUR_DISCORD_USER_ID
   ```

4. Restart the server. A **CONTINUE WITH DISCORD** button appears on `/admin`.

`.env` is read on boot, is never served over HTTP, and is listed in `.gitignore`. Real environment
variables always take precedence over the file, so a host can inject secrets instead.

Your Discord user ID: enable **Settings → Advanced → Developer Mode**, then right-click your
profile and choose **Copy User ID**. Only that ID is allowed in; any other account is rejected.

The client secret, OAuth state cookie and session stay server-side (HttpOnly). `.env` is blocked from
static serving just like `data/`.

### Discord buyer login

Normal customers sign in from **LOGIN WITH DISCORD** in the storefront navbar, or from `/profile`.
This reuses the same Discord application and callback as the owner login, but runs a separate flow:

- Start URL: `/auth/discord/customer`; callback: `/auth/discord/callback` (already registered).
- Only the `identify` scope is requested. The server exchanges the code, reads the public profile, and
  immediately discards the access token. No token or password is stored or sent to the browser.
- First login creates `data/customers.json` record `ZM-00001`, `ZM-00002`, …; returning users are matched
  by the unique Discord user ID. Usernames, display names, avatars and avatars hashes are refreshed.
- The buyer session uses a separate `zm_customer` HttpOnly cookie (7-day TTL), SEPARATE from the admin
  `zm_session` cookie. A customer can never use their session on an admin route.
- OAuth `state` is validated against a short-lived server record plus a separate `zm_cust_state` cookie.
- `/profile` provides My Profile, My Orders and Account Settings. Customers can only read their own
  orders; every customer API derives the customer ID from the session, never from request input.
- Admin status `active` / `suspended` is controlled only from the admin customer panel. Suspending an
  account invalidates that customer's active sessions.

Orders are read from `data/orders.json` and linked by the internal customer ID. This project does not
invent orders or implement checkout — the list stays empty until real order records exist.

---

## Managing products

Sign in at `/admin`, then:

- **+ NEW PRODUCT** — name, ID, category, INR price, old INR price, USD price, old USD price,
  duration/warranty, description, image, fallback illustration, card tone, availability.
- **EDIT** — change any field, including the product ID.
- **HIDE FROM SHOP / MAKE LIVE** — hides a product from the storefront without deleting it.
- **DELETE** — removes the product and its uploaded image.
- **SEARCH** — filter the admin list by name or product ID.

Saved changes appear on the storefront on the next page load. The storefront reads the live catalogue
from `GET /api/products`, so nothing is hardcoded in the page — new products appear automatically and
counts on the category filters update themselves.

Images are resized in the browser to max 1000 px and uploaded as WEBP/JPEG; if no image is uploaded,
the selected fallback SVG illustration is used.

### Storage

```
data/products.json     live catalogue (the only source of truth)
data/auth.json         admin username + scrypt hash/salt
data/customers.json    buyer profiles + login timestamps (created on first login)
data/orders.json       order records linked to customer IDs (empty until real orders exist)
.env                   Discord OAuth + owner ID (never served, never committed)
data/ADMIN-LOGIN.txt   one-time plaintext credentials (delete after saving)
uploads/               product images + customer avatars/banners (served at /uploads/<file>)
```

Both `data/` and `server.js` are blocked from static serving. There is no path traversal: requests are
resolved against the project root and rejected otherwise. Customer JSON never contains OAuth tokens,
passwords or device fingerprints — only the profile, timestamps and successful-login dates.

---

## API

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/products` | — | Available products only |
| `GET` | `/api/products?all=1` | session | Includes hidden products |
| `POST` | `/api/products` | session | Create |
| `PUT` | `/api/products/:id` | session | Update (ID may change) |
| `DELETE` | `/api/products/:id` | session | Delete |
| `POST` | `/api/upload` | session | `{ dataUrl }` → `{ url }` |
| `GET` | `/api/session` | — | `{ authenticated }` for the admin |
| `POST` | `/api/login` | — | `{ user, password }` → admin session cookie |
| `POST` | `/api/logout` | — | Clears the admin session |
| `GET` | `/api/customer/session` | customer | `{ authenticated, customer? }` |
| `POST` | `/api/customer/logout` | customer | Clears the buyer session |
| `GET` | `/api/customer/profile` | customer | Own profile only |
| `PUT` | `/api/customer/profile` | customer | Validated display name, bio, accent, avatar/banner paths |
| `POST` | `/api/customer/upload` | customer | `{ kind, dataUrl }` → `{ url }` (avatar 2 MB / banner 5 MB, magic-byte checked) |
| `GET` | `/api/customer/orders` | customer | Own orders only |
| `GET` | `/api/customer/orders/:id` | customer | Own order detail only |
| `GET` | `/api/admin/customers` | admin | Search `q`, `sort=newest\|recent\|oldest`, `status=active\|suspended` |
| `GET` | `/api/admin/customers/:id` | admin | Full profile + order history + recent login dates |
| `PUT` | `/api/admin/customers/:id` | admin | `{ status: "active"\|"suspended" }` |

Unauthenticated admin calls return `401`; a customer session cannot read or write admin endpoints.
Customer endpoints derive identity from the `zm_customer` session and return `401` without it. Admin
customer-management endpoints require the existing admin session.

### Security notes

- Credentials are verified server-side with `scrypt` + per-install salt and timing-safe comparison.
- Admin sessions are random 32-byte tokens in an in-memory map, sent as `HttpOnly; SameSite=Strict`
  cookies (8-hour TTL). Buyer sessions use a separate in-memory map and `zm_customer` HttpOnly,
  `SameSite=Lax` cookie (7-day TTL). Both reset when the server restarts, and both use `Secure` cookies
  automatically when the request is HTTPS.
- Login is throttled after 6 failed attempts per IP (10-minute lockout).
- State-changing requests must come from the same host (`Origin` check).
- Security headers: `X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`.
- HTML/JS/CSS are served `no-cache`; assets are asset-versioned with `?v=5` query strings.

For a public deployment, put this behind HTTPS (Caddy/nginx) and set a strong `ADMIN_PASSWORD`.
The session store is in-memory, so run a single instance (or add a shared session store before scaling).

---

## Project layout

```
zmart/
├── server.js      zero-dependency HTTP server: static hosting, API, auth, uploads
├── index.html     storefront markup
├── styles.css     theme, hero cube, cards, PDP, cart, responsive rules
├── app.js         catalogue loading, SVG artwork, cards, filters, PDP, cart
├── admin.html     admin shell (login + product + customer management)
├── admin.css      admin styling (inherits theme tokens)
├── admin.js       session handling, product CRUD, customer directory, image resize/upload
├── profile.html   buyer dashboard (profile, orders, account settings, edit drawer)
├── profile.css    profile/dashboard styling + shared navbar auth
├── profile.js     buyer dashboard logic, live profile preview, safe uploads
├── customer-nav.js shared LOGIN WITH DISCORD / avatar dropdown navbar component
├── data/          JSON storage (do not delete products.json once live)
└── uploads/       product images + customer avatars/banners
```

Everything is vanilla HTML/CSS/JS. Product artwork is inline SVG (no image requests), and all animation
is CSS/`requestAnimationFrame` — no Three.js, no bundler.

---

## Notes

- Checkout is a demo toast. Wire Razorpay/Stripe into the `#checkout` handler in `app.js` to go live.
- Buyer order history is read-only from `data/orders.json`; no fake orders or fake checkout are created.
  Real order records must link `customerId` to the internal `ZM-#####` ID.
- Prices are shown in INR everywhere, plus USD on the products where a USD price exists.
- Old prices are only shown when supplied, and are auto-cleared if they are not above the current price.
- Cart state persists in `localStorage` (`zmart-cart-v2`).
