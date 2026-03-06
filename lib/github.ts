import { FileNode } from '@/types';
import { IGNORE } from '@/utils/constants';

interface RateLimit {
    remaining: number;
    limit: number;
    reset: number;
}

interface GitHubRepoResponse {
    default_branch?: string;
}

interface GitHubRateLimitResponse {
    resources?: {
        core?: {
            remaining: number;
            limit: number;
            reset: number;
        };
    };
}

export interface BulkFile {
    path: string;
    content: string;
    size: number;
}

interface TarballResponse {
    files: BulkFile[];
    branch: string;
    fileCount: number;
    error?: string;
}

class GitHubClient {
    private token: string | null = null;
    private rateLimit: RateLimit = { remaining: 60, limit: 60, reset: 0 };
    private cache: Map<string, { data: unknown; timestamp: number }> = new Map();

    setToken(token: string | null) {
        this.token = token;
    }

    getToken(): string | null {
        return this.token;
    }

    /** Clear the internal cache (e.g. after a new token is set) */
    clearCache() {
        this.cache.clear();
    }

    private async fetch(url: string): Promise<unknown> {
        // Check cache first (5 minute TTL)
        const cached = this.cache.get(url);
        if (cached && Date.now() - cached.timestamp < 300000) {
            return cached.data;
        }

        // Use proxy route for all GitHub API calls
        const response = await fetch('/api/proxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url,
                token: this.token,
            }),
        });

        // Update rate limit from headers
        const remaining = response.headers.get('x-ratelimit-remaining');
        const limit = response.headers.get('x-ratelimit-limit');
        const reset = response.headers.get('x-ratelimit-reset');

        if (remaining) this.rateLimit.remaining = parseInt(remaining, 10);
        if (limit) this.rateLimit.limit = parseInt(limit, 10);
        if (reset) this.rateLimit.reset = parseInt(reset, 10);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error ${response.status}`);
        }

        const data = await response.json();
        // Cache the response
        this.cache.set(url, { data, timestamp: Date.now() });
        return data;
    }

    async getRateLimit(): Promise<RateLimit> {
        try {
            const data = await this.fetch('https://api.github.com/rate_limit') as GitHubRateLimitResponse;
            if (data.resources?.core) {
                this.rateLimit = {
                    remaining: data.resources.core.remaining,
                    limit: data.resources.core.limit,
                    reset: data.resources.core.reset,
                };
            }
            return this.rateLimit;
        } catch {
            return this.rateLimit;
        }
    }

    /**
     * Downloads the entire repository as a tarball in ONE request,
     * extracts all text files server-side, and returns them.
     * This replaces the old file-by-file fetching approach.
     */
    async downloadRepo(
        owner: string,
        repo: string,
        branch?: string,
        onProgress?: (msg: string) => void
    ): Promise<{ files: BulkFile[]; branch: string }> {
        onProgress?.('Downloading repository...');

        const cacheKey = `tarball_${owner}/${repo}/${branch || 'default'}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < 300000) {
            const data = cached.data as TarballResponse;
            onProgress?.(`Loaded ${data.fileCount} files from cache`);
            return { files: data.files, branch: data.branch };
        }

        const response = await fetch('/api/tarball', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                owner,
                repo,
                branch,
                token: this.token,
            }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
            throw new Error(err.error || `Failed to download repository`);
        }

        const data = await response.json() as TarballResponse;

        if (data.error) {
            throw new Error(data.error);
        }

        // Update rate limit from response
        const remaining = response.headers.get('x-ratelimit-remaining');
        const limit = response.headers.get('x-ratelimit-limit');
        const reset = response.headers.get('x-ratelimit-reset');
        if (remaining) this.rateLimit.remaining = parseInt(remaining, 10);
        if (limit) this.rateLimit.limit = parseInt(limit, 10);
        if (reset) this.rateLimit.reset = parseInt(reset, 10);

        // Cache the result
        this.cache.set(cacheKey, { data, timestamp: Date.now() });

        onProgress?.(`Downloaded ${data.fileCount} files`);
        return { files: data.files, branch: data.branch };
    }

    /**
     * Builds FileNode array from bulk-downloaded files.
     * No more individual API calls needed.
     */
    buildFileNodes(bulkFiles: BulkFile[]): FileNode[] {
        const files: FileNode[] = [];

        for (const bf of bulkFiles) {
            const name = bf.path.includes('/')
                ? bf.path.substring(bf.path.lastIndexOf('/') + 1)
                : bf.path;

            // Check if in ignored directory
            const pathParts = bf.path.split('/');
            const ignored = pathParts.slice(0, -1).some((part: string) => IGNORE.has(part));
            if (ignored) continue;

            // Check if file should be included
            if (!this.isIncluded(name)) continue;

            const folder = bf.path.includes('/')
                ? bf.path.substring(0, bf.path.lastIndexOf('/'))
                : 'root';

            files.push({
                path: bf.path,
                name,
                folder,
                size: bf.size,
                isCode: this.isCode(name),
                content: bf.content,
                lines: bf.content.split('\n').length,
            });
        }

        return files;
    }

    /**
     * Fallback: Get default branch via API (used when needed outside tarball flow)
     */
    async getDefaultBranch(owner: string, repo: string): Promise<string> {
        try {
            const repoData = await this.fetch(
                `https://api.github.com/repos/${owner}/${repo}`
            ) as GitHubRepoResponse;
            return repoData.default_branch || 'main';
        } catch {
            return 'main';
        }
    }

    /**
     * Legacy file-by-file mode: fetch a single file's content.
     */
    async getFile(owner: string, repo: string, path: string): Promise<string | null> {
        try {
            const data = await this.fetch(
                `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`
            ) as { content?: string };
            if (!data.content) return null;
            // GitHub returns base64 with newlines
            return atob(data.content.replace(/\n/g, ''));
        } catch {
            return null;
        }
    }

    /**
     * Legacy file-by-file mode: scan the repository tree to get all file paths.
     */
    async scanTree(
        owner: string,
        repo: string,
        onProgress?: (message: string) => void
    ): Promise<import('@/types').FileNode[]> {
        onProgress?.('Fetching repository tree...');

        const repoData = await this.fetch(
            `https://api.github.com/repos/${owner}/${repo}`
        ) as GitHubRepoResponse;
        const branch = repoData.default_branch || 'main';

        onProgress?.(`Loading file tree (${branch})...`);

        const tree = await this.fetch(
            `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
        ) as { tree?: Array<{ type: string; path: string; size?: number }> };

        if (!tree.tree) throw new Error('Invalid tree response');

        const files: import('@/types').FileNode[] = [];

        tree.tree.forEach((item) => {
            if (item.type !== 'blob') return;

            const name = item.path.includes('/')
                ? item.path.substring(item.path.lastIndexOf('/') + 1)
                : item.path;

            const pathParts = item.path.split('/');
            const ignored = pathParts.slice(0, -1).some((part: string) => IGNORE.has(part));
            if (ignored) return;
            if (!this.isIncluded(name)) return;

            const folder = item.path.includes('/')
                ? item.path.substring(0, item.path.lastIndexOf('/'))
                : 'root';

            files.push({
                path: item.path,
                name,
                folder,
                size: item.size || 0,
                isCode: this.isCode(name),
            });
        });

        onProgress?.(`Found ${files.length} files`);
        return files;
    }

    private isCode(name: string): boolean {
        const codeExts = [
            '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
            '.py', '.java', '.go', '.rb', '.php',
            '.vue', '.svelte', '.rs', '.c', '.cpp', '.cc', '.h', '.hpp',
            '.cs', '.swift', '.kt', '.kts', '.scala', '.clj',
            '.ex', '.exs', '.erl', '.hs', '.lua', '.r', '.R',
            '.jl', '.dart', '.elm', '.fs', '.fsx', '.ml',
            '.pl', '.pm', '.sh', '.bash', '.zsh', '.fish',
            '.ps1', '.psm1', '.groovy', '.gradle',
        ];
        return codeExts.some((ext) => name.toLowerCase().endsWith(ext));
    }

    private isIncluded(name: string): boolean {
        const binExts = [
            '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.bmp',
            '.woff', '.woff2', '.ttf', '.eot', '.otf',
            '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z',
            '.exe', '.dll', '.so', '.dylib', '.bin', '.dat',
            '.db', '.sqlite', '.mp3', '.mp4', '.wav', '.avi', '.mov', '.webm',
        ];
        return !binExts.some((ext) => name.toLowerCase().endsWith(ext));
    }
}

export const github = new GitHubClient();
