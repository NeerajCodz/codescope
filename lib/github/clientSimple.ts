/**
 * Simple GitHub Client — Zero Server
 *
 * Uses GitHub REST API directly from the browser.
 * No /api/proxy or /api/tarball — everything is client-side.
 * Inspired by DGF (Direct Git Fetch) file-by-file approach.
 */

import { FileNode } from '@/types';

// ─── Types ───────────────────────────────────────────────────────────

interface RateLimit {
  remaining: number;
  limit: number;
  reset: number;
}

interface TreeItem {
  path: string;
  type: 'blob' | 'tree';
  size?: number;
  sha: string;
  url: string;
}

interface TreeResponse {
  sha: string;
  tree: TreeItem[];
  truncated: boolean;
}

interface RepoResponse {
  default_branch: string;
}

export type SimpleProgressCallback = (message: string) => void;

// ─── Constants ───────────────────────────────────────────────────────

const API_BASE = 'https://api.github.com';
const CONCURRENCY = 8;
const MAX_FILE_SIZE = 200_000; // 200KB

// ─── Helpers ─────────────────────────────────────────────────────────

function isCodeFile(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const codeExts = new Set([
    'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
    'py', 'java', 'kt', 'go', 'rs', 'rb',
    'c', 'cpp', 'h', 'hpp', 'cs',
    'php', 'swift', 'dart', 'vue', 'svelte',
    'sh', 'bash', 'yml', 'yaml', 'json',
    'css', 'scss', 'less', 'html', 'xml',
    'sql', 'graphql', 'proto', 'toml',
    'r', 'scala', 'clj', 'ex', 'exs',
    'zig', 'nim', 'lua', 'pl', 'pm',
  ]);
  return codeExts.has(ext);
}

function shouldIgnore(path: string): boolean {
  const parts = path.toLowerCase().split('/');
  const ignorePatterns = [
    'node_modules', '.git', 'dist', 'build', '.next',
    '__pycache__', '.cache', 'vendor', 'coverage',
    '.idea', '.vscode', '.DS_Store', 'package-lock.json',
    'pnpm-lock.yaml', 'yarn.lock',
  ];
  return parts.some(p => ignorePatterns.includes(p));
}

// ─── Async Pool ──────────────────────────────────────────────────────

async function asyncPool<T, R>(
  limit: number,
  items: T[],
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: Promise<R>[] = [];
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));
    results.push(p);

    if (limit <= items.length) {
      const e = p.then(() => {
        executing.splice(executing.indexOf(e), 1);
      });
      executing.push(e);
      if (executing.length >= limit) await Promise.race(executing);
    }
  }
  return Promise.all(results);
}

// ─── Client Class ────────────────────────────────────────────────────

export class SimpleGitHubClient {
  private token: string | null = null;
  private rateLimit: RateLimit = { remaining: 60, limit: 60, reset: 0 };

  setToken(token: string | null) {
    this.token = token;
  }

  getToken() {
    return this.token;
  }

  getRateLimit() {
    return this.rateLimit;
  }

  private headers(): HeadersInit {
    const h: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    };
    if (this.token) {
      h.Authorization = `Bearer ${this.token}`;
    }
    return h;
  }

  private updateRateLimit(response: Response) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    const limit = response.headers.get('x-ratelimit-limit');
    const reset = response.headers.get('x-ratelimit-reset');
    if (remaining) this.rateLimit.remaining = parseInt(remaining, 10);
    if (limit) this.rateLimit.limit = parseInt(limit, 10);
    if (reset) this.rateLimit.reset = parseInt(reset, 10);
  }

  private async apiFetch<T>(url: string): Promise<T> {
    const response = await fetch(url, { headers: this.headers() });
    this.updateRateLimit(response);

    if (response.status === 403 || response.status === 429) {
      throw new Error('Rate limited. Please add a GitHub token for higher limits.');
    }
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message || `GitHub API error ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  /**
   * Get the default branch for a repo
   */
  async getDefaultBranch(owner: string, repo: string): Promise<string> {
    const data = await this.apiFetch<RepoResponse>(
      `${API_BASE}/repos/${owner}/${repo}`,
    );
    return data.default_branch;
  }

  /**
   * Scan the repo tree using Git Trees API (recursive).
   * Returns FileNode array without content yet.
   */
  async scanTree(
    owner: string,
    repo: string,
    branch?: string,
    onProgress?: SimpleProgressCallback,
  ): Promise<{ files: FileNode[]; branch: string }> {
    const branchName = branch || (await this.getDefaultBranch(owner, repo));
    onProgress?.(`Scanning tree for ${owner}/${repo}@${branchName}...`);

    const tree = await this.apiFetch<TreeResponse>(
      `${API_BASE}/repos/${owner}/${repo}/git/trees/${branchName}?recursive=1`,
    );

    const files: FileNode[] = [];
    for (const item of tree.tree) {
      if (item.type !== 'blob') continue;
      if (shouldIgnore(item.path)) continue;

      const name = item.path.split('/').pop() || item.path;
      const folder = item.path.includes('/') ? item.path.substring(0, item.path.lastIndexOf('/')) : '';
      const code = isCodeFile(item.path);

      files.push({
        path: item.path,
        name,
        folder,
        size: item.size || 0,
        isCode: code,
      });
    }

    onProgress?.(`Found ${files.length} files (${files.filter(f => f.isCode).length} code files)`);
    return { files, branch: branchName };
  }

  /**
   * Fetch a single file's content using the Contents API.
   * Returns the decoded UTF-8 content.
   */
  async getFileContent(owner: string, repo: string, path: string, branch?: string): Promise<string | null> {
    try {
      const url = `${API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}${branch ? `?ref=${branch}` : ''}`;
      const data = await this.apiFetch<{ content?: string; encoding?: string }>(url);
      if (data.content && data.encoding === 'base64') {
        return atob(data.content.replace(/\n/g, ''));
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Fetch all code file contents in parallel batches.
   * This is the "simple mode" approach — file by file, client side only.
   */
  async fetchAllContents(
    owner: string,
    repo: string,
    files: FileNode[],
    branch?: string,
    onProgress?: SimpleProgressCallback,
  ): Promise<FileNode[]> {
    const codeFiles = files.filter(f => f.isCode && f.size < MAX_FILE_SIZE);
    onProgress?.(`Fetching ${codeFiles.length} code files...`);

    let fetched = 0;
    await asyncPool(CONCURRENCY, codeFiles, async (file) => {
      const content = await this.getFileContent(owner, repo, file.path, branch);
      if (content) {
        file.content = content;
        file.lines = content.split('\n').length;
      }
      fetched++;
      if (fetched % 10 === 0 || fetched === codeFiles.length) {
        onProgress?.(`Fetched ${fetched}/${codeFiles.length} files`);
      }
    });

    return files;
  }

  /**
   * Fetch basic git data — branches, recent commits — directly from GitHub API.
   * No server needed.
   */
  async fetchGitData(
    owner: string,
    repo: string,
    token?: string | null,
  ) {
    if (token) this.setToken(token);

    const [branchesRaw, commitsRaw, contributorsRaw] = await Promise.allSettled([
      this.apiFetch<Array<{
        name: string;
        protected: boolean;
        commit: { sha: string };
      }>>(`${API_BASE}/repos/${owner}/${repo}/branches?per_page=100`),

      this.apiFetch<Array<{
        sha: string;
        commit: {
          message: string;
          author: { name: string; date: string };
        };
        author: { login: string; avatar_url: string } | null;
        parents: { sha: string }[];
      }>>(`${API_BASE}/repos/${owner}/${repo}/commits?per_page=100`),

      this.apiFetch<Array<{
        login: string;
        avatar_url: string;
        contributions: number;
      }>>(`${API_BASE}/repos/${owner}/${repo}/contributors?per_page=100`),
    ]);

    const branches =
      branchesRaw.status === 'fulfilled'
        ? branchesRaw.value.map((b) => ({
            name: b.name,
            sha: b.commit.sha,
            isDefault: false, // will be set below
            isProtected: b.protected,
            lastCommitDate: '',
            lastCommitter: '',
          }))
        : [];

    // Mark default branch
    try {
      const defaultBranch = await this.getDefaultBranch(owner, repo);
      const def = branches.find((b) => b.name === defaultBranch);
      if (def) def.isDefault = true;
    } catch { /* */ }

    const commits =
      commitsRaw.status === 'fulfilled'
        ? commitsRaw.value.map((c) => ({
            sha: c.sha,
            message: c.commit.message,
            author: {
              name: c.commit.author.name,
              email: '',
              date: c.commit.author.date,
              login: c.author?.login || '',
              avatar_url: c.author?.avatar_url || '',
            },
            committer: {
              name: c.commit.author.name,
              email: '',
              date: c.commit.author.date,
            },
            parents: c.parents?.map((p) => p.sha) || [],
          }))
        : [];

    // Fetch diff stats for top N commits in parallel
    if (commits.length > 0) {
      const topCommits = commits.slice(0, 50);
      const commitDetails = await asyncPool(5, topCommits, async (commit) => {
        try {
          const detail = await this.apiFetch<{
            stats?: { additions: number; deletions: number; total: number };
          }>(`${API_BASE}/repos/${owner}/${repo}/commits/${commit.sha}`);
          return {
            sha: commit.sha,
            stats: detail.stats || undefined,
          };
        } catch {
          return { sha: commit.sha, stats: undefined };
        }
      });

      const statsMap = new Map(commitDetails.map(d => [d.sha, d.stats]));
      for (const commit of commits) {
        const stats = statsMap.get(commit.sha);
        if (stats) {
          (commit as Record<string, unknown>).stats = stats;
        }
      }
    }

    const contributors =
      contributorsRaw.status === 'fulfilled'
        ? contributorsRaw.value.map((c) => ({
            login: c.login,
            avatar_url: c.avatar_url,
            contributions: c.contributions,
            commits: c.contributions,
          }))
        : [];

    return { branches, commits, contributors };
  }

  /**
   * Fetch PRs client-side with actual diff stats.
   * GitHub's List PRs endpoint doesn't return additions/deletions/changed_files,
   * so we make parallel individual PR calls to get the real stats.
   */
  async fetchPRs(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'all',
    perPage = 30,
  ) {
    const prs = await this.apiFetch<Array<{
      number: number;
      title: string;
      state: string;
      user: { login: string; avatar_url: string } | null;
      created_at: string;
      updated_at: string;
      merged_at: string | null;
      head: { ref: string; sha: string };
      base: { ref: string; sha: string };
      labels: { name: string; color: string }[];
      draft: boolean;
    }>>(`${API_BASE}/repos/${owner}/${repo}/pulls?state=${state}&per_page=${perPage}&sort=updated&direction=desc`);

    // Fetch individual PR details in parallel (batches of 5) to get actual diff stats
    const prDetails = await asyncPool(5, prs, async (pr) => {
      try {
        const detail = await this.apiFetch<{
          additions: number;
          deletions: number;
          changed_files: number;
        }>(`${API_BASE}/repos/${owner}/${repo}/pulls/${pr.number}`);
        return {
          number: pr.number,
          additions: detail.additions ?? 0,
          deletions: detail.deletions ?? 0,
          changedFiles: detail.changed_files ?? 0,
        };
      } catch {
        return { number: pr.number, additions: 0, deletions: 0, changedFiles: 0 };
      }
    });

    const detailMap = new Map(prDetails.map(d => [d.number, d]));

    return prs.map((pr) => {
      const detail = detailMap.get(pr.number);
      return {
        number: pr.number,
        title: pr.title,
        state: (pr.merged_at ? 'merged' : pr.state) as 'open' | 'closed' | 'merged',
        author: {
          login: pr.user?.login || 'unknown',
          avatar_url: pr.user?.avatar_url || '',
        },
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        mergedAt: pr.merged_at || undefined,
        headBranch: pr.head.ref,
        baseBranch: pr.base.ref,
        labels: pr.labels.map((l) => ({ name: l.name, color: l.color })),
        draft: pr.draft,
        additions: detail?.additions ?? 0,
        deletions: detail?.deletions ?? 0,
        changedFiles: detail?.changedFiles ?? 0,
      };
    });
  }
}

/** Singleton instance for use throughout the app */
export const simpleGithub = new SimpleGitHubClient();

/**
 * Fetch commits for each branch (client-side) using direct GitHub API.
 * Returns Map<branchName, CommitData[]>
 */
export async function fetchMultiBranchCommits(
  client: SimpleGitHubClient,
  owner: string,
  repo: string,
  branches: Array<{ name: string }>,
  maxBranches = 20,
  perPage = 50,
): Promise<Map<string, Array<{
  sha: string;
  message: string;
  author: { name: string; email: string; date: string; login?: string; avatar_url?: string };
  committer: { name: string; email: string; date: string };
  parents: string[];
}>>> {
  const result = new Map<string, Array<{
    sha: string;
    message: string;
    author: { name: string; email: string; date: string; login?: string; avatar_url?: string };
    committer: { name: string; email: string; date: string };
    parents: string[];
  }>>();

  const slice = branches.slice(0, maxBranches);
  const batchSize = 5;

  for (let i = 0; i < slice.length; i += batchSize) {
    const batch = slice.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      batch.map(async (b) => {
        const raw = await client['apiFetch']<Array<{
          sha: string;
          commit: {
            message: string;
            author: { name: string; email: string; date: string };
            committer: { name: string; email: string; date: string };
          };
          author: { login: string; avatar_url: string } | null;
          parents: { sha: string }[];
        }>>(`${API_BASE}/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(b.name)}&per_page=${perPage}`);

        return {
          branch: b.name,
          commits: raw.map(c => ({
            sha: c.sha,
            message: c.commit.message,
            author: {
              name: c.commit.author.name,
              email: c.commit.author.email || '',
              date: c.commit.author.date,
              login: c.author?.login,
              avatar_url: c.author?.avatar_url,
            },
            committer: {
              name: c.commit.committer.name,
              email: c.commit.committer.email || '',
              date: c.commit.committer.date,
            },
            parents: c.parents?.map(p => p.sha) || [],
          })),
        };
      })
    );

    for (const res of settled) {
      if (res.status === 'fulfilled') {
        result.set(res.value.branch, res.value.commits);
      }
    }
  }

  return result;
}
