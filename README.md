# Westpac Global — Online Banking Demo

A self-contained **demo** online-banking platform: an administration console for opening
and managing client accounts, and a client dashboard for balances, swaps, deposits and
withdrawals. No real funds, no real blockchain, no real bank — everything is simulated.

**Stack:** Node.js + Express + SQLite (a local file). No database server, no cloud account,
no IP whitelist. Internet is only used for live coin prices and logos; the app still works
without it.

## Run it

```bash
npm install
npm start
```

| Who | Address |
|---|---|
| Public home page (marketing site) | http://localhost:4000 |
| Clients — "Online Banking Login" (→ dashboard) | http://localhost:4000/login.html |
| Administration console | http://localhost:4000/admin-login.html |

The admin address is deliberately **not linked** from the client page. Default admin login:
`admin` / `admin123` (change in `.env` — see `.env.example`; optional).

- Needs Node.js 18+ (22+ recommended)
- The database is created automatically at `data/west-pec-global.db`
- Reset everything: stop the server and delete the `data/` folder
- Upgrading from an earlier build: your existing database is renamed and upgraded
  automatically; nothing is lost

## How accounts work

- **Clients cannot sign themselves up or change their password.** The only way in is the
  username and password issued when the administrator opens the account. If a client
  forgets it, the administrator uses **Reset password** in Manage Users.
- Clients can update their own **phone number**. Everything else on their account page
  (legal name, address, ID, etc.) is read-only.

## Opening a client account (admin → Create User)

1. **Account** — account type (Personal / Joint / Business / Corporate) and preferred currencies
2. **Personal details** — legal name, date of birth (18+), nationality, country of residence, address, city, postcode
3. **Contact details** — email, phone
4. **Identification** — ID type, ID number, country of issue
5. **Financial & employment** — occupation, employer (optional), source of funds, expected deposit,
   business registration number (required for Business / Corporate accounts)
6. **Consent** — two required checkboxes: accuracy confirmation, and agreement to the
   Terms & Conditions and Privacy Policy (both link to `/terms.html` and `/privacy.html`)

The time consent was recorded is stored with the account. A username and password are
generated and shown once. Notes:

- *Preferred currencies* and *expected deposit* are recorded information only — they don't
  add funds or change which wallets exist. Fund an account with **Manage → Credit Balance**.
- `/terms.html` and `/privacy.html` contain **sample wording** — replace it with your own.

## Admin features

- **Manage Users**: view all client details, **Edit details** (same form as creation),
  reset password, credit USD/crypto (logged as deposits), override balances
- **Dashboard** button: opens that client's real dashboard in a new tab (an "Admin view"
  banner is shown; your admin session is untouched)
- **Withdrawal requests**: approve, or reject with a written reason — the client sees it on
  their dashboard and the held funds (amount + network fee) are returned automatically
- **Deposit addresses**: a demo wallet address per coin/network, shown to clients with a Copy button
- **Support settings**: email + WhatsApp shown on the client's Support page
- **Overview**: totals and live market prices for every coin

## Client features

- Dashboard, wallet with coin logos, live market, portfolio chart
- **Swap** any holding into USD **or any other coin/network** at the live rate (with estimate)
- **Withdraw to bank** — USD only (swap crypto → USD first) · **Withdraw to crypto**
- **Deposit** addresses with Copy · transaction history · rejection notices with the reason
- Support (email / WhatsApp), KYC "Upgrade Now", Buy Crypto link

## Network fee rule (swaps and crypto withdrawals)

The fee is paid in the network's gas coin from the same wallet. Without enough of it the
action is blocked ("TRX needed before swapping can work").

| Network | Gas coin | Fee |
|---|---|---|
| ERC20 | ETH | 0.0025 |
| BEP20 | BNB | 0.012 |
| TRC20 | TRX | 6 |
| SOL | SOL | 0.03 |
| MATIC | MATIC | 0.6 |
| BTC (native) | — | 0 |

Coins, networks and fees are defined in `utils/constants.js`.

## Money safety

Every swap, withdrawal and rejection is one all-or-nothing database step, so balances can
never end up half-updated.

## Project layout

```
server.js           Express app
config/db.js        SQLite setup + automatic upgrade of older database files
models/             User, Transaction, DepositAddress, SupportSettings
routes/             auth, admin, user APIs
utils/              coins/fees/option lists, client-detail validation, live prices
public/index.html   Public home page (About, Accounts, Open an Account, Security, Contact)
public/login.html   Client "Online Banking Login" (every Log In button on the home page points here)
public/assets/      Home page images
public/site-admin/  Home page admin (open-account applications + reviews, browser localStorage, password admin123)
public/admin-login.html   Administration login (separate design)
public/*.html, js/, css/  the rest of the site
data/               created automatically — your database file
```

## Disclaimer

Demonstration only. It does not connect to any real exchange, blockchain or bank.
