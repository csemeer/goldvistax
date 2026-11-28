# Environment Variables — Relevance & Step-by-Step Setup Guide
**Document Reference:** `docs/operations/ENVIRONMENT_VARIABLES_SETUP_GUIDE.md`  
**Application:** GOLDVISTA v1.6.0 / Aurum Intelligence  
**Updated Date:** November 15, 2026  
**Source References:** `.env.example`, `server.ts`, `serverSecurity.ts`, `src/services/commodityFundamentalsEngine.ts`, `src/services/marketDataProvider.ts`, `src/services/notificationService.ts`, `src/db/postgresRepositories.ts`, `migrations/`

---

## 1. Overview & Configuration Rules

Aurum Intelligence / GOLDVISTA loads environment variables at module initialization via `import 'dotenv/config'` (`server.ts`) and reads `process.env` across the Express API gateway, security middleware, macro engines, and persistence adapters.

### Critical Operational Rules
1. **Never commit `.env` or real secrets to Git:** Only `.env.example` belongs in source control (`.env*` is gitignored). Store production secrets in your hosting platform's secret manager (e.g., Google Cloud Secret Manager, Cloud Run environment variables, AI Studio Secrets panel, or AWS Secrets Manager).
2. **Startup Hydration & Runtime Workspace Configuration:**
   - All **22 listed variables** (plus companion platform variables) are read from `process.env` at startup or request time (`buildEnvHydrationConfigs` in `serverSecurity.ts` automatically hydrates `MARKET_DATA_*`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and `WEBHOOK_URL` on boot while ignoring unreplaced template placeholders).
   - In addition, `PRO`/`ALPHA` users can inspect or override Market Data and Notification settings live without restarting via the **Market Data Config** / **Notification Settings** UI workspaces (`POST /api/market-data/config` and `POST /api/notifications/config`).
3. **Top-Level Store Path Timing (`*_STORE_PATH`):** `server.ts` imports `dotenv/config` as its first statement so `AURUM_BILLING_STORE_PATH`, `AURUM_FORECAST_STORE_PATH`, `AURUM_JOURNAL_STORE_PATH`, and `AURUM_SESSION_SECRET` resolve from `.env` before server services initialize.

---

## 2. Complete Variable Reference Matrix

| Variable | Category | Required In Prod | Default / Fallback | Enforcement Mode | Core Relevance |
| --- | --- | --- | --- | --- | --- |
| `MARKET_DATA_PRIMARY_PROVIDER` | Market Data | Recommended | `yahoo_finance` | Boot `process.env` + `/api/market-data/config` | Selects primary real-time/delayed price source |
| `MARKET_DATA_FALLBACK_PROVIDER` | Market Data | Recommended | `simulated_reference` | Boot `process.env` + `/api/market-data/config` | Controls failover source when primary fails |
| `MARKET_DATA_MAX_STALE_SECONDS` | Market Data | Yes | `60` | Boot `process.env` + `/api/market-data/config` | Enforces freshness gate (`QUALITY_HOLD` abstention) |
| `MARKET_DATA_POLL_INTERVAL_SECONDS` | Market Data | Recommended | `15` | Boot `process.env` + `/api/market-data/config` | Sets UI/router quote polling cadence |
| `WEBHOOK_URL` | Alerting | Optional | `""` (disabled) | Boot `process.env` + `/api/notifications/config` | Sends alert embeds/JSON webhooks to Discord/Slack/Ops |
| `STRIPE_WEBHOOK_SECRET` | Billing Security | **Yes** | Unset (sandbox bypass in dev only) | Active `process.env` | Verifies Stripe HMAC-SHA256 webhook signatures |
| `AURUM_BILLING_STORE_PATH` | Billing Storage | Only if not using Postgres | `/tmp/aurum-billing-store.json` | Active `process.env` (top-level) | Atomic JSON store path for billing & credit ledger |
| `EIA_API_KEY` | Macro Data | Optional (Recommended) | Curated baseline fallback | Active `process.env` | Live US EIA petroleum inventory & balance feeds |
| `FRED_API_KEY` | Macro Data | Optional (Recommended) | Public FRED CSV fallback | Active `process.env` | St. Louis FRED `DFII10` TIPS real-yield macro data |
| `AURUM_SESSION_SECRET` | Auth Security | **Yes** | Ephemeral per-PID dev secret | Active `process.env` | HMAC-SHA256 signing key for `aurum_v1` sessions |
| `ALLOW_SANDBOX_PERSONAS` | Auth Security | **Yes (`false`)** | `false` in prod / `true` in dev | Active `process.env` | Disables unauthenticated demo tier switching in prod |
| `OAUTH_JWKS_URI` | OIDC / PKCE | **Yes** (for OIDC) | Unset | Active `process.env` | Public JWKS endpoint to verify OIDC JWT signatures |
| `OAUTH_ISSUER` | OIDC / PKCE | **Yes** (for OIDC) | Unset | Active `process.env` | Enforces expected `iss` claim on verified JWTs |
| `OAUTH_AUDIENCE` | OIDC / PKCE | **Yes** (for OIDC) | Unset | Active `process.env` | Enforces expected `aud` claim on verified JWTs |
| `OAUTH_AUTHORIZATION_ENDPOINT` | OIDC / PKCE | **Yes** (for OIDC) | Unset | Active `process.env` | Browser redirect URL for OAuth 2.0 PKCE login |
| `OAUTH_TOKEN_ENDPOINT` | OIDC / PKCE | **Yes** (for OIDC) | Unset | Active `process.env` | Backend token exchange endpoint (`/api/auth/oidc-exchange`) |
| `OAUTH_CLIENT_ID` | OIDC / PKCE | **Yes** (for OIDC) | Unset | Active `process.env` | Public SPA OAuth client ID sent during PKCE flow |
| `OAUTH_REDIRECT_URI` | OIDC / PKCE | **Yes** (for OIDC) | Unset | Active `process.env` | Exact registered callback URL (`/auth/callback`) |
| `DATABASE_URL` | Persistence | **Yes** (durable prod) | `FILE_SANDBOX` JSON files | Active `process.env` | PostgreSQL connection URI for ACID persistence |
| `RUN_MIGRATIONS_ON_BOOT` | Persistence | Recommended (`true`) | Runs unless `'false'` | Active `process.env` | Auto-applies `migrations/001`–`002` at server start |
| `AURUM_JOURNAL_STORE_PATH` | Journal Storage | Only if not using Postgres | `/tmp/aurum-journal-store.json` | Active `process.env` (top-level) | Atomic JSON store path for Paper Trading Journal |
| `ALLOWED_ORIGINS` | Edge Security | **Yes** | Dev allows localhost; Prod fails closed | Active `process.env` | Strict CORS allowlist for cross-origin API calls |

### Companion Runtime Variables (Also Used by `server.ts`)
| Variable | Default / Behavior | Relevance |
| --- | --- | --- |
| `GEMINI_API_KEY` | Unset (AI routes fall back gracefully) | Enables server-side `@google/genai` analysis, chat, and report synthesis (`POST /api/ai/*`) |
| `APP_URL` | Runtime host URL | Canonical deployed URL for self-referential links & callback planning |
| `NODE_ENV` | `development` | Set to `production` to enforce strict HMAC, CORS, CSP, and sandbox lockout |
| `PORT` | `3000` | Express HTTP listen port (runtime container expects `3000`) |
| `DISABLE_HMR` | `false` | Set `true` in hosted/iframe environments to disable Vite WebSocket HMR |
| `AURUM_FORECAST_STORE_PATH` | `/tmp/aurum-forecast-store.json` | Atomic JSON fallback path for immutable forecast snapshots when Postgres is off |
| `AURUM_VERBOSE_LOGS` | `false` | Set `true` to emit `INFO` structured JSON logs in addition to `WARN`/`ERROR` |
| `STRICT_FRAME_OPTIONS` | `false` | Set `true` to emit `X-Frame-Options: SAMEORIGIN` (keep unset inside AI Studio iframe) |
| `CSP_FRAME_ANCESTORS` | `'self' https://aistudio.google.com ...` | Overrides allowed iframe embedding origins in `Content-Security-Policy` |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | `""` | Telegram Bot credentials hydrated at boot & editable in Notification Settings UI |

---

## 3. Step-by-Step Creation & Setup by Subsystem

### Prerequisites (Local Setup)
1. Copy the template file in the project root:
   ```bash
   cp .env.example .env
   ```
2. Ensure `.env` is ignored by Git (verify `.env` appears in `.gitignore`; never commit `.env`).
3. When deploying to Cloud Run, Docker, or AI Studio Secrets, configure these same key-value pairs in your platform's Secret Manager / Environment Variables panel rather than baking `.env` into container images.

---

### A. Market Data Routing & Freshness Gate
- `MARKET_DATA_PRIMARY_PROVIDER`
- `MARKET_DATA_FALLBACK_PROVIDER`
- `MARKET_DATA_MAX_STALE_SECONDS`
- `MARKET_DATA_POLL_INTERVAL_SECONDS`

#### Why They Are Relevant
Aurum Intelligence enforces a **fail-closed data quality gate**. Whenever primary quote telemetry exceeds `MARKET_DATA_MAX_STALE_SECONDS` or drops into an untrusted state, advisory engines transition into `QUALITY_HOLD` and block simulated trade signals rather than issuing stale recommendations. `MARKET_DATA_PRIMARY_PROVIDER` and `MARKET_DATA_FALLBACK_PROVIDER` determine whether live Yahoo Finance commodity futures (`GC=F`, `SI=F`, `CL=F`, `BZ=F`, `NG=F`, `HG=F`, `DX-Y.NYB`) or simulated reference feeds are queried, while `MARKET_DATA_POLL_INTERVAL_SECONDS` controls refresh frequency.

#### Step-by-Step Setup
1. **Choose valid values (supported by `src/services/marketDataProvider.ts`):**
   - `MARKET_DATA_PRIMARY_PROVIDER`: Set to `"yahoo_finance"` for live/delayed public futures quotes, or `"simulated_reference"` for offline deterministic sandbox testing.
   - `MARKET_DATA_FALLBACK_PROVIDER`: Set to `"simulated_reference"` in dev/staging for continuity, or `"none"` in strict production if you prefer hard failure (`UNAVAILABLE`) over synthetic fallback.
   - `MARKET_DATA_MAX_STALE_SECONDS`: Recommended `60` (seconds). Lower to `15`–`30` for stricter freshness; avoid `< 10` unless using a low-latency paid feed.
   - `MARKET_DATA_POLL_INTERVAL_SECONDS`: Recommended `15` (seconds). Must be smaller than `MARKET_DATA_MAX_STALE_SECONDS` so polls refresh before quotes expire.
2. **Add to `.env` (for configuration parity):**
   ```dotenv
   MARKET_DATA_PRIMARY_PROVIDER="yahoo_finance"
   MARKET_DATA_FALLBACK_PROVIDER="simulated_reference"
   MARKET_DATA_MAX_STALE_SECONDS=60
   MARKET_DATA_POLL_INTERVAL_SECONDS=15
   ```
3. **Apply at runtime in the active server:**  
   Because `server.ts` initializes `DEFAULT_PROVIDER_CONFIG` in memory, verify or update live provider settings after startup:
   - **Via UI:** Sign in as `PRO` or `ALPHA`, open **Market Data Config**, adjust provider/staleness/polling values, and click **Save Configuration** (or **Test Connection**).
   - **Via API (`PRO` Bearer token required):**
     ```bash
     curl -X POST http://localhost:3000/api/market-data/config \
       -H "Authorization: Bearer <PRO_TOKEN>" \
       -H "Content-Type: application/json" \
       -d '{"primaryProvider":"yahoo_finance","fallbackProvider":"simulated_reference","maxStaleSeconds":60,"pollIntervalSeconds":15}'
     ```

---

### B. Multi-Channel Webhooks & Enterprise Billing
- `WEBHOOK_URL`
- `STRIPE_WEBHOOK_SECRET`
- `AURUM_BILLING_STORE_PATH`

#### Why They Are Relevant
- **`WEBHOOK_URL`** delivers real-time operational alerts (provider failover, stale data quality holds, high-conviction advisories) to Discord, Slack, or a generic HTTP webhook receiver signed with HMAC-SHA256 (`sha256=<hex>`).
- **`STRIPE_WEBHOOK_SECRET`** protects `POST /api/billing/webhook`. In `NODE_ENV=production` (or whenever this variable is set), `verifyStripeWebhookSignature` strictly requires a valid `Stripe-Signature` header (`t=<unix>,v1=<hmac_sha256>`) verified with timing-safe comparison within a 300-second replay window. Without it in production, billing tier upgrades fail closed (`401`).
- **`AURUM_BILLING_STORE_PATH`** specifies where atomic file persistence (`writeFile` + `rename`) stores processed Stripe event IDs (idempotency), user tier entitlements, and the double-entry credit ledger whenever `DATABASE_URL` is not configured.

#### Step-by-Step Setup

##### 1. Create `WEBHOOK_URL` (Discord, Slack, or Custom Receiver)
- **Option A — Discord:**
  1. Open your target Discord Server → **Channel Settings** → **Integrations** → **Webhooks** → **New Webhook**.
  2. Name it (e.g., `GOLDVISTA Alerts`), copy the URL (`https://discord.com/api/webhooks/<id>/<token>`).
- **Option B — Slack:**
  1. Go to `https://api.slack.com/apps` → **Create New App** → **Incoming Webhooks** → toggle **On** → **Add New Webhook to Workspace**.
  2. Select the channel and copy `https://hooks.slack.com/services/T.../B.../...`.
- **Configure:**
  1. Store in `.env`: `WEBHOOK_URL="https://discord.com/api/webhooks/..."`
  2. Activate in the app: Sign in as `PRO`/`ALPHA`, open **Notification Settings**, paste the webhook URL, select `DISCORD`/`SLACK`/`GENERIC`, save, and click **Send Test Alert** (tokens in the URL path are automatically masked in UI/GET responses).

##### 2. Create `STRIPE_WEBHOOK_SECRET`
- **For Production / Staging (Stripe Dashboard):**
  1. Log in to **Stripe Dashboard** → **Developers** → **Webhooks** → **Add endpoint**.
  2. Set **Endpoint URL** to `https://<your-domain>/api/billing/webhook`.
  3. Select billing events (e.g., `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`).
  4. Click **Add endpoint**, then reveal **Signing secret** (`whsec_...`).
  5. Set `STRIPE_WEBHOOK_SECRET="whsec_..."` in your secret manager / `.env`.
- **For Local Testing (Stripe CLI):**
  1. Install and authenticate the Stripe CLI (`stripe login`).
  2. Start forwarding to port `3000`:
     ```bash
     stripe listen --forward-to localhost:3000/api/billing/webhook
     ```
  3. Copy the printed `whsec_...` secret into `.env` as `STRIPE_WEBHOOK_SECRET="whsec_..."` and restart the server.

##### 3. Set `AURUM_BILLING_STORE_PATH`
1. Choose a writable, non-ephemeral directory (for containers without Postgres, mount a persistent volume such as `/var/lib/aurum/aurum-billing-store.json`; for local dev, `/tmp/aurum-billing-store.json` works out of the box).
2. Ensure the parent directory exists and is owned by the Node process user (`mkdir -p /var/lib/aurum && chmod 700 /var/lib/aurum`).
3. Set `AURUM_BILLING_STORE_PATH="/var/lib/aurum/aurum-billing-store.json"` (or `/tmp/aurum-billing-store.json` locally). Note that when `DATABASE_URL` connects successfully, PostgreSQL (`PostgresBillingRepository`) replaces the file store automatically.

---

### C. Macro & Commodity Fundamental Feeds
- `EIA_API_KEY`
- `FRED_API_KEY`
*(Plus `GEMINI_API_KEY` for AI Council & Institutional Reports)*

#### Why They Are Relevant
`src/services/commodityFundamentalsEngine.ts` enriches crude oil (`WTI_OIL`, `BRENT_OIL`) and precious metals (`XAUUSD`, `XAGUSD`) analysis with real macro drivers:
- **`EIA_API_KEY`** fetches live US Energy Information Administration API v2 petroleum inventory and supply/demand balances for `WTI_OIL` and `BRENT_OIL`. Without it, the engine transparently falls back to curated revision-aware baseline figures.
- **`FRED_API_KEY`** queries the St. Louis Federal Reserve JSON API for `DFII10` (10-Year Treasury Inflation-Indexed Security / TIPS real yield), a primary inverse driver for Gold (`XAUUSD`). If omitted, it attempts the public FRED CSV download before falling back to a proxy estimate.

#### Step-by-Step Setup
1. **Obtain `EIA_API_KEY` (Free):**
   - Visit `https://www.eia.gov/opendata/register.php`.
   - Submit your email address to receive an instant API key from US EIA.
   - Set `EIA_API_KEY="<your-eia-key>"`.
2. **Obtain `FRED_API_KEY` (Free):**
   - Visit `https://fredaccount.stlouisfed.org/login/secure/` and create or sign in to a FRED Research account.
   - Open **My Account** → **API Keys** → **Request API Key**, provide a brief app description (e.g., `Commodity macro real-yield telemetry`), and copy the 32-character lowercase alphanumeric key.
   - Set `FRED_API_KEY="<your-fred-key>"`.
3. **Obtain `GEMINI_API_KEY` (Required for AI Advisory & Reports):**
   - In Google AI Studio, open **Get API key** / **Secrets** and configure `GEMINI_API_KEY`. Never expose this key in `VITE_*` client variables; `server.ts` consumes it strictly server-side.

---

### D. Session Signing, Sandbox Lockout & OAuth 2.0 PKCE / OIDC
- `AURUM_SESSION_SECRET`
- `ALLOW_SANDBOX_PERSONAS`
- `OAUTH_JWKS_URI`
- `OAUTH_ISSUER`
- `OAUTH_AUDIENCE`
- `OAUTH_AUTHORIZATION_ENDPOINT`
- `OAUTH_TOKEN_ENDPOINT`
- `OAUTH_CLIENT_ID`
- `OAUTH_REDIRECT_URI`

#### Why They Are Relevant
Together, these nine variables control **authentication integrity and privilege boundaries** (`serverSecurity.ts` + `server.ts`):
- **`AURUM_SESSION_SECRET`**: Signs and verifies server-issued `aurum_v1.<payload>.<hmac>` tokens using HMAC-SHA256 (`signServerSessionToken` / `verifySignedServerToken`). If left unset, `serverSecurity.ts` generates a random ephemeral secret per process ID—meaning every server restart or horizontal replica invalidates all active sessions!
- **`ALLOW_SANDBOX_PERSONAS`**: Gates demo persona switching (`POST /api/auth/sandbox-token` and unsigned sandbox tokens). In `NODE_ENV=production`, sandbox personas are **automatically disabled unless `ALLOW_SANDBOX_PERSONAS="true"` is explicitly set**—and you must keep this `"false"` in production so users cannot self-elevate to `PRO` or `ALPHA`.
- **`OAUTH_*` (7 OIDC/PKCE variables)**: Power production RFC 7636 Authorization Code + PKCE login (`AuthModal` → `/api/auth/session-config` → IdP login → `/auth/callback` → `POST /api/auth/oidc-exchange` → RS256/ES256 JWKS verification in `verifyOidcJwtViaJwks`).

#### Step-by-Step Setup

##### 1. Generate `AURUM_SESSION_SECRET`
Run one of the following commands locally (never paste production output into docs or commits):
```bash
openssl rand -hex 32
```
Or with Node.js:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Set the resulting 64-character hex string:
```dotenv
AURUM_SESSION_SECRET="<64-hex-characters>"
```

##### 2. Lock Down `ALLOW_SANDBOX_PERSONAS`
- **Local Development / Testing:** Keep `"true"` (or omit when `NODE_ENV !== "production"`) if you want instant `GUEST`/`FREE`/`PRO`/`ALPHA` persona switching without an external IdP.
- **Staging / Production:** Always set:
  ```dotenv
  ALLOW_SANDBOX_PERSONAS="false"
  ```

##### 3. Configure External Identity Provider (`OAUTH_*`)
Using any OIDC-compliant IdP (Auth0, Okta, Google Identity/Cloud IAM, AWS Cognito, Microsoft Entra ID, or Keycloak):
1. **Create a new Application / Client** in your IdP dashboard:
   - **Application Type:** Single Page Application (SPA) / Public Client (no client secret required because Aurum exchanges codes via **PKCE `S256`**).
   - **Allowed Grant Types:** `Authorization Code` (with PKCE required).
   - **Allowed Callback / Redirect URIs:** `https://<your-domain>/auth/callback` (plus `http://localhost:3000/auth/callback` if testing OIDC locally).
   - **Allowed Web Origins / CORS:** Same origins as `ALLOWED_ORIGINS`.
2. **Configure Tier / Role Claim Mapping (Recommended):**  
   `serverSecurity.ts` resolves tiers (`ALPHA`, `PRO`, `FREE`, `GUEST`) by inspecting `aurum_tier`, `tier`, `role`, `roles`, `permissions`, or `https://goldvista.io/tier` inside the verified JWT payload (defaulting authenticated OIDC users without an elevated claim to `FREE`). Configure an IdP Action/Rule/Claim mapper to attach `aurum_tier` (`"FREE"`, `"PRO"`, or `"ALPHA"`) to the ID/Access token.
3. **Copy your IdP's OpenID Discovery metadata** (`https://<your-idp>/.well-known/openid-configuration`) into the 7 environment variables:
   - `OAUTH_JWKS_URI`: From `jwks_uri` in discovery JSON (e.g., `https://tenant.us.auth0.com/.well-known/jwks.json`).
   - `OAUTH_ISSUER`: Exact `issuer` string from discovery JSON—**pay strict attention to trailing slashes** (e.g., Auth0 uses `https://tenant.us.auth0.com/`, whereas Cognito/Okta omit the trailing slash). `serverSecurity.ts` checks exact equality (`payload.iss === expectedIssuer`).
   - `OAUTH_AUDIENCE`: Your API identifier / client ID expected in the token's `aud` claim (note: when `POST /api/auth/oidc-exchange` verifies an `id_token`, `aud` equals `OAUTH_CLIENT_ID`; when verifying an `access_token`, `aud` equals your API Audience—align `OAUTH_AUDIENCE` with whichever JWT `id_token || access_token` your IdP returns first).
   - `OAUTH_AUTHORIZATION_ENDPOINT`: From `authorization_endpoint` (e.g., `https://tenant.us.auth0.com/authorize`).
   - `OAUTH_TOKEN_ENDPOINT`: From `token_endpoint` (e.g., `https://tenant.us.auth0.com/oauth/token`).
   - `OAUTH_CLIENT_ID`: Your IdP Application Client ID.
   - `OAUTH_REDIRECT_URI`: Exact registered callback URL ending in `/auth/callback` (must match `window.location.origin + '/auth/callback'` used by the SPA).

---

### E. PostgreSQL Persistence, Migrations & File Fallbacks
- `DATABASE_URL`
- `RUN_MIGRATIONS_ON_BOOT`
- `AURUM_JOURNAL_STORE_PATH`
*(Plus `AURUM_FORECAST_STORE_PATH`)*

#### Why They Are Relevant
Without a database, Aurum Intelligence runs in `FILE_SANDBOX` mode using atomic JSON files (`/tmp/aurum-*-store.json`), which lose state whenever ephemeral containers (like Cloud Run) scale down or redeploy. Configuring `DATABASE_URL` switches `server.ts` to `POSTGRESQL` mode for ACID transactional storage across:
- Stripe webhook idempotency, user entitlements, and credit ledgers (`001_initial_postgresql_schema.sql`)
- Immutable forecast snapshots and editorial publications (`001_initial_postgresql_schema.sql`)
- Paper trading journal positions (`002_paper_journal_positions.sql`)

#### Step-by-Step Setup
1. **Install the PostgreSQL driver (`pg`):**  
   `src/db/postgresRepositories.ts` dynamically imports `pg` when `DATABASE_URL` is set (`pg` is intentionally optional in `package.json` so local sandboxes start with zero DB dependencies). Before enabling PostgreSQL in production, install `pg`:
   ```bash
   npm install pg
   ```
2. **Provision PostgreSQL & Create Database/User:**
   - **Managed Cloud (Cloud SQL / RDS / Neon / Supabase):** Create a PostgreSQL 15+ instance, a database (e.g., `goldvista`), and a least-privilege application role with `CREATE`, `SELECT`, `INSERT`, `UPDATE`, `DELETE` on `public` schema.
   - **Local Docker PostgreSQL:**
     ```bash
     docker run -d --name goldvista-pg \
       -e POSTGRES_USER=goldvista_app \
       -e POSTGRES_PASSWORD=strong_local_password \
       -e POSTGRES_DB=goldvista \
       -p 5432:5432 postgres:16-alpine
     ```
3. **Construct `DATABASE_URL`:**
   - **Local:**
     ```dotenv
     DATABASE_URL="postgres://goldvista_app:strong_local_password@localhost:5432/goldvista"
     ```
   - **Production Managed TLS:**
     ```dotenv
     DATABASE_URL="postgres://goldvista_app:<URL_ENCODED_PASSWORD>@<DB_HOST>:5432/goldvista?sslmode=require"
     ```
     *(Tip: URL-encode special characters like `@`, `:`, `/`, `#` in passwords.)*
4. **Configure `RUN_MIGRATIONS_ON_BOOT`:**
   - Set `RUN_MIGRATIONS_ON_BOOT="true"` on initial deployment or rolling updates so `runSqlMigrations()` automatically tracks SHA-256 checksums in `schema_migrations` and applies `migrations/001_initial_postgresql_schema.sql` and `migrations/002_paper_journal_positions.sql`.
   - Set `RUN_MIGRATIONS_ON_BOOT="false"` only if your CI/CD pipeline runs schema migrations via a dedicated job before app containers boot.
5. **Configure `AURUM_JOURNAL_STORE_PATH` (Fallback / Sandbox):**
   - Used whenever `DATABASE_URL` is unset or unreachable. Defaults to `/tmp/aurum-journal-store.json`. Set to a persistent path (e.g., `/var/lib/aurum/aurum-journal-store.json`) if intentionally running file-backed storage.

---

### F. Edge Origin Security (`ALLOWED_ORIGINS`) & Hosting
- `ALLOWED_ORIGINS`

#### Why It Is Relevant
`evaluateCorsOrigin` in `serverSecurity.ts` enforces strict Cross-Origin Resource Sharing (`Access-Control-Allow-Origin`) and emits `Vary: Origin`.
- In **development** (`NODE_ENV !== "production"`), if `ALLOWED_ORIGINS` is unset, `localhost` and `127.0.0.1` origins are allowed automatically.
- In **production** (`NODE_ENV=production`), if `ALLOWED_ORIGINS` is empty or unset, **every cross-origin browser request fails closed with HTTP `403`** (`Origin not allowed by server CORS policy`). Even for same-origin apps behind reverse proxies, load balancers, or embedded preview frames, explicitly listing your canonical frontend origins prevents broken API fetches.

#### Step-by-Step Setup
1. Identify every exact browser origin (`scheme://host[:port]`) allowed to call the backend—**no trailing slashes, no paths, no wildcards**:
   - Production web origin: `https://app.goldvista.io`
   - Staging / Cloud Run preview origin (if used): `https://staging.goldvista.io`
   - Local dev origin (optional in local `.env` only): `http://localhost:3000`
2. Join multiple origins with commas (no spaces needed, though trimmed automatically by `serverSecurity.ts`):
   ```dotenv
   ALLOWED_ORIGINS="https://app.goldvista.io,https://staging.goldvista.io"
   ```
3. Ensure `NODE_ENV="production"` and `PORT=3000` are set in production deployments, and leave `STRICT_FRAME_OPTIONS` unset if embedding inside Google AI Studio's preview iframe (or customize `CSP_FRAME_ANCESTORS` if embedding inside another trusted portal).

---

## 4. Ready-to-Use Environment Templates

### Template 1: Local Sandbox / Development (`.env`)
Zero external paid accounts required; runs with Yahoo Finance + fallback market data, local atomic JSON stores, and sandbox persona switching.
```dotenv
NODE_ENV="development"
PORT=3000
DISABLE_HMR="true"

GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
APP_URL="http://localhost:3000"

MARKET_DATA_PRIMARY_PROVIDER="yahoo_finance"
MARKET_DATA_FALLBACK_PROVIDER="simulated_reference"
MARKET_DATA_MAX_STALE_SECONDS=60
MARKET_DATA_POLL_INTERVAL_SECONDS=15

WEBHOOK_URL=""
STRIPE_WEBHOOK_SECRET=""
AURUM_BILLING_STORE_PATH="/tmp/aurum-billing-store.json"
AURUM_FORECAST_STORE_PATH="/tmp/aurum-forecast-store.json"
AURUM_JOURNAL_STORE_PATH="/tmp/aurum-journal-store.json"

EIA_API_KEY=""
FRED_API_KEY=""

AURUM_SESSION_SECRET="dev_only_replace_with_openssl_rand_hex_32"
ALLOW_SANDBOX_PERSONAS="true"
ALLOWED_ORIGINS="http://localhost:3000"
```

### Template 2: Production / Staging Deployment
Requires `npm install pg` prior to deploy and secrets injected via your cloud Secret Manager.
```dotenv
NODE_ENV="production"
PORT=3000
DISABLE_HMR="true"

GEMINI_API_KEY="<SECRET_GEMINI_API_KEY>"
APP_URL="https://app.goldvista.io"

MARKET_DATA_PRIMARY_PROVIDER="yahoo_finance"
MARKET_DATA_FALLBACK_PROVIDER="simulated_reference"
MARKET_DATA_MAX_STALE_SECONDS=60
MARKET_DATA_POLL_INTERVAL_SECONDS=15

WEBHOOK_URL="<SECRET_DISCORD_OR_SLACK_WEBHOOK_URL>"
STRIPE_WEBHOOK_SECRET="<SECRET_whsec_...>"
AURUM_BILLING_STORE_PATH="/var/lib/aurum/aurum-billing-store.json"
AURUM_FORECAST_STORE_PATH="/var/lib/aurum/aurum-forecast-store.json"
AURUM_JOURNAL_STORE_PATH="/var/lib/aurum/aurum-journal-store.json"

EIA_API_KEY="<SECRET_EIA_API_KEY>"
FRED_API_KEY="<SECRET_FRED_API_KEY>"

AURUM_SESSION_SECRET="<SECRET_64_CHAR_HEX_FROM_OPENSSL>"
ALLOW_SANDBOX_PERSONAS="false"

OAUTH_JWKS_URI="https://your-idp.example.com/.well-known/jwks.json"
OAUTH_ISSUER="https://your-idp.example.com/"
OAUTH_AUDIENCE="goldvista-api"
OAUTH_AUTHORIZATION_ENDPOINT="https://your-idp.example.com/authorize"
OAUTH_TOKEN_ENDPOINT="https://your-idp.example.com/oauth/token"
OAUTH_CLIENT_ID="goldvista-web-pkce"
OAUTH_REDIRECT_URI="https://app.goldvista.io/auth/callback"

DATABASE_URL="<SECRET_postgres://user:pass@host:5432/goldvista?sslmode=require>"
RUN_MIGRATIONS_ON_BOOT="true"
ALLOWED_ORIGINS="https://app.goldvista.io"
```

---

## 5. Post-Setup Verification Checklist

After starting the server (`npm run dev` locally or `npm run build && npm start` in production), run these checks to confirm every environment variable wired up cleanly:

1. **Readiness & Environment Flags Check:**
   ```bash
   curl -s http://localhost:3000/health/ready | jq
   ```
   Verify:
   - `"ready": true` and `"persistenceMode"` (`"POSTGRESQL"` vs `"FILE_SANDBOX"`) matches your `DATABASE_URL` intent
   - `"oidcConfigured": true` (when `OAUTH_JWKS_URI` is set)
   - `"stripeWebhookSecretConfigured": true` (in production)
   - `"geminiConfigured": true` (when `GEMINI_API_KEY` is set)
   - `"migrations"` shows `applied` / `skipped` without errors when `RUN_MIGRATIONS_ON_BOOT="true"`.

2. **Auth & Sandbox Lockout Verification:**
   ```bash
   curl -s http://localhost:3000/api/auth/session-config | jq
   ```
   In production, confirm `"sandboxModeEnabled": false` and `"authProviderMode": "OIDC_PKCE_JWKS"`. Attempting `POST /api/auth/sandbox-token` should return HTTP `403`.

3. **CORS Allowlist Verification:**
   ```bash
   curl -i -H "Origin: https://untrusted.example.com" http://localhost:3000/api/market-data/status
   ```
   In `NODE_ENV=production`, untrusted origins must return HTTP `403`.

4. **Stripe Webhook Signature Verification:**  
   Send an unsigned `POST /api/billing/webhook` in `NODE_ENV=production` (or with `STRIPE_WEBHOOK_SECRET` set) and confirm it rejects with HTTP `401`, then test a signed event with `stripe trigger checkout.session.completed`.

5. **Macro & Fundamentals Check:**  
   Query `GET /api/fundamentals/WTI_OIL?fresh=true` and `GET /api/fundamentals/GOLD?fresh=true` to verify EIA v2 and FRED `DFII10` live telemetry instead of fallback notices.
