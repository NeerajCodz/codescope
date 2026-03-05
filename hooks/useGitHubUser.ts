'use client';

import { useState, useEffect } from 'react';

export type GitHubUser = {
    login: string;
    avatar_url?: string;
};

const SESSION_KEY = 'codescope_gh_user';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

interface CachedUser {
    user: GitHubUser;
    ts: number;
}

/**
 * Global in-memory dedup: if a fetch is already in flight, re-use it.
 * Prevents multiple components from firing the same /user request.
 */
let _inflight: Promise<GitHubUser | null> | null = null;
let _inflightToken: string | null = null;

function getCached(): GitHubUser | null {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const { user, ts } = JSON.parse(raw) as CachedUser;
        if (Date.now() - ts > CACHE_TTL) {
            sessionStorage.removeItem(SESSION_KEY);
            return null;
        }
        return user;
    } catch {
        return null;
    }
}

function setCache(user: GitHubUser) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user, ts: Date.now() }));
}

export function clearUserCache() {
    sessionStorage.removeItem(SESSION_KEY);
    _inflight = null;
    _inflightToken = null;
}

async function fetchUser(token: string): Promise<GitHubUser | null> {
    // Re-use in-flight request for the same token
    if (_inflight && _inflightToken === token) return _inflight;

    _inflightToken = token;
    _inflight = (async () => {
        try {
            const res = await fetch('/api/proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: 'https://api.github.com/user', token }),
            });
            if (!res.ok) return null;
            const data = await res.json();
            const user: GitHubUser = { login: data.login, avatar_url: data.avatar_url };
            setCache(user);
            return user;
        } catch {
            return null;
        } finally {
            _inflight = null;
            _inflightToken = null;
        }
    })();

    return _inflight;
}

/**
 * Shared hook for GitHub user profile.
 * - Deduplicates in-flight requests across components
 * - Caches in sessionStorage for 10 minutes
 * - Routes through /api/proxy (token never in browser URL)
 */
export function useGitHubUser() {
    const [token, setTokenState] = useState<string | null>(() => {
        if (typeof window === 'undefined') return null;
        return sessionStorage.getItem('github_token') || localStorage.getItem('github_token') || null;
    });
    const [user, setUser] = useState<GitHubUser | null>(() => {
        if (typeof window === 'undefined') return null;
        const t = sessionStorage.getItem('github_token') || localStorage.getItem('github_token');
        return t ? getCached() : null;
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // When token is absent, user is already null from state initializer / setToken / logout
        if (!token) return;

        let cancelled = false;

        queueMicrotask(async () => {
            if (cancelled) return;

            const cached = getCached();
            if (cached) {
                setUser(cached);
                return;
            }

            setLoading(true);
            const u = await fetchUser(token);
            if (cancelled) return;

            if (u) {
                setUser(u);
            } else {
                // Token is invalid — clear it
                sessionStorage.removeItem('github_token');
                setTokenState(null);
                setUser(null);
            }
            setLoading(false);
        });

        return () => { cancelled = true; };
    }, [token]);

    const setToken = (t: string | null) => {
        if (t) {
            sessionStorage.setItem('github_token', t);
        } else {
            sessionStorage.removeItem('github_token');
            clearUserCache();
        }
        setTokenState(t);
        setUser(null);
    };

    const logout = () => {
        sessionStorage.removeItem('github_token');
        localStorage.removeItem('github_token');
        clearUserCache();
        setTokenState(null);
        setUser(null);
    };

    return { token, user, loading, setToken, logout };
}
