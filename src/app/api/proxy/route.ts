import type { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  // The local AI proxy is an experimental hook and is disabled by default to
  // avoid exposing an unauthenticated relay to the local Ollama instance.
  // Enable it explicitly with ENABLE_OLLAMA_PROXY=true (e.g. for local dev).
  if (process.env.ENABLE_OLLAMA_PROXY !== 'true') {
    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }

  const type = req.nextUrl.searchParams.get('type');
  if (type !== 'pillama') {
    return new Response(JSON.stringify({ error: 'Unsupported proxy type' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const defaultTarget = 'http://127.0.0.1:11434/v1/completions';
  const configuredUrl = process.env.OLLAMA_PROXY_URL?.trim() || defaultTarget;
  let targetUrl = configuredUrl;
  try {
    const parsed = new URL(configuredUrl);
    if (configuredUrl !== defaultTarget) {
      parsed.searchParams.set('type', 'pillama');
    }
    targetUrl = parsed.toString();
  } catch {
    targetUrl = configuredUrl;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    const headers = new Headers();
    headers.set('content-type', res.headers.get('content-type') || 'application/json');
    return new Response(text, { status: res.status, headers });
  } catch (error) {
    logger.error('Proxy error occurred');
    return new Response(JSON.stringify({ error: 'Proxy request failed' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
}
