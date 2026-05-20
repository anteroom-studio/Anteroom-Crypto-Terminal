const MULTIPLIER_PREFIXES = ['1000'];
const CONTRACT_OVERRIDES = {
  SHIB: '1000SHIB',
  PEPE: '1000PEPE',
  BONK: '1000BONK',
  FLOKI: '1000FLOKI',
  LUNC: '1000LUNC',
  XEC: '1000XEC',
  RATS: '1000RATS',
  SATS: '1000SATS',
};

export function resolveFuturesSymbol(input = 'BTC') {
  const displaySymbol = String(input || 'BTC').trim().toUpperCase().replace(/USDT$/, '') || 'BTC';
  const contractBase = CONTRACT_OVERRIDES[displaySymbol] || displaySymbol;
  const multiplier = MULTIPLIER_PREFIXES.reduce((value, prefix) => contractBase.startsWith(prefix) ? Number(prefix) : value, 1);
  return {
    displaySymbol,
    contractBase,
    contractSymbol: `${contractBase}USDT`,
    multiplier,
  };
}

export function displaySymbolFromContract(contractSymbol = '') {
  const base = String(contractSymbol || '').replace(/USDT$/i, '').toUpperCase();
  for (const prefix of MULTIPLIER_PREFIXES) {
    if (base.startsWith(prefix)) return base.slice(prefix.length);
  }
  return base;
}

export function displayPriceFromContract(price, multiplier = 1) {
  return Number(price || 0) / Math.max(Number(multiplier || 1), 1);
}
