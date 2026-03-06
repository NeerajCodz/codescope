// Git pull requests fetcher

import { PRListItem, PRDetail } from '@/types/git';

async function gitFetch(url: string, token?: string | null): Promise<unknown> {
  const res = await fetch('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, token }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `GitHub API error: ${res.status}`);
  }
  return res.json();
}

interface RawPR {
  number: number;
  title: string;
  state: string;
  merged_at: string | null;
  draft: boolean;
  user: { login: string; avatar_url: string };
  labels: Array<{ name: string; color: string }>;
  created_at: string;
  updated_at: string;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  head: { ref: string };
  base: { ref: string };
  body?: string;
}

export async function getPRs(
  owner: string,
  repo: string,
  state: 'open' | 'closed' | 'all' = 'all',
  perPage: number = 30,
  token?: string | null
): Promise<PRListItem[]> {
  const data = await gitFetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls?state=${state}&per_page=${perPage}&sort=updated&direction=desc`,
    token
  ) as RawPR[];

  // Map directly from list response — individual per-PR detail fetches are
  // skipped here to avoid spamming the proxy with N extra requests.
  // Full diff stats (additions/deletions/files) are loaded on-demand via
  // getPRDetail() when the user opens a specific PR.
  return data.map((pr) => ({
    number: pr.number,
    title: pr.title,
    state: pr.merged_at ? 'merged' : (pr.state as 'open' | 'closed'),
    author: { login: pr.user.login, avatar_url: pr.user.avatar_url },
    labels: pr.labels.map(l => ({ name: l.name, color: l.color })),
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    mergedAt: pr.merged_at || undefined,
    additions: 0,
    deletions: 0,
    changedFiles: 0,
    draft: pr.draft,
    headBranch: pr.head.ref,
    baseBranch: pr.base.ref,
    body: pr.body || undefined,
  }));
}

export async function getPRDetail(
  owner: string,
  repo: string,
  prNumber: number,
  token?: string | null
): Promise<PRDetail> {
  const [prData, filesData, commitsData, reviewsData, commentsData] = await Promise.all([
    gitFetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, token) as Promise<RawPR & { additions: number; deletions: number; changed_files: number }>,
    gitFetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`, token) as Promise<Array<{
      filename: string; status: string; additions: number; deletions: number; changes: number; patch?: string; previous_filename?: string;
    }>>,
    gitFetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/commits?per_page=100`, token) as Promise<Array<{
      sha: string; commit: { message: string; author: { name: string; email: string; date: string }; committer: { name: string; email: string; date: string } };
      author?: { login: string; avatar_url: string }; parents: Array<{ sha: string }>;
    }>>,
    gitFetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, token).catch(() => []) as Promise<Array<{
      user: { login: string; avatar_url: string }; state: string; body: string; submitted_at: string;
    }>>,
    gitFetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/comments?per_page=50`, token).catch(() => []) as Promise<Array<{
      user: { login: string; avatar_url: string }; body: string; created_at: string; path?: string; line?: number;
    }>>,
  ]);

  return {
    number: prData.number,
    title: prData.title,
    state: prData.merged_at ? 'merged' : (prData.state as 'open' | 'closed'),
    author: { login: prData.user.login, avatar_url: prData.user.avatar_url },
    labels: prData.labels.map(l => ({ name: l.name, color: l.color })),
    createdAt: prData.created_at,
    updatedAt: prData.updated_at,
    mergedAt: prData.merged_at || undefined,
    additions: prData.additions,
    deletions: prData.deletions,
    changedFiles: prData.changed_files,
    draft: prData.draft,
    headBranch: prData.head.ref,
    baseBranch: prData.base.ref,
    body: prData.body || undefined,
    files: filesData.map(f => ({
      filename: f.filename,
      status: f.status as 'added' | 'removed' | 'modified' | 'renamed',
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch,
      previousFilename: f.previous_filename,
    })),
    commits: commitsData.map(c => ({
      sha: c.sha,
      message: c.commit.message,
      author: {
        name: c.commit.author.name,
        email: c.commit.author.email,
        date: c.commit.author.date,
        login: c.author?.login,
        avatar_url: c.author?.avatar_url,
      },
      committer: {
        name: c.commit.committer.name,
        email: c.commit.committer.email,
        date: c.commit.committer.date,
      },
      parents: c.parents.map(p => p.sha),
    })),
    reviews: (reviewsData || []).map(r => ({
      author: r.user.login,
      avatar_url: r.user.avatar_url,
      state: r.state as 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'PENDING',
      body: r.body || '',
      submittedAt: r.submitted_at,
    })),
    comments: (commentsData || []).map(c => ({
      author: c.user.login,
      avatar_url: c.user.avatar_url,
      body: c.body,
      createdAt: c.created_at,
      path: c.path,
      line: c.line,
    })),
  };
}
