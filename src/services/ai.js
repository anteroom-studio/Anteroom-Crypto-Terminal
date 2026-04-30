export async function callOpenRouter(apiKey, messages) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Anteroom Crypto Terminal',
      'X-OpenRouter-Title': 'Anteroom Crypto Terminal',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages,
      temperature: 0.2,
      max_tokens: 350,
    }),
  });

  if (!res.ok) {
    let detail = '';
    try { const err = await res.json(); detail = err?.error?.message || err?.message || ''; } catch {}
    throw new Error(detail ? `OpenRouter request failed: ${res.status} - ${detail}` : `OpenRouter request failed: ${res.status}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || 'No response returned.';
}
