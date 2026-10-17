# Westpac Global — Online Banking Demo

A self-contained **demo online-banking platform** with an administration console for managing client accounts and a client dashboard for balances, swaps, deposits, withdrawals and transaction history.

**Important:** This is a demonstration platform. Unless the appropriate external integrations are implemented, it does not connect to a real bank, create real bank accounts, transfer real money or verify real blockchain transactions.

**Stack:** Node.js + Express + SQLite (a local file). Internet access is used for live market prices and other configured external services. The application can operate without internet access, although live data may be unavailable.

## Run It

```bash
npm install
npm start
```

| Who | Address |
|---|---|
| Public home page | http://localhost:4000 |
| Clients — Online Banking Login | http://localhost:4000/login.html |
| Administration console | http://localhost:4000/admin-login.html |

The admin address is deliberately not linked from the client page.

Default demo admin login: `admin` / `admin123`, if configured. Change the credentials before making the application publicly accessible. See `.env.example` and the authentication configuration.

- Requires Node.js 18+; Node.js 22+ recommended.
- The database is created automatically at `data/west-pec-global.db`.
- Back up the database before making changes or running migrations.
- Resetting the application by deleting the `data/` folder permanently removes the stored database records.
- When upgrading an earlier build, verify that the migration succeeds and that the existing database is preserved.

## How Accounts Work

- Clients cannot sign themselves up or change their password unless this functionality is added.
- The administrator creates accounts and issues the generated username and password.
- If a client forgets their password, the administrator can use **Reset Password** in Manage Users.
- Clients can update their phone number. Other account details, including legal name, address and identification information, are read-only unless configured otherwise.

## Opening a Client Account

From **Admin → Create User**, the administrator enters:

1. **Account:** account type (Personal, Joint, Business or Corporate) and preferred currencies.
2. **Personal details:** legal name, date of birth, nationality, country of residence, address, city and postcode.
3. **Contact details:** email and phone number.
4. **Identification:** ID type, ID number and country of issue.
5. **Financial and employment details:** occupation, employer where applicable, source of funds, expected deposit and business registration number for Business or Corporate accounts.
6. **Consent:** accuracy confirmation and agreement to the Terms & Conditions and Privacy Policy.

The consent time is recorded with the account. A username and password are generated when the account is created.

Preferred currencies and expected deposits are account information only. Selecting a currency does not create a real bank account or add money to the user's balance.

The `/terms.html` and `/privacy.html` pages contain sample wording and should be reviewed and replaced with appropriate policies.

## Multi-Currency Account Balances

The dashboard is designed to support multiple fiat currencies, including:

- USD — US Dollar
- EUR — Euro
- GBP — British Pound
- XAF — Central African CFA Franc
- INR — Indian Rupee
- JPY — Japanese Yen
- CNY — Chinese Yuan
- PHP — Philippine Peso
- AED — UAE Dirham

Additional currencies may be supported depending on the application's configuration.

- The administrator can assign supported currencies to client accounts.
- Each currency must maintain its own balance.
- When a user is credited in a particular currency, that currency and amount should appear in the user's balance and transaction history.
- A credit in one currency must not silently increase another currency's balance.
- Where a live exchange-rate provider is configured, the dashboard can display an estimated converted value.
- The original transaction amount and currency must remain visible even when a converted value is shown.
- If live exchange rates are unavailable, the dashboard should show that the rate is unavailable rather than inventing a live price.

Cryptocurrency balances and fiat balances must remain separate unless a conversion is explicitly recorded.

## Fiat Receiving Details

Where the receiving-details feature is installed, the administrator can configure receiving instructions for supported currencies.

The details may include:

- Currency
- Bank or payment provider
- Account holder name
- Account number
- IBAN, where applicable
- SWIFT/BIC, where applicable
- Routing number or sort code, where applicable
- Bank address
- Payment instructions

Users can view the receiving details configured for their selected currencies.

**Receiving details must be supplied by the legitimate bank or payment provider.** The application must not invent bank account numbers, IBANs, SWIFT codes or other banking details.

If receiving details have not been configured for a currency, the dashboard should display a pending-setup message.

Displaying receiving instructions does not mean a deposit has been received or confirmed.

## Transaction History and Deposit Records

The transaction history should provide a record of activity associated with each user account.

Each transaction should display the applicable details:

- Unique transaction reference
- Transaction type
- Amount and currency
- Date and time
- Transaction status
- Description or payment reference
- Relevant deposit, withdrawal or conversion details

Supported transaction types may include:

- Administrator credit
- Deposit
- Withdrawal
- Currency conversion or crypto swap
- Network fee
- Refund or reversal, where supported

Users should be able to open a transaction to view its details and a clean, printable receipt. The receipt should be suitable for saving as a PDF or taking a screenshot.

Possible statuses include **Pending**, **Completed**, **Failed** and **Rejected**, depending on the transaction workflow.

An administrator-issued credit must be identified as an administrator credit. It must not be described as a bank-confirmed deposit unless an actual deposit has been independently verified.

A transaction receipt documents the record maintained by this application. It is not automatically proof of a bank transfer or payment.

## Cryptocurrency Deposits

The administration console can configure demo deposit addresses for supported cryptocurrencies and networks.

Crypto transaction records should support the following information when available:

- Cryptocurrency
- Blockchain network
- Receiving wallet address
- Sender address, if available
- Transaction hash (TXID)
- Amount and currency
- Network fee, where applicable
- Date and time
- Confirmation count
- Required confirmation threshold
- Transaction status

A transaction hash entered by a user or administrator is not proof of payment by itself.

For real blockchain verification, the application must connect to a suitable blockchain explorer API, node or verification provider. It must check the correct network, receiving address, asset, amount and confirmation count before marking a deposit as confirmed.

If blockchain verification is not configured, the transaction must be identified as simulated or unverified.

Demo wallet addresses must not be presented as wallets controlled by the platform unless that is actually the case.

## Admin Features

- **Manage Users:** view client details, edit details, reset passwords and manage account balances.
- **Currency management:** assign supported currencies to users.
- **Credit Balance:** record an administrator-issued credit with its amount, currency, reference, date and time, and status.
- **Dashboard:** open a client's dashboard in a new tab, where supported. An Admin View banner identifies the administrative view.
- **Withdrawal requests:** approve or reject requests with a written reason. Rejected withdrawals should release held funds according to the application's transaction logic.
- **Deposit addresses:** configure supported cryptocurrency addresses by coin and network.
- **Fiat receiving details:** configure legitimate receiving instructions for each supported currency.
- **Support settings:** maintain the email address and WhatsApp contact shown to clients.
- **Overview:** display platform totals and cryptocurrency market prices when the price service is available.

The availability of each feature depends on the installed code and its configuration.

## Client Features

- Dashboard and wallet
- Multiple fiat currency balances
- Cryptocurrency holdings and logos
- Live cryptocurrency market prices when available
- Portfolio chart
- Swaps between supported assets, with an estimate before confirmation
- Bank withdrawal workflow for supported fiat balances
- Crypto withdrawal workflow
- Deposit addresses with copy controls
- Transaction history and individual transaction receipts
- Deposit and withdrawal status
- Rejection notices with reasons
- Support through email and WhatsApp
- KYC Upgrade Now page
- Buy Crypto link, where configured

Actual availability depends on the installed application and its integrations.

## Network Fee Rules

The configured network fees for swaps and crypto withdrawals are defined in `utils/constants.js`.

| Network | Gas coin | Configured demo fee |
|---|---|---:|
| ERC20 | ETH | 0.0025 |
| BEP20 | BNB | 0.012 |
| TRC20 | TRX | 6 |
| SOL | SOL | 0.03 |
| MATIC | MATIC | 0.6 |
| BTC (native) | — | 0 |

These are configured demo values, not guaranteed live network fees.

A real transaction integration should use suitable fee estimates and validate the selected network's requirements. Where applicable, the application should block a transaction if the relevant wallet lacks sufficient funds for the network fee.

## Money and Transaction Safety

- Balance changes and their associated transaction records should be committed as one database transaction.
- Failed operations should not leave balances partially updated.
- Every transaction should have a unique reference.
- Duplicate processing should be prevented where possible.
- Pending, completed, failed and rejected transactions should be distinguishable.
- Administrator balance changes should be auditable.
- Transaction history should reflect the stored records.
- Real bank and blockchain confirmation requires external verification. A database entry alone does not establish that funds were received.
- Administrative and user API endpoints must enforce server-side authorization.

## Project Layout

```text
server.js                  Express application
config/db.js               SQLite setup and database migrations
models/                    User, Transaction, DepositAddress,
                           SupportSettings
routes/                    Authentication, admin and user APIs
utils/                     Coins, fees, option lists, validation,
                           live price utilities
public/index.html          Public home page
public/login.html          Client login
public/assets/             Home page images
public/site-admin/         Public home page administration
public/admin-login.html    Administration login
public/*.html              Other site pages
public/js/                 Client-side JavaScript
public/css/                Stylesheets
data/                      Automatically created database directory
```

The exact files and responsibilities may vary by build. Check the actual repository before replacing or renaming files.

## Configuration and Security

- Keep secrets and credentials in environment variables where supported.
- Never commit `.env` files or private API keys to GitHub.
- Change default administrator credentials.
- Back up the database before migrations and resets.
- Use HTTPS and secure session settings before exposing the application publicly.
- Protect administrative endpoints with server-side authentication and authorization.
- Validate all user-supplied amounts, currencies, addresses and transaction references on the server.
- Use legitimate bank, payment-provider and blockchain integrations for real transaction verification.

## Disclaimer

Westpac Global is a demonstration project. Unless the appropriate integrations have been implemented and configured, it does not connect to a real bank, execute real fiat transfers or verify real blockchain deposits.

Market prices and exchange rates may be delayed or unavailable. Simulated balances, administrator credits, transaction receipts and demo receiving instructions must not be represented as proof of real funds or confirmed payments.

