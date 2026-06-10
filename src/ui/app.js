import { BOARD_TABS, TF_OPTIONS, state } from '../state.js';
import { escapeHtml, formatSpread, formatUsd, futureTime, minsLabel, saveLocal } from '../utils/format.js';
import { displayPriceFromContract } from '../utils/contracts.js';
import { buildAlerts, buildWorkspacePlan, computeTradeability, localReply } from '../logic/zaiEngine.js';
import { buildBoardData, connectLiveStreams, refreshIntelFeed, syncEvents, syncFearGreed, syncMarket, syncNews, syncScan } from '../services/market.js';
import { callOpenRouter } from '../services/ai.js';
import nebulaUrl from '../assets/living-nebula-red-enhanced.jpeg';

const $ = sel => document.querySelector(sel);

function sameKey(name, value) {
  if (state.lastRender[name] === value) return true;
  state.lastRender[name] = value;
  return false;
}

function layout() {
  return `
  <div class="shell" style="--nebula:url('${nebulaUrl}')">
    <section class="brand-banner"><div class="brand-title">ZAI</div><div class="brand-subtitle">LIVING INTELLIGENCE</div></section>
    <header class="verdict-dock dock-frame">
      <div class="mode-toggle"><button class="mode-btn ${state.mode==='manual'?'active':''}" data-mode="manual">Manual Mode</button><button class="mode-btn ${state.mode==='ai'?'active':''}" data-mode="ai">AI Mode</button></div>
      <div class="dock-title">ZAI VERDICT</div><div class="dock-orb"></div>
    </header>
    <section class="headline-panel shell-frame">
      <div class="headline-inner">
        <div><div class="kicker">Futures-first execution stack · Zawwar framework · live data + local intelligence</div><h1>ZAI PERSONAL TERMINAL</h1></div>
        <div class="headline-right"><div class="verdict-chip" id="verdict-chip">--</div><p id="verdict-text">Loading terminal verdict…</p></div>
      </div>
    </section>
    <main class="dashboard-grid">
      <aside class="side left-stack">
        <section class="panel shell-frame"><div class="panel-bar"><span>Execution Workspace</span><span class="status live">Manual</span></div>
          <div class="workspace-grid workspace-form">
            <label class="input-stack"><span>Equity USD</span><input id="equity-input" type="number" value="${state.workspace.equity}" /></label>
            <label class="input-stack"><span>Risk %</span><input id="risk-input" type="number" step="0.1" value="${state.workspace.riskPct}" /></label>
            <label class="input-stack"><span>Stop %</span><input id="stop-input" type="number" step="0.1" value="${state.workspace.stopPct}" /></label>
            <label class="input-stack"><span>Leverage</span><input id="leverage-input" type="number" value="${state.workspace.leverage}" /></label>
          </div>
          <div class="wallet-grid" id="workspace-grid"></div>
        </section>
        <section class="panel shell-frame"><div class="panel-bar"><span>Intelligence Board</span><span class="status alt" id="board-badge">CRYPTO</span></div><div class="tab-row" id="board-tabs"></div><div class="section-copy" id="board-heading"></div><div class="board-list" id="board-list"></div></section>
        <section class="panel shell-frame"><div class="panel-bar"><span>Latest News</span><span class="status soft" id="news-status">${state.liveStatus.news}</span></div><div class="news-list" id="news-list"></div></section>
        <section class="panel shell-frame"><div class="panel-bar"><span>Upcoming Events</span><span class="status warn" id="events-status">${state.liveStatus.events}</span></div><div class="events-list" id="events-list"></div></section>
      </aside>
      <section class="center-stack">
        <section class="panel shell-frame">
          <div class="panel-bar panel-bar-large"><span>AI Prediction Report</span><span class="status bright">Command Deck</span></div>
          <div class="hero-controls hero-controls-wide">
            <label class="api-box"><span>Enter Your API Key</span><input id="api-input" type="password" placeholder="Paste OpenRouter key or leave blank for local intelligence" value="${escapeHtml(state.apiKey)}" /></label>
            <label class="api-box compact-box"><span>Focus Symbol</span><input id="symbol-input" type="text" value="${escapeHtml(state.symbol)}" /></label>
            <div class="hero-buttons hero-buttons-wide"><button class="action-btn" id="save-key-btn">Save Key</button><button class="action-btn" id="clear-key-btn">Clear Key</button><button class="action-btn primary" id="analysis-btn">Generate Analysis</button></div>
          </div>
          <div class="tab-row compact" id="tf-tabs"></div>
          <div class="metric-strip" id="metric-strip"></div>
          <div class="report-layout">
            <article class="report-card inner-frame"><div class="panel-subhead"><span>ZAI Summary</span><span class="micro-tag">Z-PAS logic</span></div><p class="report-copy" id="report-copy"></p><div class="signal-row" id="signal-row"></div></article>
            <article class="report-card inner-frame analyst-box"><div class="panel-subhead"><span>AI Analyst</span><span class="status soft" id="analysis-status">${state.aiStatus}</span></div><p class="analysis-copy" id="analysis-copy">Enter a user API key and generate a read, or stay in local mode for rules-only interpretation.</p></article>
          </div>
          <div class="intel-grid" id="intel-grid"></div>
        </section>
        <section class="panel shell-frame"><div class="panel-bar"><span>Chat with ZAI</span><span class="status alt" id="chat-label">${state.apiKey ? 'OpenRouter' : 'Local Intelligence'}</span></div><div class="chat-log" id="chat-log"></div><div class="chat-row"><input id="chat-input" type="text" placeholder="Ask about bias, tradability, or liquidation risk…" /><button class="action-btn primary" id="chat-send-btn">Send</button></div></section>
        <section class="panel shell-frame"><div class="panel-bar"><span>What To Track Before Predicting Price</span><span class="status soft">Checklist</span></div><div class="checklist-grid"><article class="inner-frame checklist-item"><div class="panel-subhead"><span>Tradeability Gate</span><span class="micro-tag">Execution</span></div><ul><li>Stable imbalance, not one aggressive snapshot</li><li>Spread stays below cost threshold</li><li>Near-touch depth is real, not decorative</li><li>Flips and drift do not destroy the edge</li></ul></article><article class="inner-frame checklist-item"><div class="panel-subhead"><span>Execution Context</span><span class="micro-tag">Risk</span></div><ul><li>Higher timeframe agrees with the trigger</li><li>Funding and OI are not screaming trap</li><li>Pressure map is clear above and below</li><li>Hard event is not seconds away</li></ul></article></div></section>
        <section class="panel shell-frame"><div class="panel-bar"><span>Live Intelligence Feed</span><span class="status live">Real + Derived</span></div><div class="intel-feed" id="intel-feed"></div></section>
      </section>
      <aside class="side right-stack">
        <section class="panel shell-frame"><div class="panel-bar"><span>Terminal Time</span><span class="status live">Local</span></div><div class="clock-wrap"><div class="analog"><span class="hand hour"></span><span class="hand minute"></span><span class="hand second"></span><span class="clock-core"></span></div><div><div class="digital-time" id="digital-time"></div><div class="digital-date" id="digital-date"></div></div></div></section>
        <section class="panel shell-frame"><div class="panel-bar"><span>Liquidation Tape</span><span class="status danger" id="liq-status">${state.liveStatus.liq}</span></div><div class="liq-grid"><article class="stat-card inner-frame"><label>Long Pressure</label><strong id="liq-long"></strong></article><article class="stat-card inner-frame"><label>Short Pressure</label><strong id="liq-short"></strong></article></div><div class="sheet-list" id="sheet-list"></div></section>
        <section class="panel shell-frame"><div class="panel-bar"><span>Focus Coin Monitor</span><span class="status alt" id="focus-badge">${escapeHtml(state.symbol)}</span></div><div class="focus-tools"><label class="api-box compact-box"><span>Coin</span><input id="symbol-input-side" type="text" value="${escapeHtml(state.symbol)}" /></label><div class="tab-row compact" id="tf-tabs-side"></div></div><div class="chart-frame inner-frame"><canvas id="focus-chart" width="540" height="240"></canvas><div class="chart-copy"><div class="chart-price" id="chart-price"></div><div class="chart-note" id="chart-note"></div></div></div></section>
        <section class="panel shell-frame"><div class="panel-bar"><span>Market Scan</span><span class="status soft" id="scan-status">${state.liveStatus.scan}</span></div><div class="scan-list" id="scan-list"></div></section>
        <section class="panel shell-frame"><div class="panel-bar"><span>Terminal Alerts</span><span class="status warn">Watch</span></div><div class="alerts-list" id="alerts-list"></div></section>
      </aside>
    </main>
  </div>`;
}

function renderClock() {
  const now = new Date();
  const clockKey = now.toLocaleTimeString();
  if (sameKey('clockKey', clockKey)) return;
  $('#digital-time').textContent = now.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  $('#digital-date').textContent = now.toLocaleDateString([], { weekday:'short', month:'short', day:'numeric', year:'numeric' });
  const hour = now.getHours() % 12 + now.getMinutes()/60;
  const minute = now.getMinutes() + now.getSeconds()/60;
  const second = now.getSeconds();
  document.querySelector('.hand.hour').style.transform = `translateX(-50%) rotate(${hour*30}deg)`;
  document.querySelector('.hand.minute').style.transform = `translateX(-50%) rotate(${minute*6}deg)`;
  document.querySelector('.hand.second').style.transform = `translateX(-50%) rotate(${second*6}deg)`;
}

function renderWorkspace() {
  const plan = buildWorkspacePlan(state);
  $('#workspace-grid').innerHTML = [['Risk capital',formatUsd(plan.riskUsd)],['Position notional',formatUsd(plan.positionNotional)],['Margin used',formatUsd(plan.marginUsed)],['Size status',plan.sizeStatus]].map(([l,v])=>`<div class="wallet-cell"><span>${l}</span><strong>${escapeHtml(v)}</strong></div>`).join('');
}
function renderBoard() {
  const pack = state.boardData[state.board];
  const key = JSON.stringify([state.board, pack]); if (sameKey('boardKey', key)) return;
  $('#board-badge').textContent = pack.label.toUpperCase(); $('#board-heading').textContent = pack.heading;
  $('#board-tabs').innerHTML = BOARD_TABS.map(tab=>`<button class="tab-btn ${tab===state.board?'active':''}" data-board="${tab}">${tab.toUpperCase()}</button>`).join('');
  $('#board-list').innerHTML = pack.items.map(([l,p,n])=>`<article class="board-item"><div class="board-top"><strong>${escapeHtml(l)}</strong><span>${p}%</span></div><div class="bar"><span style="width:${p}%"></span></div><p>${escapeHtml(n)}</p></article>`).join('');
}
function renderNews() {
  const key = JSON.stringify([state.liveStatus.news, state.news.map(n=>[n.title,n.minsAgo,n.source]).slice(0,12)]); if (sameKey('newsKey', key)) return;
  $('#news-status').textContent = state.liveStatus.news;
  $('#news-list').innerHTML = state.news.length ? state.news.map(item=>`<article class="feed-item"><div><div class="feed-tag">${escapeHtml(item.tag)}</div><strong>${escapeHtml(item.title)}</strong><p class="feed-meta">${escapeHtml(item.source)} · ${escapeHtml(item.impact)} impact</p></div><a class="feed-link" href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer">${item.minsAgo}m ago</a></article>`).join('') : `<article class="feed-item empty"><div><div class="feed-tag">Status</div><strong>No live headlines reached the terminal yet.</strong><p class="feed-meta">Check network, wait for sync, or keep using cached context.</p></div></article>`;
}
function renderEvents() {
  const key = JSON.stringify([state.liveStatus.events, state.events.map(e=>[e.title,e.minsAhead,e.source]).slice(0,8)]); if (sameKey('eventsKey', key)) return;
  $('#events-status').textContent = state.liveStatus.events;
  $('#events-list').innerHTML = state.events.length ? state.events.map(item=>`<article class="feed-item"><div><div class="feed-tag">${escapeHtml(item.tag)}</div><strong>${escapeHtml(item.title)}</strong><p class="feed-meta">${escapeHtml(item.source)} · ${escapeHtml(item.impact)} impact</p></div><div class="event-side"><span>${futureTime(item.minsAhead)}</span><span>${minsLabel(item.minsAhead)}</span></div></article>`).join('') : `<article class="feed-item empty"><div><div class="feed-tag">Status</div><strong>No event window reached the terminal yet.</strong><p class="feed-meta">Funding, macro, or session markers will appear here.</p></div></article>`;
}
function renderReport() {
  const intel = computeTradeability(state);
  const key = JSON.stringify([intel.bias,intel.verdict,intel.quality,intel.I.toFixed(3),intel.I3.toFixed(3),state.market.flips,state.market.drift.toFixed(3),state.market.depthM.toFixed(2),state.market.spreadPct.toFixed(6),state.aiStatus,state.aiAnalysis]);
  if (sameKey('reportKey', key)) return;
  $('#verdict-chip').textContent = `${intel.bias} · ${intel.quality}`;
  $('#verdict-text').textContent = intel.summary;
  $('#report-copy').textContent = `${intel.summary} Action code: ${intel.verdict}. Read stable imbalance first, then confirm cost, depth, crowding, and event timing before entering.`;
  $('#signal-row').innerHTML = [`Bias: ${intel.bias}`,`Action: ${intel.verdict}`,`Quality: ${intel.quality}`,`Crowding: ${intel.crowding}`].map(x=>`<span>${escapeHtml(x)}</span>`).join('');
  $('#metric-strip').innerHTML = [['I',intel.I.toFixed(2)],['I stable',intel.IStable.toFixed(2)],['I3 median',intel.I3.toFixed(2)],['Flips',String(state.market.flips)],['Drift',state.market.drift.toFixed(2)],['MAD',state.market.mad.toFixed(2)],['Spread %',formatSpread(state.market.spreadPct)],['Depth',`${state.market.depthM.toFixed(2)}M`]].map(([l,v])=>`<article class="metric-pill"><label>${l}</label><strong>${escapeHtml(v)}</strong></article>`).join('');
  $('#intel-grid').innerHTML = [['Funding + OI',`${(state.market.funding*100).toFixed(3)}% funding · OI ${state.market.oiDeltaPct>=0?'+':''}${state.market.oiDeltaPct.toFixed(1)}%`],['Liquidity pressure',`Bid-side ${state.market.bookBidNotional>=state.market.bookAskNotional?'pressure':'resistance'} dominates the top-10 band.`],['Stability read',`${state.market.flips} flips · drift ${state.market.drift.toFixed(2)} · persist ${state.market.persist}%`],['Event sensitivity','Macro window can amplify or invalidate a setup in seconds.']].map(([l,v])=>`<article class="intel-item"><label>${l}</label><strong>${escapeHtml(v)}</strong></article>`).join('');
  $('#analysis-status').textContent = state.aiStatus; $('#analysis-copy').textContent = state.aiAnalysis || 'Enter a user API key and generate a read, or stay in local mode for rules-only interpretation.';
}
function renderLiq() {
  const key = JSON.stringify([state.liveStatus.liq,state.market.liqLong.toFixed(0),state.market.liqShort.toFixed(0),state.market.longBreak,state.market.shortBreak]); if (sameKey('liqKey', key)) return;
  $('#liq-status').textContent = state.liveStatus.liq; $('#liq-long').textContent = formatUsd(state.market.liqLong,true); $('#liq-short').textContent = formatUsd(state.market.liqShort,true);
  $('#sheet-list').innerHTML = [[`If ${state.symbol} loses ${state.market.longBreak}`,'Higher chance of long cascade and fast sentiment flush.'],[`If ${state.symbol} breaks ${state.market.shortBreak}`,'Short squeeze probability rises with momentum expansion.'],[`If long pressure exceeds ${formatUsd(state.market.liqLong*1.03,true)}`,'Look for relief bounce after a panic sweep.'],[`If short pressure exceeds ${formatUsd(state.market.liqShort*1.03,true)}`,'Trend can overshoot before cooling.']].map(([t,b])=>`<article class="sheet-item"><strong>${escapeHtml(t)}</strong><p>${escapeHtml(b)}</p></article>`).join('');
}
function renderChart() {
  const series = state.market.series || []; const focusPrice = displayPriceFromContract(state.market.lastPrice || 0, state.market.contractMultiplier); const key = JSON.stringify([state.symbol,state.timeframe,formatUsd(focusPrice),state.market.phase,series.length?[series[0],series[Math.floor(series.length/2)],series.at(-1),series.length]:[]]);
  if (sameKey('chartKey', key)) { $('#chart-price').textContent = formatUsd(focusPrice); $('#chart-note').textContent = `${state.symbol} · ${state.timeframe.toUpperCase()} · ${state.market.phase}`; return; }
  const canvas=$('#focus-chart'); const ctx=canvas.getContext('2d'); const w=canvas.width,h=canvas.height; ctx.clearRect(0,0,w,h); if (!series.length) return;
  const min=Math.min(...series), max=Math.max(...series), pad=18; ctx.strokeStyle='rgba(255,255,255,.07)';
  for(let i=0;i<4;i++){const y=pad+((h-pad*2)/3)*i; ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(w-pad,y); ctx.stroke();}
  ctx.beginPath(); series.forEach((v,i)=>{const x=pad+(i/Math.max(series.length-1,1))*(w-pad*2); const y=h-pad-((v-min)/((max-min)||1))*(h-pad*2); i?ctx.lineTo(x,y):ctx.moveTo(x,y);}); ctx.strokeStyle='rgba(170,246,255,.95)'; ctx.lineWidth=2; ctx.stroke();
  $('#chart-price').textContent = formatUsd(focusPrice); $('#chart-note').textContent = `${state.symbol} · ${state.timeframe.toUpperCase()} · ${state.market.phase}`;
}
function renderIntelFeed() { const key = JSON.stringify(state.intelFeed); if (sameKey('intelKey', key)) return; $('#intel-feed').innerHTML = state.intelFeed.map(item=>`<article class="intel-feed-item inner-frame"><div class="panel-subhead"><span>${escapeHtml(item.title)}</span><span class="micro-tag">${escapeHtml(item.kind)}</span></div><p>${escapeHtml(item.summary)}</p><strong>${escapeHtml(item.suggestion)}</strong></article>`).join(''); }
function renderChat() { const key = JSON.stringify([state.apiKey ? 'OpenRouter' : 'Local Intelligence', state.chat]); if (sameKey('chatKey', key)) return; $('#chat-label').textContent = state.apiKey ? 'OpenRouter' : 'Local Intelligence'; $('#chat-log').innerHTML = state.chat.map(item=>`<article class="bubble ${item.role==='user'?'user':'zai'}"><span>${item.role==='user'?'You':'ZAI'}</span><p>${escapeHtml(item.text)}</p></article>`).join(''); $('#chat-log').scrollTop = $('#chat-log').scrollHeight; }
function renderScanAndAlerts() {
  const scanKey = JSON.stringify([state.liveStatus.scan, state.scan]); if (!sameKey('scanKey', scanKey)) { $('#scan-status').textContent = state.liveStatus.scan; $('#scan-list').innerHTML = state.scan.length ? state.scan.map(item=>`<article class="scan-item"><div><strong>${item.symbol}</strong><span>${item.score}</span></div><p>${formatUsd(item.price)} · ${item.change}% · funding ${item.funding}%</p></article>`).join('') : '<article class="scan-item empty"><strong>No scan data yet.</strong><p>Waiting for market scan sync.</p></article>'; }
  const intel = computeTradeability(state); state.alerts = buildAlerts(state, intel); const alertsKey = JSON.stringify(state.alerts); if (!sameKey('alertsKey', alertsKey)) $('#alerts-list').innerHTML = state.alerts.map(a=>`<article class="alert-item ${a.tone}">${escapeHtml(a.text)}</article>`).join('');
}
function renderTfTabs() { const html = TF_OPTIONS.map(tf=>`<button class="tab-btn ${tf===state.timeframe?'active':''}" data-tf="${tf}">${tf.toUpperCase()}</button>`).join(''); $('#tf-tabs').innerHTML = html; $('#tf-tabs-side').innerHTML = html; }

function refreshCoreUi() { const intel = computeTradeability(state); buildBoardData(state, intel); refreshIntelFeed(state, intel); renderReport(); renderLiq(); renderIntelFeed(); renderChart(); renderClock(); renderScanAndAlerts(); }
function refreshFullUi() { const intel = computeTradeability(state); buildBoardData(state, intel); refreshIntelFeed(state, intel); renderWorkspace(); renderBoard(); renderNews(); renderEvents(); renderReport(); renderLiq(); renderIntelFeed(); renderChat(); renderChart(); renderTfTabs(); renderClock(); renderScanAndAlerts(); }

async function generateAnalysis() {
  const intel = computeTradeability(state); state.apiKey = $('#api-input').value.trim(); if (state.apiKey) localStorage.setItem('zai_openrouter_key', state.apiKey);
  if (!state.apiKey) { state.aiStatus='Local'; state.aiAnalysis=localReply(state,'bias tradable risk liquid'); state.chat.push({ role:'zai', text:state.aiAnalysis }); renderReport(); renderChat(); return; }
  state.aiStatus='Analyzing'; state.aiAnalysis='AI is reading live market state, crowding, event windows, and headline context before generating a structured futures read.'; renderReport();
  try {
    const answer = await callOpenRouter(state.apiKey, [
      { role:'system', content:'You are ZAI, a professional futures execution analyst. Think carefully. Return 4 short blocks titled: Current read, Why the verdict, Main risk, Best action now. Use the data only. No hype, no guarantees.' },
      { role:'user', content:`Focus symbol ${state.symbol}. Timeframe ${state.timeframe}. Price ${state.market.lastPrice}. 24h move ${state.market.dayChangePct.toFixed(2)}%. Raw I ${intel.I.toFixed(4)}. I stable ${intel.IStable.toFixed(4)}. I3 ${intel.I3.toFixed(4)}. Flips ${state.market.flips}. Drift ${state.market.drift.toFixed(4)}. MAD ${state.market.mad.toFixed(4)}. Spread ${formatSpread(state.market.spreadPct)}. Depth ${state.market.depthM.toFixed(2)}M. Funding ${(state.market.funding*100).toFixed(4)}%. OI delta ${state.market.oiDeltaPct.toFixed(2)}%. Sentiment ${state.market.sentimentLabel} ${state.market.sentiment}. Verdict ${intel.bias} / ${intel.quality} / ${intel.verdict}. Latest headline ${state.news[0]?.title || 'none'}. Next event ${state.events[0]?.title || 'none'} in ${state.events[0]?.minsAhead || 0} minutes. Market scan leaders: ${state.scan.slice(0,3).map(x=>`${x.symbol} ${x.score}`).join(', ')}.` },
    ]);
    state.aiStatus='AI Ready'; state.aiAnalysis=answer; state.chat.push({ role:'zai', text:answer });
  } catch (error) { state.aiStatus='Error'; state.aiAnalysis=error?.message || 'AI request failed.'; state.chat.push({ role:'zai', text:`AI error: ${state.aiAnalysis}` }); }
  renderReport(); renderChat();
}

async function handleChatSend() {
  const value = $('#chat-input').value.trim(); if (!value) return; $('#chat-input').value=''; state.chat.push({ role:'user', text:value }); renderChat();
  state.apiKey = $('#api-input').value.trim(); if (state.apiKey) localStorage.setItem('zai_openrouter_key', state.apiKey);
  if (!state.apiKey) { state.chat.push({ role:'zai', text:localReply(state, value) }); renderChat(); return; }
  try {
    const intel = computeTradeability(state);
    const answer = await callOpenRouter(state.apiKey, [
      { role:'system', content:'You are ZAI, a concise but thoughtful futures terminal assistant. Answer directly and use the current market context.' },
      { role:'user', content:`Symbol ${state.symbol}. Timeframe ${state.timeframe}. Price ${state.market.lastPrice}. I ${intel.I.toFixed(3)}. I3 ${intel.I3.toFixed(3)}. Flips ${state.market.flips}. Drift ${state.market.drift.toFixed(3)}. Spread ${formatSpread(state.market.spreadPct)}. Depth ${state.market.depthM.toFixed(2)}M. Funding ${(state.market.funding*100).toFixed(3)}%. OI ${state.market.oiDeltaPct.toFixed(1)}%. Sentiment ${state.market.sentiment}. Verdict ${intel.bias}/${intel.verdict}. Question: ${value}` },
    ]);
    state.chat.push({ role:'zai', text:answer });
  } catch (error) { state.chat.push({ role:'zai', text:`AI error: ${error?.message || 'request failed'}` }); }
  renderChat();
}

function bindEvents(root) {
  root.addEventListener('click', event => {
    const modeBtn = event.target.closest('[data-mode]'); if (modeBtn) { state.mode=modeBtn.dataset.mode; document.querySelectorAll('.mode-btn').forEach(btn=>btn.classList.toggle('active', btn.dataset.mode===state.mode)); return; }
    const boardBtn = event.target.closest('[data-board]'); if (boardBtn) { state.board=boardBtn.dataset.board; renderBoard(); return; }
    const tfBtn = event.target.closest('[data-tf]'); if (tfBtn) { state.timeframe=tfBtn.dataset.tf; localStorage.setItem('zai_timeframe', state.timeframe); syncAll(); return; }
    if (event.target.id === 'save-key-btn') { state.apiKey=$('#api-input').value.trim(); localStorage.setItem('zai_openrouter_key', state.apiKey); state.aiStatus = state.apiKey ? 'Ready' : 'Idle'; renderReport(); return; }
    if (event.target.id === 'clear-key-btn') { state.apiKey=''; state.aiStatus='Idle'; state.aiAnalysis=''; localStorage.removeItem('zai_openrouter_key'); $('#api-input').value=''; renderReport(); return; }
    if (event.target.id === 'analysis-btn') generateAnalysis();
    if (event.target.id === 'chat-send-btn') handleChatSend();
  });
  const syncSymbol = value => { state.symbol=(value.trim()||'BTC').toUpperCase(); saveLocal('zai_symbol', state.symbol); $('#symbol-input').value=state.symbol; $('#symbol-input-side').value=state.symbol; syncAll(); };
  $('#symbol-input').addEventListener('change', e=>syncSymbol(e.target.value));
  $('#symbol-input-side').addEventListener('change', e=>syncSymbol(e.target.value));
  $('#chat-input').addEventListener('keydown', e=>{ if (e.key==='Enter') handleChatSend(); });
  [['equity-input','equity'],['risk-input','riskPct'],['stop-input','stopPct'],['leverage-input','leverage']].forEach(([id,key])=>{ $('#'+id).addEventListener('input',e=>{ state.workspace[key]=Number(e.target.value||0); saveLocal('zai_workspace', state.workspace); renderWorkspace(); }); });
}

export async function syncAll() {
  await Promise.allSettled([syncFearGreed(state), syncMarket(state), syncNews(state), syncEvents(state), syncScan(state)]);
  connectLiveStreams(state, refreshCoreUi);
  refreshFullUi();
}

export function mount(root) {
  root.innerHTML = layout();
  bindEvents(root);
  refreshFullUi();
  syncAll();
  setInterval(renderClock, 1000);
  setInterval(syncAll, 120000);
}
