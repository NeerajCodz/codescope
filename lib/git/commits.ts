// Git commits fetcher via GitHub API proxy

import { CommitData } from '@/types/git';

interface RawCommit {
  sha: string;
  commit: {
    message: string;
    author: { name: string; email: string; date: string };
    committer: { name: string; email: string; date: string };
  };
  author?: { login: string; avatar_url: string };
  parents: Array<{ sha: string }>;
  stats?: { additions: number; deletions: number; total: number };
  files?: Array<{ filename: string; status: string; additions: number; deletions: number; changes: number; patch?: string }>;
}

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

export async function getCommits(
  owner: string,
  repo: string,
  options?: { branch?: string; path?: string; perPage?: number; page?: number; token?: string | null }
): Promise<CommitData[]> {
  const { branch, path, perPage = 30, page = 1, token } = options || {};
  let url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${perPage}&page=${page}`;
  if (branch) url += `&sha=${branch}`;
  if (path) url += `&path=${encodeURIComponent(path)}`;

  const data = await gitFetch(url, token) as RawCommit[];
  return data.map(mapCommit);
}

export async function getCommitDetail(
  owner: string,
  repo: string,
  sha: string,
  token?: string | null
): Promise<CommitData> {
  const data = await gitFetch(
    `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`,
    token
  ) as RawCommit;
  return mapCommit(data);
}

function mapCommit(raw: RawCommit): CommitData {
  return {
    sha: raw.sha,
    message: raw.commit.message,
    author: {
      name: raw.commit.author.name,
      email: raw.commit.author.email,
      date: raw.commit.author.date,
      login: raw.author?.login,
      avatar_url: raw.author?.avatar_url,
    },
    committer: {
      name: raw.commit.committer.name,
      email: raw.commit.committer.email,
      date: raw.commit.committer.date,
    },
    stats: raw.stats,
    files: raw.files?.map(f => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      changes: f.changes,
      patch: f.patch,
    })),
    parents: raw.parents.map(p => p.sha),
  };
}
