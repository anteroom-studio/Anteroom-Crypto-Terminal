import { clamp } from '../utils/format.js';
import { displayPriceFromContract, displaySymbolFromContract, resolveFuturesSymbol } from '../utils/contracts.js';
import { pushSnapshot, estimatePressureMap, summarizeRealFeed } from '../logic/zaiEngine.js';

const FETCH_TIMEOUT_MS = 12000;
const NEWS_CACHE_KEY = 'zai_news_cache_v2';
const EVENTS_CACHE_KEY = 'zai_events_cache_v2';
const SCAN_SYMBOLS = ['BTC','ETH','SOL','BNB','XRP','DOGE','SHIB','PEPE'];
const NEWS_QUERIES = [
  { tag:'Crypto', q:'cryptocurrency OR bitcoin OR ethereum when:2d', gdelt:'(bitcoin OR ethereum OR crypto OR etf)' },
  { tag:'Macro', q:'Federal Reserve OR inflation OR CPI OR rates when:3d', gdelt:'(Federal Reserve OR CPI OR inflation OR rates OR recession)' },
  { tag:'Stocks', q:'stock market OR earnings OR Nasdaq OR S&P 500 when:2d', gdelt:'(stock market OR earnings OR S&P 500 OR Nasdaq OR Dow)' },
  { tag:'Politics', q:'politics market regulation when:3d', gdelt:'(election OR regulation OR congress OR policy)' },
  { tag:'War', q:'war markets oil shipping when:3d', gdelt:'(war OR missile OR attack OR oil shipping OR Red Sea)' },
  { tag:'AI', q:'artificial intelligence chips nvidia data centers when:2d', gdelt:'(artificial intelligence OR Nvidia OR chips OR data center)' },
];

const pair = symbol => resolveFuturesSymbol(symbol).contractSymbol;
const googleNewsRss = query => `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
const viaProxy = url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
const viaRss2Json = url => `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&count=4`;
const gdeltDoc = feed => `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(feed.gdelt)}&mode=artlist&format=json&maxrecords=6&sort=datedesc`;

function saveCache(key, value) { try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), value })); } catch {} }
function readCache(key, maxAge = 6 * 60 * 60 * 1000) { try { const raw = JSON.parse(localStorage.getItem(key) || 'null'); if (!raw?.value || Date.now() - raw.ts > maxAge) return null; return raw.value; } catch { return null; } }
async function timedFetch(url) { const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS); try { return await fetch(url, { signal: ctrl.signal, cache: 'no-store' }); } finally { clearTimeout(timer); } }
async function fetchJson(url) { const res = await timedFetch(url); if (!res.ok) throw new Error(`${res.status} ${res.statusText}`); return res.json(); }
async function fetchText(url) { const res = await timedFetch(url); if (!res.ok) throw new Error(`${res.status} ${res.statusText}`); return res.text(); }
async function settle(promise) { try { return { ok:true, value:await promise }; } catch (error) { return { ok:false, error }; } }

function cleanTitle(title='') { return title.replace(/\s+-\s+[^-]+$/, '').trim(); }
function inferImpact(title='') { const t = title.toLowerCase(); if (/cpi|inflation|powell|fed|fomc|sec|war|tariff|hack|etf|jobs|nfp/.test(t)) return 'High'; if (/bitcoin|ethereum|nvidia|earnings|oil|rates|policy|election/.test(t)) return 'Medium'; return 'Low'; }
function extractSource(item) { return item.querySelector('source')?.textContent?.trim() || 'News source'; }
function isGoodNewsItem(item) { const title=(item?.title||'').trim(); if (!title || title.length < 18) return false; if (!item?.publishedAt || Number.isNaN(new Date(item.publishedAt).getTime())) return false; if (/dog after fire|firefighters|congratulates bailey|investment watch blog/i.test(title)) return false; return true; }
function normalizeNewsItem(feed, raw) {
  const title = cleanTitle(raw.title || 'Headline');
  const publishedAt = raw.pubDate || raw.publishedAt || raw.seendate || new Date().toUTCString();
  return { tag: feed.tag, title, link: raw.link || raw.url || '', source: raw.source || raw.domain || raw.author || 'News source', publishedAt, minsAgo: Math.max(1, Math.round((Date.now() - new Date(publishedAt).getTime())/60000)), impact: inferImpact(title) };
}

export async function syncFearGreed(state) {
  try { const data = await fetchJson('https://api.alternative.me/fng/?limit=1'); const item=data?.data?.[0]; if (item) { state.market.sentiment=Number(item.value||50); state.market.sentimentLabel=item.value_classification||'Neutral'; } } catch {}
}

async function fetchNewsViaProxy(feed) {
  const xml = await fetchText(viaProxy(googleNewsRss(feed.q)));
  const doc = new DOMParser().parseFromString(xml,'text/xml');
  return [...doc.querySelectorAll('item')].slice(0,4).map(item => normalizeNewsItem(feed, { title:item.querySelector('title')?.textContent||'', link:item.querySelector('link')?.textContent?.trim()||'', pubDate:item.querySelector('pubDate')?.textContent||'', source:extractSource(item) }));
}
async function fetchNewsViaRss2Json(feed) {
  const json = await fetchJson(viaRss2Json(googleNewsRss(feed.q)));
  return (json?.items||[]).slice(0,4).map(item => normalizeNewsItem(feed, { title:item.title, link:item.link, pubDate:item.pubDate, source:item.author || json?.feed?.title || 'News source' }));
}
async function fetchNewsViaGdelt(feed) {
  const json = await fetchJson(gdeltDoc(feed));
  return (json?.articles||[]).slice(0,4).map(item => normalizeNewsItem(feed, { title:item.title, url:item.url, seendate:item.seendate, domain:item.domain }));
}

export async function syncNews(state) {
  const seen = new Set();
  const collected = [];
  let best = 'Unavailable';
  const results = await Promise.all(NEWS_QUERIES.map(async feed => {
    for (const fn of [fetchNewsViaProxy, fetchNewsViaRss2Json, fetchNewsViaGdelt]) {
      const res = await settle(fn(feed));
      if (res.ok && res.value.length) return { label: fn === fetchNewsViaGdelt ? 'Live Wire' : 'Live RSS', items: res.value };
    }
    return { label:'Unavailable', items:[] };
  }));
  for (const result of results) {
    if (result.label === 'Live RSS') best = 'Live RSS'; else if (result.label === 'Live Wire' && best !== 'Live RSS') best = 'Live Wire';
    for (const item of result.items) { if (!isGoodNewsItem(item)) continue; const key=`${item.title}|${item.source}`; if (seen.has(key)) continue; seen.add(key); collected.push(item); }
  }
  collected.sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt));
  state.news = collected.slice(0,12);
  if (state.news.length) { state.liveStatus.news = best; saveCache(NEWS_CACHE_KEY, state.news); }
  else { const cached = readCache(NEWS_CACHE_KEY); state.news = cached || []; state.liveStatus.news = cached?.length ? 'Cached' : 'Unavailable'; }
}

function pushSessionMarkers(events) {
  const now = new Date();
  const markers = [{title:'London open window',hour:8},{title:'New York session handoff',hour:13},{title:'US futures close review',hour:20},{title:'Asia session handoff',hour:0}];
  for (const m of markers) { const when = new Date(now); when.setUTCHours(m.hour,0,0,0); if (when.getTime() <= Date.now()) when.setUTCDate(when.getUTCDate()+1); events.push({ tag:'Macro', title:m.title, timeMs:when.getTime(), source:'Session clock', impact:'Medium' }); }
}

export async function syncEvents(state) {
  const events=[]; const resolved=resolveFuturesSymbol(state.symbol);
  const premium = await settle(fetchJson(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${resolved.contractSymbol}`));
  if (premium.ok) { const nextFundingTime = Number(premium.value?.nextFundingTime||0); state.market.nextFundingTime = nextFundingTime; if (nextFundingTime > Date.now()) events.push({ tag:'Crypto', title:`${resolved.displaySymbol} next funding timestamp`, timeMs:nextFundingTime, source:'Binance Futures', impact:'Medium' }); }
  const calendar = await settle(fetchJson('https://api.tradingeconomics.com/calendar?c=guest:guest&f=json'));
  if (calendar.ok) {
    const now = Date.now();
    for (const item of calendar.value || []) {
      const eventTime = new Date(item.Date || item.DateUtc || '').getTime();
      if (!Number.isFinite(eventTime) || eventTime <= now || eventTime > now + 24*60*60*1000) continue;
      events.push({ tag:'Macro', title:item.Event || item.Title || 'Economic event', timeMs:eventTime, source:item.Country || 'Trading Economics', impact: Number(item.Importance||1) >= 2 ? 'High' : 'Medium' });
    }
  }
  pushSessionMarkers(events);
  events.sort((a,b)=>a.timeMs-b.timeMs);
  state.events = events.slice(0,8).map(item => ({ ...item, minsAhead: Math.max(1, Math.round((item.timeMs-Date.now())/60000)) }));
  if (state.events.length) { state.liveStatus.events = (premium.ok || calendar.ok) ? 'Live' : 'Clock'; saveCache(EVENTS_CACHE_KEY,state.events); }
  else { const cached = readCache(EVENTS_CACHE_KEY, 12*60*60*1000); state.events = (cached||[]).map(i=>({...i, minsAhead:Math.max(1, Math.round((i.timeMs-Date.now())/60000))})).filter(i=>i.minsAhead>0).slice(0,8); state.liveStatus.events = state.events.length ? 'Cached' : 'Clock'; }
}

export async function syncMarket(state) {
  const resolved = resolveFuturesSymbol(state.symbol); const contract = resolved.contractSymbol;
  state.symbol = resolved.displaySymbol;
  state.market.contractSymbol = contract;
  state.market.contractMultiplier = resolved.multiplier;
  const [ticker, depth, openInterest, openInterestStats, fundingRate, klines, premium] = await Promise.all([
    settle(fetchJson(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${contract}`)),
    settle(fetchJson(`https://fapi.binance.com/fapi/v1/depth?symbol=${contract}&limit=20`)),
    settle(fetchJson(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${contract}`)),
    settle(fetchJson(`https://fapi.binance.com/futures/data/openInterestHist?symbol=${contract}&period=5m&limit=2`)),
    settle(fetchJson(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${contract}&limit=1`)),
    settle(fetchJson(`https://fapi.binance.com/fapi/v1/klines?symbol=${contract}&interval=${state.timeframe}&limit=80`)),
    settle(fetchJson(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${contract}`)),
  ]);
  const tickerData=ticker.ok?ticker.value:{}; const depthData=depth.ok?depth.value:{}; const openInterestData=openInterest.ok?openInterest.value:{};
  const openInterestStatsData=openInterestStats.ok?openInterestStats.value:[]; const fundingRateData=fundingRate.ok?fundingRate.value:[]; const klinesData=klines.ok?klines.value:[]; const premiumData=premium.ok?premium.value:{};
  const bids=depthData?.bids||[]; const asks=depthData?.asks||[];
  const bestBid=Number(bids[0]?.[0]||0); const bestAsk=Number(asks[0]?.[0]||0);
  const bidNotional=bids.slice(0,10).reduce((sum,[price,qty])=>sum+Number(price)*Number(qty),0); const askNotional=asks.slice(0,10).reduce((sum,[price,qty])=>sum+Number(price)*Number(qty),0);
  const spreadPct = bestBid && bestAsk ? ((bestAsk-bestBid)/((bestAsk+bestBid)/2))*100 : 0;
  const imbalance = bidNotional+askNotional===0 ? 0 : (bidNotional-askNotional)/(bidNotional+askNotional);
  state.market.lastPrice=Number(tickerData?.lastPrice||0); state.market.markPrice=Number(premiumData?.markPrice||state.market.lastPrice||0); state.market.indexPrice=Number(premiumData?.indexPrice||state.market.lastPrice||0); state.market.nextFundingTime=Number(premiumData?.nextFundingTime||0);
  state.market.dayChangePct=Number(tickerData?.priceChangePercent||0); state.market.quoteVolume=Number(tickerData?.quoteVolume||0); state.market.baseVolume=Number(tickerData?.volume||0);
  state.market.topBid=bestBid; state.market.topAsk=bestAsk; state.market.spreadPct=spreadPct; state.market.bookBidNotional=bidNotional; state.market.bookAskNotional=askNotional; state.market.depthM=(bidNotional+askNotional)/1_000_000;
  state.market.funding=Number(fundingRateData?.[0]?.fundingRate||premiumData?.lastFundingRate||0); state.market.openInterestUsd=Number(openInterestData?.openInterest||0)*state.market.lastPrice;
  const prevOI=Number(openInterestStatsData?.[0]?.sumOpenInterestValue||0)||state.market.openInterestUsd; const latestOI=Number(openInterestStatsData?.at(-1)?.sumOpenInterestValue||0)||state.market.openInterestUsd;
  state.market.oiDeltaPct=prevOI?((latestOI-prevOI)/prevOI)*100:0; state.market.series=(klinesData||[]).map(k=>Number(k[4]));
  pushSnapshot(state.market, imbalance); estimatePressureMap(state);
  const direction = imbalance > 0.08 ? 'buyers cleaner' : imbalance < -0.08 ? 'sellers cleaner' : 'book mixed';
  state.market.phase = `${direction} · ${state.market.dayChangePct.toFixed(2)}% 24h · ${state.market.sentimentLabel}`;
  const liveCount=[ticker,depth,openInterest,openInterestStats,fundingRate,klines,premium].filter(x=>x.ok).length;
  state.liveStatus.market = liveCount >= 5 ? 'Live' : liveCount >= 2 ? 'Partial' : 'Unavailable';
}

export async function syncScan(state) {
  const [ticker, premium] = await Promise.all([
    settle(fetchJson('https://fapi.binance.com/fapi/v1/ticker/24hr')),
    settle(fetchJson('https://fapi.binance.com/fapi/v1/premiumIndex')),
  ]);
  if (!ticker.ok) { state.scan = []; state.liveStatus.scan = 'Unavailable'; return; }
  const premiumMap = new Map((premium.ok ? premium.value : []).map(item => [String(item.symbol||''), item]));
  const rows = ticker.value
    .map(row => ({ row, symbol: displaySymbolFromContract(row.symbol) }))
    .filter(item => SCAN_SYMBOLS.includes(item.symbol))
    .map(({ row, symbol }) => {
      const p = premiumMap.get(row.symbol) || {};
      const { multiplier } = resolveFuturesSymbol(symbol);
      const change = Number(row.priceChangePercent||0); const funding = Number(p.lastFundingRate||0); const quoteVolume = Number(row.quoteVolume||0);
      const score = clamp(Math.round(50 + change * 2 + funding * 2500 + Math.log10(Math.max(quoteVolume,1)) * 3), 1, 99);
      return { symbol, price: displayPriceFromContract(Number(row.lastPrice||0), multiplier), change: change.toFixed(2), funding: (funding*100).toFixed(3), score, volume: quoteVolume };
    }).sort((a,b)=>b.score-a.score);
  state.scan = rows;
  state.liveStatus.scan = rows.length ? 'Live' : 'Unavailable';
}

function makeUiThrottle(onTick, wait = 800) {
  let timer = null; let pending = false;
  return () => {
    if (!onTick) return;
    if (timer) { pending = true; return; }
    onTick();
    timer = setTimeout(() => { timer = null; if (pending) { pending = false; onTick(); } }, wait);
  };
}

export function connectLiveStreams(state, onTick) {
  const resolved = resolveFuturesSymbol(state.symbol); const target = resolved.contractSymbol.toLowerCase(); const pushUi = makeUiThrottle(onTick, 800);
  if (state.streams.symbol === target && state.streams.mark && state.streams.liq) return;
  Object.values(state.streams).forEach(socket => { if (socket && socket.readyState <= 1) socket.close(); });
  state.streams.symbol = target;
  state.market.contractSymbol = resolved.contractSymbol;
  state.market.contractMultiplier = resolved.multiplier;
  try {
    const mark = new WebSocket(`wss://fstream.binance.com/ws/${target}@markPrice@1s`);
    mark.onopen = () => { state.liveStatus.market = state.liveStatus.market === 'Unavailable' ? 'Stream only' : 'Live + Stream'; pushUi(); };
    mark.onerror = () => { if (!state.market.lastPrice) state.liveStatus.market = 'Unavailable'; pushUi(); };
    mark.onmessage = e => { const d = JSON.parse(e.data); state.market.markPrice=Number(d.p||state.market.markPrice||0); state.market.indexPrice=Number(d.i||state.market.indexPrice||0); state.market.funding=Number(d.r||state.market.funding||0); state.market.nextFundingTime=Number(d.T||state.market.nextFundingTime||0); state.liveStatus.market='Live + Stream'; pushUi(); };
    state.streams.mark = mark;
  } catch {}
  try {
    const liq = new WebSocket(`wss://fstream.binance.com/ws/${target}@forceOrder`);
    liq.onopen = () => { state.liveStatus.liq = 'Live'; pushUi(); };
    liq.onerror = () => { if (!state.market.liqLong && !state.market.liqShort) state.liveStatus.liq = 'Unavailable'; pushUi(); };
    liq.onmessage = e => { const d = JSON.parse(e.data); const o = d?.o; if (!o) return; const usd = Number(o.ap || o.p || 0) * Number(o.q || 0); const isLongLiq = o.S === 'SELL'; const now = Date.now(); if (now - state.market.liqWindowStart > 15*60*1000) { state.market.liqWindowStart = now; state.market.liqLong = 0; state.market.liqShort = 0; } if (isLongLiq) state.market.liqLong += usd; else state.market.liqShort += usd; state.liveStatus.liq = 'Live'; pushUi(); };
    state.streams.liq = liq;
  } catch { state.liveStatus.liq = 'Unavailable'; }
}

export function refreshIntelFeed(state, intel) { state.intelFeed = summarizeRealFeed(state, intel); }

export function buildBoardData(state, intel) {
  const { symbol, market } = state;
  const momentumScore = clamp(Math.round(50 + market.dayChangePct * 2.2 + intel.I3 * 28), 1, 99);
  const crowdingScore = clamp(Math.round(50 + market.oiDeltaPct * 2 + market.funding * 2500), 1, 99);
  const rawTradability = Math.round(78 - market.spreadPct * 3000 - market.drift * 180 + market.depthM * 6 + Math.abs(intel.I3) * 16 - market.flips * 7);
  const tradabilityScore = clamp(intel.tradeable ? Math.max(rawTradability, 55) : Math.min(rawTradability, 49), 1, 99);
  const sentimentScore = clamp(Number(market.sentiment || 50), 1, 99);

  const dynamicFeed = tag => state.news.filter(item => item.tag === tag).slice(0,4).map(item => [item.title.slice(0,42), item.impact === 'High' ? 72 : item.impact === 'Medium' ? 56 : 38, `${item.source} · ${item.minsAgo}m ago`]);

  state.boardData = {
    crypto: { label:'Crypto', heading:`${symbol} futures pressure board`, items:[ [`${symbol} stable imbalance`, clamp(Math.round((intel.I3 + 1) * 50),1,99), `I3 median ${intel.I3.toFixed(2)} with ${market.flips} flips and drift ${market.drift.toFixed(2)}.`], [`${symbol} continuation quality`, momentumScore, `24h move ${market.dayChangePct.toFixed(2)}% with spread ${market.spreadPct.toFixed(5)}%.`], [`${symbol} crowding risk`, crowdingScore, `Funding ${(market.funding*100).toFixed(3)}% with OI ${market.oiDeltaPct >= 0 ? '+' : ''}${market.oiDeltaPct.toFixed(1)}%.`], [`${symbol} execution quality`, tradabilityScore, `Depth ${market.depthM.toFixed(2)}M. Tradeability gate is ${intel.tradeable ? 'open' : 'closed'}.`] ] },
    macro: { label:'Macro', heading:'Live regime monitor', items:[ ['Fear & Greed regime', sentimentScore, `${market.sentimentLabel}. Extreme readings matter most after vertical candles.`], ['Funding heat', clamp(Math.round(50 + market.funding * 3000),1,99), 'Rising funding without clean continuation increases trap risk.'], ['Open interest expansion', clamp(Math.round(50 + market.oiDeltaPct * 2.4),1,99), 'OI growth is healthy until breakouts start failing.'], ['Tradeability gate', tradabilityScore, 'Tighter spread, lower drift, and real depth improve execution quality.'] ] },
    stocks: { label:'Stocks', heading:'Cross-asset watchboard', items: dynamicFeed('Stocks').length ? dynamicFeed('Stocks') : [['Risk appetite read', clamp(Math.round(50 + market.dayChangePct * 1.8),1,99), 'Stronger crypto tape often coincides with broader risk appetite.']] },
    politics: { label:'Politics', heading:'Live regulation pulse', items: dynamicFeed('Politics').length ? dynamicFeed('Politics') : [['No live politics headlines', 34, 'Waiting for fresh sources.']] },
    war: { label:'War', heading:'Conflict transmission board', items: dynamicFeed('War').length ? dynamicFeed('War') : [['No live conflict headlines', 34, 'Waiting for fresh sources.']] },
    ai: { label:'AI', heading:'AI leadership monitor', items: dynamicFeed('AI').length ? dynamicFeed('AI') : [['No live AI headlines', 34, 'Waiting for fresh sources.']] },
  };
}
