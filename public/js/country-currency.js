/* country-currency.js: maps a country name to its common local currency code. */
(function(){
  var MAP = {
    'united states':'USD','usa':'USD','united states of america':'USD',
    'canada':'CAD',
    'united kingdom':'GBP','uk':'GBP','great britain':'GBP','england':'GBP','scotland':'GBP','wales':'GBP',
    'france':'EUR','germany':'EUR','spain':'EUR','italy':'EUR','portugal':'EUR','netherlands':'EUR','belgium':'EUR',
    'ireland':'EUR','austria':'EUR','greece':'EUR','finland':'EUR','luxembourg':'EUR','slovakia':'EUR','slovenia':'EUR',
    'estonia':'EUR','latvia':'EUR','lithuania':'EUR','cyprus':'EUR','malta':'EUR','croatia':'EUR',
    'australia':'AUD','new zealand':'NZD',
    'china':'CNY',"people's republic of china":'CNY',
    'japan':'JPY',
    'south korea':'KRW','korea':'KRW',
    'brazil':'BRL',
    'mexico':'MXN',
    'india':'INR',
    'nigeria':'NGN',
    'ghana':'GHS',
    'kenya':'KES',
    'south africa':'ZAR',
    'cameroon':'XAF','gabon':'XAF','chad':'XAF','congo':'XAF','central african republic':'XAF','equatorial guinea':'XAF',
    'senegal':'XOF',"cote d'ivoire":'XOF','ivory coast':'XOF','mali':'XOF','burkina faso':'XOF','niger':'XOF','togo':'XOF','benin':'XOF','guinea-bissau':'XOF',
    'bahamas':'BSD',
    'barbados':'BBD',
    'jamaica':'JMD',
    'trinidad and tobago':'TTD',
    'switzerland':'CHF',
    'sweden':'SEK',
    'norway':'NOK',
    'denmark':'DKK',
    'poland':'PLN',
    'turkey':'TRY',
    'russia':'RUB',
    'egypt':'EGP',
    'morocco':'MAD',
    'tanzania':'TZS',
    'uganda':'UGX',
    'rwanda':'RWF',
    'zambia':'ZMW',
    'czech republic':'CZK','czechia':'CZK',
    'hungary':'HUF',
    'israel':'ILS',
    'saudi arabia':'SAR',
    'united arab emirates':'AED','uae':'AED',
    'singapore':'SGD',
    'hong kong':'HKD',
    'thailand':'THB',
    'malaysia':'MYR',
    'philippines':'PHP',
    'indonesia':'IDR',
    'vietnam':'VND',
    'pakistan':'PKR',
    'bangladesh':'BDT',
    'sri lanka':'LKR',
    'chile':'CLP',
    'colombia':'COP',
    'argentina':'ARS',
    'peru':'PEN'
  };
  function currencyForCountry(name){
    if (!name) return null;
    var k = String(name).trim().toLowerCase();
    if (MAP[k]) return MAP[k];
    for (var key in MAP) {
      if (k.indexOf(key) !== -1 || key.indexOf(k) !== -1) return MAP[key];
    }
    return null;
  }
  window.currencyForCountry = currencyForCountry;
  window.COUNTRY_CURRENCY_MAP = MAP;
})();
