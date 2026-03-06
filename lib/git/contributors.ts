// Git contributors fetcher

import { ContributorData } from '@/types/git';

interface RawContributor {
  login: string;
  avatar_url: string;
  contributions: number;
  type: string;
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

export async function getContributors(
  owner: string,
  repo: string,
  token?: string | null
): Promise<ContributorData[]> {
  try {
    const data = await gitFetch(
      `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=100`,
      token
    ) as RawContributor[];

    return data
      .filter(c => c.type === 'User')
      .map(c => ({
        login: c.login,
        avatar_url: c.avatar_url,
        contributions: c.contributions,
        commits: c.contributions,
      }));
  } catch {
    return [];
  }
}

export async function getContributorStats(
  owner: string,
  repo: string,
  token?: string | null
): Promise<Array<{ login: string; weeks: Array<{ w: number; a: number; d: number; c: number }> }>> {
  try {
    const data = await gitFetch(
      `https://api.github.com/repos/${owner}/${repo}/stats/contributors`,
      token
    ) as Array<{
      author: { login: string };
      weeks: Array<{ w: number; a: number; d: number; c: number }>;
    }>;

    return data.map(d => ({
      login: d.author.login,
      weeks: d.weeks,
    }));
  } catch {
    return [];
  }
}
