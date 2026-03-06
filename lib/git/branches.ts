// Git branches fetcher

import { BranchData, BranchComparison, CommitData } from '@/types/git';

interface RawBranch {
  name: string;
  commit: { sha: string; url: string };
  protected: boolean;
}

interface RawCompare {
  ahead_by: number;
  behind_by: number;
  total_commits: number;
  commits: Array<{
    sha: string;
    commit: {
      message: string;
      author: { name: string; email: string; date: string };
      committer: { name: string; email: string; date: string };
    };
    author?: { login: string; avatar_url: string };
    parents: Array<{ sha: string }>;
  }>;
  files: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
    patch?: string;
  }>;
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

export async function getBranches(
  owner: string,
  repo: string,
  token?: string | null
): Promise<BranchData[]> {
  const data = await gitFetch(
    `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`,
    token
  ) as RawBranch[];

  // Get default branch
  const repoInfo = await gitFetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    token
  ) as { default_branch: string };

  return data.map(b => ({
    name: b.name,
    sha: b.commit.sha,
    isDefault: b.name === repoInfo.default_branch,
    isProtected: b.protected,
  }));
}

export async function compareBranches(
  owner: string,
  repo: string,
  base: string,
  head: string,
  token?: string | null
): Promise<BranchComparison> {
  const data = await gitFetch(
    `https://api.github.com/repos/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,
    token
  ) as RawCompare;

  return {
    aheadBy: data.ahead_by,
    behindBy: data.behind_by,
    totalCommits: data.total_commits,
    files: data.files.map(f => ({
      filename: f.filename,
      status: f.status as 'added' | 'removed' | 'modified' | 'renamed',
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch,
    })),
    commits: data.commits.map(c => ({
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
  };
}

/**
 * Fetch commits for a specific branch.
 */
export async function getBranchCommits(
  owner: string,
  repo: string,
  branch: string,
  perPage = 50,
  token?: string | null
): Promise<CommitData[]> {
  const data = await gitFetch(
    `https://api.github.com/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=${perPage}`,
    token
  ) as Array<{
    sha: string;
    commit: {
      message: string;
      author: { name: string; email: string; date: string };
      committer: { name: string; email: string; date: string };
    };
    author?: { login: string; avatar_url: string };
    parents: Array<{ sha: string }>;
  }>;

  return data.map(c => ({
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
  }));
}

/**
 * Fetch commits for all branches (up to maxBranches), returning a Map.
 * Used by the branch graph algorithm to assign commits to branches.
 */
export async function getMultiBranchCommits(
  owner: string,
  repo: string,
  branches: BranchData[],
  maxBranches = 20,
  perPage = 50,
  token?: string | null
): Promise<Map<string, CommitData[]>> {
  const result = new Map<string, CommitData[]>();
  const branchSlice = branches.slice(0, maxBranches);

  // Parallel fetch with concurrency limit
  const batchSize = 5;
  for (let i = 0; i < branchSlice.length; i += batchSize) {
    const batch = branchSlice.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      batch.map(b => getBranchCommits(owner, repo, b.name, perPage, token))
    );
    settled.forEach((res, idx) => {
      if (res.status === 'fulfilled') {
        result.set(batch[idx].name, res.value);
      }
    });
  }

  return result;
}
