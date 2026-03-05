import { NextRequest, NextResponse } from 'next/server';

// ─── In-memory rate limiter ──────────────────────────────────────────
// Authenticated (token present): 120 req / 10s per IP
// Unauthenticated:                30 req / 10s per IP
const _rl = new Map<string, { count: number; resetAt: number }>();
const RL_WINDOW = 10_000;
const RL_MAX_ANON = 30;
const RL_MAX_AUTH = 120;

// Evict stale entries every 60s to avoid memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of _rl) {
        if (now > entry.resetAt) _rl.delete(key);
    }
}, 60_000);

function isRateLimited(ip: string, hasToken: boolean): boolean {
    const now = Date.now();
    const key = `${ip}:${hasToken ? 'auth' : 'anon'}`;
    const max = hasToken ? RL_MAX_AUTH : RL_MAX_ANON;
    const entry = _rl.get(key);
    if (!entry || now > entry.resetAt) {
        _rl.set(key, { count: 1, resetAt: now + RL_WINDOW });
        return false;
    }
    if (entry.count >= max) return true;
    entry.count++;
    return false;
}

export async function POST(request: NextRequest) {
    const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        'unknown';

    let body: { url?: string; token?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { url, token } = body;

    if (isRateLimited(ip, !!token)) {
        return NextResponse.json(
            {
                error: token
                    ? 'Too many requests — slow down (authenticated limit: 120/10s)'
                    : 'Too many requests — add a GitHub token for higher limits',
            },
            { status: 429 }
        );
    }

    // Validate URL - only allow GitHub API
    if (!url || typeof url !== 'string' || !url.startsWith('https://api.github.com/')) {
        return NextResponse.json(
            { error: 'Invalid URL - only GitHub API endpoints allowed' },
            { status: 400 }
        );
    }

    try {
        // Forward request to GitHub API
        const headers: Record<string, string> = {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'CodeScope',
        };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(url, { headers });

        // Forward rate limit headers from GitHub
        const rateLimitHeaders: Record<string, string> = {};
        const remaining = response.headers.get('x-ratelimit-remaining');
        const limit = response.headers.get('x-ratelimit-limit');
        const reset = response.headers.get('x-ratelimit-reset');

        if (remaining) rateLimitHeaders['x-ratelimit-remaining'] = remaining;
        if (limit) rateLimitHeaders['x-ratelimit-limit'] = limit;
        if (reset) rateLimitHeaders['x-ratelimit-reset'] = reset;

        if (!response.ok) {
            const errorText = await response.text();
            let errorMsg: string;
            try {
                const errJson = JSON.parse(errorText);
                errorMsg = errJson.message || errorText;
            } catch {
                errorMsg = errorText;
            }

            // Surface specific advice for common GitHub errors
            if (response.status === 401) {
                errorMsg = 'Invalid or expired GitHub token';
            } else if (response.status === 403 && remaining === '0') {
                const resetTime = reset ? new Date(parseInt(reset) * 1000).toLocaleTimeString() : 'soon';
                errorMsg = `GitHub rate limit exceeded. Resets at ${resetTime}. ${!token ? 'Add a token for 5,000 req/hr.' : ''}`;
            } else if (response.status === 404) {
                errorMsg = 'Repository not found (check owner/repo or token permissions)';
            }

            return NextResponse.json(
                { error: errorMsg || `GitHub API error: ${response.status}` },
                { status: response.status, headers: rateLimitHeaders }
            );
        }

        const data = await response.json();
        return NextResponse.json(data, { headers: rateLimitHeaders });
    } catch (error) {
        console.error('Proxy error:', error);
        return NextResponse.json(
            { error: 'Proxy request failed — check your network connection' },
            { status: 502 }
        );
    }
}
