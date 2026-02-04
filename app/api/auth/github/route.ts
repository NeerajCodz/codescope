import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');

    if (!code) {
        return NextResponse.redirect(new URL('/?error=no_code', request.url));
    }

    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return NextResponse.redirect(
            new URL('/?error=missing_credentials', request.url)
        );
    }

    try {
        // Exchange code for access token
        const tokenResponse = await fetch(
            'https://github.com/login/oauth/access_token',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    client_id: clientId,
                    client_secret: clientSecret,
                    code,
                }),
            }
        );

        const data = await tokenResponse.json();

        if (data.error || !data.access_token) {
            return NextResponse.redirect(
                new URL(`/?error=${data.error || 'token_exchange_failed'}`, request.url)
            );
        }

        // Redirect back to home with token in URL fragment (client-side only)
        // Using fragment to avoid sending token to server logs
        return NextResponse.redirect(
            new URL(`/?github_token=${data.access_token}`, request.url)
        );
    } catch (error) {
        console.error('GitHub OAuth error:', error);
        return NextResponse.redirect(
            new URL('/?error=oauth_failed', request.url)
        );
    }
}
