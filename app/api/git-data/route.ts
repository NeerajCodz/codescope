import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

// Allow requests through expired/self-signed TLS certs in dev (e.g. corporate proxy)
if (process.env.NODE_ENV !== 'production') {
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
}

/**
 * Server-side endpoint that fetches ALL git metadata from GitHub API in parallel.
 * Gracefully degrades when no token is provided (skips auth-required stats endpoints).
 * 
 * POST /api/git-data
 * Body: { owner, repo, token? }
 */
export async function POST(request: NextRequest) {
  try {
    const { owner, repo, token } = await request.json();

    if (!owner || !repo) {
      return NextResponse.json({ error: 'owner and repo are required' }, { status: 400 });
    }

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'CodeScope',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const gh = async (path: string): Promise<unknown> => {
      const url = `https://api.github.com${path}`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        // Don't throw - return null and let caller handle it
        return null;
      }
      return res.json();
    };

    // Stats endpoints REQUIRE authentication - skip them without a token
    const wantStats = !!token;

    const [
      repoInfo,
      commitsRaw,
      branchesRaw,
      contributorsRaw,
      tagsRaw,
      releasesRaw,
      codeFrequency,
      commitActivity,
    ] = await Promise.all([
      gh(`/repos/${owner}/${repo}`),
      gh(`/repos/${owner}/${repo}/commits?per_page=100`),
      gh(`/repos/${owner}/${repo}/branches?per_page=100`),
      gh(`/repos/${owner}/${repo}/contributors?per_page=100`),
      gh(`/repos/${owner}/${repo}/tags?per_page=50`),
      gh(`/repos/${owner}/${repo}/releases?per_page=50`),
      wantStats ? gh(`/repos/${owner}/${repo}/stats/code_frequency`) : Promise.resolve(null),
      wantStats ? gh(`/repos/${owner}/${repo}/stats/commit_activity`) : Promise.resolve(null),
    ]);

    const defaultBranch = (repoInfo as { default_branch?: string } | null)?.default_branch || 'main';
    const isRateLimited = !repoInfo && !commitsRaw;

    // Process commits
    const commits = ((commitsRaw as RawCommit[] | null) || []).map((c) => ({
      sha: c.sha,
      message: c.commit?.message || '',
      author: {
        name: c.commit?.author?.name || 'Unknown',
        email: c.commit?.author?.email || '',
        date: c.commit?.author?.date || '',
        login: c.author?.login,
        avatar_url: c.author?.avatar_url,
      },
      committer: {
        name: c.commit?.committer?.name || '',
        email: c.commit?.committer?.email || '',
        date: c.commit?.committer?.date || '',
      },
      parents: (c.parents || []).map((p) => p.sha),
    }));

    // Process branches
    const branches = ((branchesRaw as RawBranch[] | null) || []).map((b) => ({
      name: b.name,
      sha: b.commit?.sha || '',
      isDefault: b.name === defaultBranch,
      isProtected: b.protected || false,
    }));

    // Process contributors (filter bots)
    const contributors = ((contributorsRaw as RawContributor[] | null) || [])
      .filter((c) => c.type === 'User')
      .map((c) => ({
        login: c.login,
        avatar_url: c.avatar_url,
        contributions: c.contributions,
        commits: c.contributions,
      }));

    // Process tags with release info
    const releaseMap = new Map<string, { body: string; date: string; author: string }>();
    ((releasesRaw as RawRelease[] | null) || []).forEach((r) => {
      releaseMap.set(r.tag_name, {
        body: r.body || '',
        date: r.published_at || '',
        author: r.author?.login || '',
      });
    });

    const tags = ((tagsRaw as RawTag[] | null) || []).map((tag) => {
      const release = releaseMap.get(tag.name);
      return {
        name: tag.name,
        sha: tag.commit?.sha || '',
        message: release?.body?.slice(0, 200),
        date: release?.date || '',
        author: release?.author,
        isRelease: releaseMap.has(tag.name),
        releaseBody: release?.body,
      };
    });

    const stats = {
      weeklyActivity: commitActivity || [],
      codeFrequency: codeFrequency || [],
      defaultBranch,
      totalCommits: commits.length,
      totalBranches: branches.length,
      totalContributors: contributors.length,
      totalTags: tags.length,
      rateLimited: isRateLimited,
      statsAvailable: wantStats,
    };

    return NextResponse.json({ commits, branches, contributors, tags, stats });

  } catch (error) {
    console.error('Git data fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch git data' },
      { status: 500 }
    );
  }
}

// Types
interface RawCommit {
  sha: string;
  commit: {
    message: string;
    author: { name: string; email: string; date: string };
    committer: { name: string; email: string; date: string };
  };
  author?: { login: string; avatar_url: string };
  parents: Array<{ sha: string }>;
}

interface RawBranch {
  name: string;
  commit: { sha: string };
  protected: boolean;
}

interface RawContributor {
  login: string;
  avatar_url: string;
  contributions: number;
  type: string;
}

interface RawTag {
  name: string;
  commit: { sha: string };
}

interface RawRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  author: { login: string };
}
