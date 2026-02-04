import { FileNode } from '@/types';
import { IGNORE } from '@/utils/constants';

interface RateLimit {
    remaining: number;
    limit: number;
    reset: number;
}

class GitHubClient {
    private token: string | null = null;
    private rateLimit: RateLimit = { remaining: 60, limit: 60, reset: 0 };
    private cache: Map<string, { data: any; timestamp: number }> = new Map();

    setToken(token: string | null) {
        this.token = token;
    }

    private async fetch(url: string): Promise<any> {
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
            const data = await this.fetch('https://api.github.com/rate_limit');
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

    async getFile(owner: string, repo: string, path: string): Promise<string | null> {
        try {
            const data = await this.fetch(
                `https://api.github.com/repos/${owner}/${repo}/contents/${path}`
            );
            return data.content ? atob(data.content) : null;
        } catch {
            return null;
        }
    }

    async getCommits(
        owner: string,
        repo: string,
        path?: string,
        limit: number = 30
    ): Promise<any[]> {
        if (this.rateLimit.remaining < 20 && !this.token) return [];
        try {
            const url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${limit}${path ? `&path=${path}` : ''
                }`;
            return await this.fetch(url);
        } catch {
            return [];
        }
    }

    async getBlame(owner: string, repo: string, path: string): Promise<any[]> {
        try {
            const allCommits = await this.getCommits(owner, repo, path, 50);
            const authors: Record<string, number> = {};

            allCommits.forEach((c: any) => {
                const name = c.commit.author.name;
                authors[name] = (authors[name] || 0) + 1;
            });

            return Object.entries(authors)
                .map(([name, count]) => ({
                    name,
                    commits: count,
                    percent: Math.round((count / allCommits.length) * 100),
                }))
                .sort((a, b) => b.commits - a.commits);
        } catch {
            return [];
        }
    }

    async scanTree(
        owner: string,
        repo: string,
        onProgress?: (message: string) => void
    ): Promise<FileNode[]> {
        if (onProgress) onProgress('Fetching repository tree...');

        // Get repo info for default branch
        const repoData = await this.fetch(`https://api.github.com/repos/${owner}/${repo}`);
        const branch = repoData.default_branch || 'main';

        if (onProgress) onProgress(`Loading file tree (${branch})...`);

        // Get full tree recursively
        const tree = await this.fetch(
            `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
        );

        if (!tree.tree) throw new Error('Invalid tree response');

        const files: FileNode[] = [];

        tree.tree.forEach((item: any) => {
            if (item.type !== 'blob') return;

            const name = item.path.includes('/')
                ? item.path.substring(item.path.lastIndexOf('/') + 1)
                : item.path;

            // Check if in ignored directory
            const pathParts = item.path.split('/');
            const ignored = pathParts.slice(0, -1).some((part: string) => IGNORE.has(part));
            if (ignored) return;

            // Check if file should be included
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

        if (onProgress) onProgress(`Found ${files.length} files`);
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
