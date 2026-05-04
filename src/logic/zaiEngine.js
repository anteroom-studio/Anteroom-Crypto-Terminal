import { mad, median, formatSpread } from '../utils/format.js';

export function pushSnapshot(market, imbalance) {
  market.snapshots = [...market.snapshots.slice(-8), Number(imbalance.toFixed(4))];
  const stable = median(market.snapshots);
  market.stableHistory = [...market.stableHistory.slice(-4), stable];
  market.flips = market.snapshots.slice(1).reduce((count, value, idx) => count + ((Math.sign(value) && Math.sign(market.snapshots[idx]) && Math.sign(value) !== Math.sign(market.snapshots[idx])) ? 1 : 0), 0);
  const mean = market.snapshots.reduce((sum, v) => sum + v, 0) / (market.snapshots.length || 1);
  market.drift = Math.sqrt(market.snapshots.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (market.snapshots.length || 1));
  market.persist = Math.round((Math.max(market.snapshots.filter(v => v > 0).length, market.snapshots.filter(v => v < 0).length) / (market.snapshots.length || 1)) * 100);
  market.mad = mad(market.snapshots);
}

export function computeTradeability(state) {
  const { market, symbol } = state;
  const I = market.bookBidNotional + market.bookAskNotional === 0 ? 0 : (market.bookBidNotional - market.bookAskNotional) / (market.bookBidNotional + market.bookAskNotional);
  const IStable = median(market.snapshots);
  const I3 = median(market.stableHistory);
  const isMajor = ['BTC','ETH','SOL','BNB'].includes(symbol);
  const maxSpread = isMajor ? 0.06 : 0.10;
  const minDepth = isMajor ? 1.2 : 0.45;
  const maxFlips = 2;
  const maxDrift = isMajor ? 0.16 : 0.20;
  const tradeable = Math.abs(I3) >= 0.12 && market.spreadPct <= maxSpread && market.depthM >= minDepth && market.flips <= maxFlips && market.drift <= maxDrift;
  const crowded = market.funding > 0.0008 || market.sentiment >= 78 || market.oiDeltaPct >= 8;

  let bias='Neutral', verdict='WAIT', summary='The tape is live, but there is no clean edge big enough for aggression.', quality='WEAK';
  if (tradeable && I3 >= 0.18) { bias='Bullish Control'; verdict=crowded?'ENTER SMALL':'ENTER'; quality=crowded?'OK':'HEALTHY'; summary='Stable buyer pressure survives refreshes. Buyers control the near-touch auction and execution quality is acceptable.'; }
  else if (tradeable && I3 <= -0.18) { bias='Bearish Pressure'; verdict='ENTER SMALL'; quality='OK'; summary='Offer-side pressure is stable enough to matter. Failed bounces are cleaner than reactive breakdown chasing.'; }
  else if (Math.abs(I) >= 0.18 && market.flips >= 3) { bias='Spoof / Chop Risk'; verdict='SKIP'; quality='NO_TRADE'; summary='A single snapshot looks strong, but sign flips and instability suggest noise, spoofing, or chop.'; }
  else if (market.depthM < minDepth || market.spreadPct > maxSpread) { bias='Thin Conditions'; verdict='SKIP'; quality='NO_TRADE'; summary='Cost or depth is weak enough to damage execution quality. The edge may exist, but it is not efficiently tradable.'; }

  return { I, IStable, I3, tradeable, bias, verdict, quality, summary, crowding: crowded ? 'Elevated' : 'Contained', thresholds: { minDepth, maxSpread } };
}

export function buildWorkspacePlan(state) {
  const { equity, riskPct, stopPct, leverage } = state.workspace;
  const riskUsd = equity * (riskPct / 100);
  const stopFraction = Math.max(stopPct, 0.05) / 100;
  const positionNotional = stopFraction ? riskUsd / stopFraction : 0;
  const marginUsed = leverage ? positionNotional / leverage : positionNotional;
  return { riskUsd, stopFraction, positionNotional, marginUsed, sizeStatus: marginUsed <= equity ? 'Within plan' : 'Oversized' };
}

export function estimatePressureMap(state) {
  const { market, symbol } = state;
  const price = market.lastPrice || 0;
  const atrGuess = Math.max(price * 0.0035, symbol === 'BTC' ? 140 : symbol === 'ETH' ? 10 : 2);
  const oiUsd = market.openInterestUsd || 0;
  market.liqLong = oiUsd * (0.24 + Math.max(0, -median(market.stableHistory)) * 0.4 + Math.max(0, market.oiDeltaPct) * 0.005);
  market.liqShort = oiUsd * (0.22 + Math.max(0, median(market.stableHistory)) * 0.4 + Math.max(0, market.oiDeltaPct) * 0.004);
  market.longBreak = Math.round(price - atrGuess);
  market.shortBreak = Math.round(price + atrGuess * 1.45);
}

export function buildAlerts(state, intel) {
  const alerts = [];
  if (!intel.tradeable) alerts.push({ tone: 'warn', text: `Tradeability gate is closed on ${state.symbol}. Depth ${state.market.depthM.toFixed(2)}M is below the efficient threshold.` });
  if (state.market.sentiment <= 25) alerts.push({ tone: 'warn', text: `Sentiment is ${state.market.sentimentLabel}. Expect emotional moves and fake continuation.` });
  if (state.events[0]?.minsAhead <= 90) alerts.push({ tone: 'soft', text: `${state.events[0].title} is close. Reduce size before event risk.` });
  if (state.scan[0]) alerts.push({ tone: 'live', text: `Top scan: ${state.scan[0].symbol} ${state.scan[0].score} score with ${state.scan[0].change}% 24h.` });
  return alerts.slice(0,4);
}

export function summarizeRealFeed(state, intel) {
  const head = state.news[0];
  const event = state.events[0];
  const lines = [
    { kind:'market', title:`${state.symbol} book state`, summary:`I3 ${intel.I3.toFixed(2)}, spread ${formatSpread(state.market.spreadPct)}, depth ${state.market.depthM.toFixed(2)}M.`, suggestion: intel.tradeable ? `Tradeability is open. ${intel.verdict} only if the higher timeframe agrees.` : `Tradeability is shut. Respect ${intel.quality} and wait for cost/depth to improve.` },
    { kind:'crowding', title:'Crowding read', summary:`Funding ${(state.market.funding*100).toFixed(3)}% with OI ${state.market.oiDeltaPct >= 0 ? '+' : ''}${state.market.oiDeltaPct.toFixed(1)}% and sentiment ${state.market.sentimentLabel}.`, suggestion: state.market.oiDeltaPct > 5 && state.market.funding > 0 ? 'Long crowding is rising; avoid chasing vertical candles.' : 'Crowding is not yet extreme, but keep checking after each impulse.' },
  ];
  if (head) lines.push({ kind:'news', title:head.title, summary:`${head.tag} · ${head.source} · ${head.minsAgo}m ago · ${head.impact} impact.`, suggestion: head.impact === 'High' ? 'Treat this as tape-moving information. Let price confirm before acting.' : 'Useful context, but it should not override book quality on its own.' });
  if (event) lines.push({ kind:'event', title:event.title, summary:`${event.tag} · ${event.source} · starts in ${event.minsAhead}m.`, suggestion: event.impact === 'High' ? 'Avoid fresh entries just before release; wait for the first reaction to settle.' : 'Keep size smaller into the window and re-check the book after release.' });
  lines.push({ kind:'execution', title:'Execution reminder', summary:'Structure first, then stable imbalance, then cost/depth, then crowding, then event risk.', suggestion:'If one layer breaks, downgrade size or skip the trade.' });
  return lines;
}

export function localReply(state, prompt) {
  const q = prompt.toLowerCase();
  const intel = computeTradeability(state);
  if (q.includes('bias')) return `Bias is ${intel.bias} with action ${intel.verdict}.`;
  if (q.includes('tradable')) return `Tradeability is ${intel.tradeable ? 'on' : 'off'} because spread is ${formatSpread(state.market.spreadPct)}, depth is ${state.market.depthM.toFixed(2)}M, flips are ${state.market.flips}, and I3 is ${intel.I3.toFixed(2)}.`;
  if (q.includes('risk')) return `Risk reads ${state.market.spreadPct <= intel.thresholds.maxSpread ? 'tradable on cost' : 'too expensive on spread'}, with crowding ${intel.crowding.toLowerCase()}.`;
  if (q.includes('liquid')) return `Pressure map: below ${state.market.longBreak} long pain increases; above ${state.market.shortBreak} short squeeze pressure rises.`;
  return 'Read the sequence: higher-timeframe structure first, then stable imbalance, then spread/depth, then crowding and event timing.';
}
