(() => {
  if (window.__anteroomRouterReady) return;
  window.__anteroomRouterReady = true;

  const originalFetch = window.fetch.bind(window);
  const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

  const providerFromToken = (token) => {
    if (/^sk-or-/i.test(token)) return 'openrouter';
    if (/^gsk_/i.test(token)) return 'groq';
    if (/^sk-/i.test(token)) return 'openai';
    return 'openrouter';
  };

  const getToken = (init) => {
    const headers = new Headers(init?.headers || {});
    return (headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  };

  const getBody = (init) => {
    try { return JSON.parse(init?.body || '{}'); } catch { return {}; }
  };

  window.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url;
    if (url !== OPENROUTER_URL) return originalFetch(input, init);

    const token = getToken(init);
    const provider = providerFromToken(token);
    const body = getBody(init);

    if (!token || provider === 'openrouter') return originalFetch(input, init);

    if (provider === 'openai') {
      return originalFetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...body, model: 'gpt-4.1-mini' }),
      });
    }

    if (provider === 'groq') {
      return originalFetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...body, model: 'llama-3.3-70b-versatile' }),
      });
    }

    return originalFetch(input, init);
  };
})();
