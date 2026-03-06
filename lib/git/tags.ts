// Git tags and releases fetcher

import { TagData } from '@/types/git';

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

export async function getTags(
  owner: string,
  repo: string,
  token?: string | null
): Promise<TagData[]> {
  try {
    const [tagsData, releasesData] = await Promise.all([
      gitFetch(`https://api.github.com/repos/${owner}/${repo}/tags?per_page=50`, token) as Promise<Array<{
        name: string;
        commit: { sha: string };
      }>>,
      gitFetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=50`, token).catch(() => []) as Promise<Array<{
        tag_name: string;
        name: string;
        body: string;
        published_at: string;
        author: { login: string };
      }>>,
    ]);

    const releaseMap = new Map<string, { body: string; date: string; author: string }>();
    (releasesData || []).forEach(r => {
      releaseMap.set(r.tag_name, {
        body: r.body,
        date: r.published_at,
        author: r.author.login,
      });
    });

    return tagsData.map(tag => {
      const release = releaseMap.get(tag.name);
      return {
        name: tag.name,
        sha: tag.commit.sha,
        message: release?.body?.slice(0, 200),
        date: release?.date || '',
        author: release?.author,
        isRelease: releaseMap.has(tag.name),
        releaseBody: release?.body,
      };
    });
  } catch {
    return [];
  }
}
