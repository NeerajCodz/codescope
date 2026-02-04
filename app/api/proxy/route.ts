import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const { url, token } = await request.json();

        // Validate URL - only allow GitHub API
        if (!url || !url.startsWith('https://api.github.com/')) {
            return NextResponse.json(
                { error: 'Invalid URL - only GitHub API endpoints allowed' },
                { status: 400 }
            );
        }

        // Forward request to GitHub API
        const headers: Record<string, string> = {
            Accept: 'application/vnd.github.v3+json',
        };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(url, { headers });

        // Forward rate limit headers
        const rateLimitHeaders: Record<string, string> = {};
        const remaining = response.headers.get('x-ratelimit-remaining');
        const limit = response.headers.get('x-ratelimit-limit');
        const reset = response.headers.get('x-ratelimit-reset');

        if (remaining) rateLimitHeaders['x-ratelimit-remaining'] = remaining;
        if (limit) rateLimitHeaders['x-ratelimit-limit'] = limit;
        if (reset) rateLimitHeaders['x-ratelimit-reset'] = reset;

        if (!response.ok) {
            const error = await response.text();
            return NextResponse.json(
                { error: error || `GitHub API error: ${response.status}` },
                { status: response.status, headers: rateLimitHeaders }
            );
        }

        const data = await response.json();
        return NextResponse.json(data, { headers: rateLimitHeaders });
    } catch (error) {
        console.error('Proxy error:', error);
        return NextResponse.json(
            { error: 'Proxy request failed' },
            { status: 500 }
        );
    }
}
