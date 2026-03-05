import { github } from './github';
import { Parser } from './parser';
import { AnalysisData, FileNode, Connection, Pattern, SecurityIssue, FunctionDef } from '@/types';

export type ProgressCallback = (step: string, fileName?: string) => void;
export type FetchMode = 'tarball' | 'filewise';

async function asyncPool<T, R>(poolLimit: number, array: T[], iteratorFn: (item: T) => Promise<R>): Promise<R[]> {
    const ret: Array<Promise<R>> = [];
    const executing: Array<Promise<void>> = [];
    for (const item of array) {
        const p = Promise.resolve().then(() => iteratorFn(item));
        ret.push(p);
        if (poolLimit <= array.length) {
            const e = p.then(() => { executing.splice(executing.indexOf(e), 1); });
            executing.push(e);
            if (executing.length >= poolLimit) await Promise.race(executing);
        }
    }
    return Promise.all(ret);
}

export async function analyzeRepository(
    repoUrl: string,
    token?: string,
    onProgress?: ProgressCallback,
    fetchMode: FetchMode = 'tarball'
): Promise<AnalysisData> {
    if (token) github.setToken(token);

    const cleanUrl = repoUrl.replace(/^(https?:\/\/)?(www\.)?github\.com\//, '').replace(/\/$/, '');
    const match = cleanUrl.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
    if (!match) throw new Error('Invalid GitHub URL');
    const [, owner, repo] = match;

    let allFiles: FileNode[];

    if (fetchMode === 'tarball') {
        // ── TARBALL MODE: download entire repo in 1 request ──
        onProgress?.('scanning');
        const { files: bulkFiles, branch } = await github.downloadRepo(
            owner,
            repo,
            undefined,
            (msg) => onProgress?.('scanning', msg)
        );
        onProgress?.('scanning', `Downloaded ${bulkFiles.length} files from ${branch}`);
        allFiles = github.buildFileNodes(bulkFiles);
    } else {
        // ── FILE-BY-FILE MODE: legacy GitHub Contents API ──
        onProgress?.('scanning');
        allFiles = await github.scanTree(owner, repo, (msg) => onProgress?.('scanning', msg));

        const codeFiles = allFiles.filter(f => f.isCode && f.size < 200000);
        onProgress?.('parsing', `Fetching ${codeFiles.length} files...`);

        await asyncPool<FileNode, void>(10, codeFiles, async (file) => {
            try {
                onProgress?.('parsing', file.path);
                const content = await github.getFile(owner, repo, file.path);
                if (!content) return;
                file.content = content;
                file.lines = content.split('\n').length;
            } catch (e) {
                console.error(`Failed to fetch ${file.path}`, e);
            }
        });
    }

    const codeFilesWithContent = allFiles.filter(f => f.isCode && f.size < 200000);

    // Parse all code files (CPU-bound, no network calls)
    for (const file of codeFilesWithContent) {
        if (!file.content) continue;
        try {
            onProgress?.('parsing', file.path);
            file.functions = Parser.extract(file.content, file.path);
            file.variables = Parser.extractVariables(file.content, file.path);
            const score = Parser.calcComplexity(file.content);
            file.complexity = { score, level: score > 30 ? 'high' : score > 15 ? 'medium' : 'low' };
            file.securityIssues = Parser.detectSecurity(file.content, file.path);
            file.rawImports = Parser.detectImports(file.content, file.path);
        } catch (e) {
            console.error(`Failed to parse ${file.path}`, e);
        }
    }

    const fileMap = new Map<string, FileNode>();
    allFiles.forEach(f => fileMap.set(f.path, f));

    onProgress?.('building');
    // 4. Build Dependency Graph
    const connections: Connection[] = [];
    const securityIssues: SecurityIssue[] = [];
    const patterns: Pattern[] = [];

    // Pattern buckets
    const patternMap: Record<string, string[]> = {
        'Singleton': [],
        'Factory': [],
        'Observer': [],
        'Provider': [],
        'Hook': [],
        'Component': []
    };

    const files = Array.from(fileMap.values());

    // Collect ALL function definitions across all files
    const allFunctions: FunctionDef[] = [];
    files.forEach(f => {
        if (f.functions) {
            f.functions.forEach(fn => {
                allFunctions.push({
                    ...fn,
                    file: f.path,
                    callSites: [],
                    totalCalls: 0
                });
            });
        }
    });

    // Build function definition map for quick lookup
    const fnDefMap = new Map<string, FunctionDef[]>();
    allFunctions.forEach(fn => {
        if (!fnDefMap.has(fn.name)) {
            fnDefMap.set(fn.name, []);
        }
        fnDefMap.get(fn.name)!.push(fn);
    });

    files.forEach(file => {
        if (!file.content) return;

        // Security
        if (file.securityIssues) {
            securityIssues.push(...file.securityIssues);
        }

        onProgress?.('patterns', file.path);
        // Patterns
        const content = file.content.toLowerCase();
        if (content.includes('static getinstance') || content.includes('static instance')) patternMap['Singleton'].push(file.path);
        if (content.includes('createinstance') || content.includes('factory.')) patternMap['Factory'].push(file.path);
        if (content.includes('subscribe(') || content.includes('notify(')) patternMap['Observer'].push(file.path);
        if (content.includes('provider') && (content.includes('context') || content.includes('state'))) patternMap['Provider'].push(file.path);
        if (file.name.startsWith('use') && (file.path.includes('/hooks/') || file.path.includes('/use-'))) patternMap['Hook'].push(file.path);
        if (file.path.includes('/components/') || content.includes('export function') || content.includes('export const')) {
            if (content.includes('return (') || content.includes('return <')) patternMap['Component'].push(file.path);
        }

        // Connections based on imports
        const rawImports = file.rawImports || [];
        rawImports.forEach((imp: string) => {
            const target = files.find(f => {
                const pathWithoutExt = f.path.replace(/\.[^/.]+$/, "");
                const impClean = imp.replace(/\.[^/.]+$/, "");
                // Direct path match
                if (f.path === imp || f.path.endsWith('/' + imp)) return true;
                // Without extension
                if (pathWithoutExt === impClean || pathWithoutExt.endsWith('/' + impClean)) return true;
                // Relative import resolution
                if (imp.startsWith('./') || imp.startsWith('../')) {
                    const fileDir = file.path.split('/').slice(0, -1).join('/');
                    const resolved = resolveRelativePath(fileDir, imp.replace(/\.[^/.]+$/, ""));
                    if (pathWithoutExt === resolved) return true;
                }
                // Index file resolution (import './utils' -> utils/index.ts)
                if (f.path.endsWith('/index.ts') || f.path.endsWith('/index.js') || f.path.endsWith('/index.tsx') || f.path.endsWith('/index.jsx')) {
                    const dirPath = f.path.replace(/\/index\.[^/.]+$/, "");
                    if (dirPath.endsWith(impClean) || dirPath.endsWith('/' + impClean)) return true;
                }
                return false;
            });

            if (target && target.path !== file.path) {
                connections.push({
                    source: file.path,
                    target: target.path,
                    fn: 'import',
                    count: 1,
                    lines: []
                });
            }
        });

        // Track EVERY SINGLE function call with line numbers
        const callData = Parser.findCalls(file.content, file.path, allFunctions);

        // Build connections based on function calls
        Object.entries(callData).forEach(([fnName, callInfo]) => {
            const defs = fnDefMap.get(fnName);
            if (!defs || defs.length === 0) return;

            defs.forEach(fnDef => {
                // Skip internal calls (same file)
                if (fnDef.file === file.path) return;

                // Create/update connection
                const existingConn = connections.find(c =>
                    c.source === fnDef.file && c.target === file.path && c.fn === fnName
                );

                if (existingConn) {
                    existingConn.count += callInfo.totalCalls;
                    existingConn.lines = existingConn.lines || [];
                    existingConn.lines.push(...callInfo.callSites.map(cs => cs.line));
                } else {
                    connections.push({
                        source: fnDef.file,
                        target: file.path,
                        fn: fnName,
                        count: callInfo.totalCalls,
                        lines: callInfo.callSites.map(cs => cs.line)
                    });
                }

                // Update function def with call site info
                fnDef.callSites = fnDef.callSites || [];
                fnDef.callSites.push(...callInfo.callSites.map(cs => ({
                    ...cs,
                    file: file.path
                })));
                fnDef.totalCalls = (fnDef.totalCalls || 0) + callInfo.totalCalls;
            });
        });
    });

    // 5. Dead Code Detection using comprehensive tracking
    let deadFunctions = 0;
    allFunctions.forEach(fn => {
        if (fn.isTopLevel && (fn.totalCalls || 0) === 0) {
            deadFunctions++;
            fn.isDead = true;
        }
    });

    // Update files with enriched function data
    files.forEach(f => {
        if (f.functions) {
            f.functions.forEach(fn => {
                const enriched = allFunctions.find(af => af.name === fn.name && af.file === f.path);
                if (enriched) {
                    fn.callSites = enriched.callSites;
                    fn.totalCalls = enriched.totalCalls;
                }
            });
        }
    });

    // Update variables with usage info
    files.forEach(f => {
        if (f.content && f.variables && f.variables.length > 0) {
            const usage = Parser.findVariableUsages(f.content, f.variables);
            f.variables.forEach(variable => {
                const entry = usage[variable.name];
                if (entry) {
                    variable.totalUsages = entry.total;
                    variable.usageLines = entry.lines;
                } else {
                    variable.totalUsages = 0;
                    variable.usageLines = [];
                }
            });
        }
    });

    // 6. Build Stats
    const totalLines = files.reduce((acc, f) => acc + (f.lines || 0), 0);
    const stats = {
        files: files.length,
        codeFiles: files.filter(f => f.isCode).length,
        functions: allFunctions.length,
        dead: deadFunctions,
        connections: connections.length,
        avgComplexity: Math.round(files.reduce((acc, f) => acc + (f.complexity?.score || 0), 0) / (files.filter(f => f.isCode).length || 1)),
        totalLines
    };

    // Construct final patterns array
    Object.entries(patternMap).forEach(([name, paths]) => {
        if (paths.length > 0) {
            patterns.push({
                name,
                desc: `Detected ${paths.length} instances of the ${name} pattern.`,
                severity: 'info',
                metrics: {},
                files: paths.map(p => {
                    const f = fileMap.get(p)!;
                    return {
                        name: f.name,
                        path: f.path,
                        fns: f.functions?.length || 0,
                        lines: f.lines || 0
                    };
                }),
                icon: name === 'Component' ? '🧩' : name === 'Hook' ? '🪝' : '🏗️'
            });
        }
    });

    onProgress?.('brushing');
    const analysis: AnalysisData = {
        files,
        connections,
        stats,
        issues: [],
        patterns,
        securityIssues,
        duplicates: [],
        layerViolations: [],
        languages: {},
        totalLines
    };

    return analysis;
}

/**
 * Resolves a relative import path from a base directory.
 * e.g., resolveRelativePath('src/components', '../utils/helpers') => 'src/utils/helpers'
 */
function resolveRelativePath(baseDir: string, relativePath: string): string {
    const baseParts = baseDir.split('/').filter(Boolean);
    const relParts = relativePath.split('/');

    for (const part of relParts) {
        if (part === '.') continue;
        if (part === '..') {
            baseParts.pop();
        } else {
            baseParts.push(part);
        }
    }

    return baseParts.join('/');
}
