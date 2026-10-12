const HttpError = require('./httpError');
const {
  COINS, ACCOUNT_TYPES, BUSINESS_ACCOUNT_TYPES, FIAT_CURRENCIES, ID_TYPES, SOURCES_OF_FUNDS
} = require('./constants');

// Validates the client details the admin enters when opening (or editing) an
// account, and returns a clean object ready to store. Throws a friendly
// HttpError(400) naming the first problem it finds.
function parseClientDetails(body, { requireConsent }) {
  const text = (key, label, { required = true, max = 200 } = {}) => {
    const value = String(body[key] ?? '').trim();
    if (required && !value) throw new HttpError(400, `${label} is required`);
    if (value.length > max) throw new HttpError(400, `${label} is too long`);
    return value;
  };
  const oneOf = (key, label, list) => {
    const value = text(key, label);
    if (!list.includes(value)) throw new HttpError(400, `Please choose a valid ${label.toLowerCase()}`);
    return value;
  };

  // Account
  const accountType = oneOf('accountType', 'Account type', ACCOUNT_TYPES);
  const allowedCurrencies = [...FIAT_CURRENCIES, ...Object.keys(COINS)];
  const preferredCurrencies = Array.isArray(body.preferredCurrencies) ? [...new Set(body.preferredCurrencies)] : [];
  if (preferredCurrencies.length === 0) throw new HttpError(400, 'Choose at least one preferred currency');
  if (preferredCurrencies.some((c) => !allowedCurrencies.includes(c))) throw new HttpError(400, 'One of the preferred currencies is not supported');

  // Personal
  const name = text('legalName', 'Legal name');
  const dateOfBirth = text('dateOfBirth', 'Date of birth');
  const dob = new Date(dateOfBirth + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || isNaN(dob.getTime())) throw new HttpError(400, 'Enter a valid date of birth');
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  if (now.getUTCMonth() < dob.getUTCMonth() || (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate())) age--;
  if (dob > now) throw new HttpError(400, 'Date of birth cannot be in the future');
  if (age < 18) throw new HttpError(400, 'The account holder must be at least 18 years old');
  if (age > 120) throw new HttpError(400, 'Enter a valid date of birth');
  const nationality = text('nationality', 'Nationality');
  const country = text('residenceCountry', 'Country of residence');
  const address = text('address', 'Address');
  const city = text('city', 'City');
  const postcode = text('postcode', 'Postcode', { max: 20 });

  // Contact
  const email = text('email', 'Email address').toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Enter a valid email address');
  const phoneNumber = text('phoneNumber', 'Phone number', { max: 30 });
  if (phoneNumber.replace(/\D/g, '').length < 6) throw new HttpError(400, 'Enter a valid phone number');

  // Identification
  const idType = oneOf('idType', 'ID type', ID_TYPES);
  const idNumber = text('idNumber', 'ID number', { max: 40 });
  if (idNumber.length < 4) throw new HttpError(400, 'Enter a valid ID number');
  const idCountry = text('idCountry', 'Country of issue');

  // Financial / employment
  const occupation = text('occupation', 'Occupation');
  const employer = text('employer', 'Employer', { required: false });
  const sourceOfFunds = oneOf('sourceOfFunds', 'Source of funds', SOURCES_OF_FUNDS);
  const expectedDeposit = Number(body.expectedDeposit);
  if (body.expectedDeposit === '' || body.expectedDeposit === undefined || isNaN(expectedDeposit) || expectedDeposit < 0) {
    throw new HttpError(400, 'Enter the expected deposit amount (0 or more)');
  }
  const isBusiness = BUSINESS_ACCOUNT_TYPES.includes(accountType);
  const businessRegNumber = text('businessRegNumber', 'Business registration number', { required: isBusiness, max: 60 });

  // Consent (recorded when the account is opened)
  let consent = {};
  if (requireConsent) {
    if (body.consentAccuracy !== true) throw new HttpError(400, 'Please confirm that the information provided is accurate');
    if (body.consentTerms !== true) throw new HttpError(400, 'The Terms & Conditions and Privacy Policy must be accepted');
    consent = { consentAccuracy: 1, consentTerms: 1, consentAt: Date.now() };
  }

  return {
    accountType, preferredCurrencies, name, dateOfBirth, nationality, country, address, city, postcode,
    email, phoneNumber, idType, idNumber, idCountry, occupation, employer, sourceOfFunds, expectedDeposit,
    businessRegNumber: isBusiness ? businessRegNumber : '', ...consent
  };
}

module.exports = { parseClientDetails };
