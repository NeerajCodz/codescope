import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 15;

/**
 * POST /api/git-data/diff
 * Body: { owner, repo, sha, token? }
 * Fetches file-level diff stats for a single commit.
 * Token is sent in the request body — never in URL.
 */
export async function POST(request: NextRequest) {
    let body: { owner?: string; repo?: string; sha?: string; token?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { owner, repo, sha, token } = body;

    if (!owner || !repo || !sha) {
        return NextResponse.json({ error: 'owner, repo, and sha are required' }, { status: 400 });
    }

    // Validate SHA format (prevent injection)
    if (!/^[a-f0-9]{7,40}$/i.test(sha)) {
        return NextResponse.json({ error: 'Invalid commit SHA' }, { status: 400 });
    }

    const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'CodeScope',
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
        const res = await fetch(
            `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(sha)}`,
            { headers },
        );

        if (!res.ok) {
            return NextResponse.json({ error: `GitHub API ${res.status}` }, { status: res.status });
        }

        const data = await res.json();

        return NextResponse.json({
            sha: data.sha,
            stats: data.stats || { additions: 0, deletions: 0, total: 0 },
            files: (data.files || []).map((f: { filename: string; status: string; additions: number; deletions: number; changes: number; patch?: string }) => ({
                filename: f.filename,
                status: f.status,
                additions: f.additions,
                deletions: f.deletions,
                changes: f.changes,
                patch: f.patch || null,
            })),
        });
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Failed to fetch diff' },
            { status: 500 },
        );
    }
}
