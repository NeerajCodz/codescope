import { github } from './lib/github';
import { Parser } from './lib/parser';
import { AnalysisData, FileNode, Connection, Pattern, SecurityIssue, FunctionDef } from '@/types';
import { calcBlast, calcHealth } from '@/utils/calculations';

async function asyncPool(poolLimit: number, array: any[], iteratorFn: (item: any) => Promise<any>) {
    const ret = [];
    const executing: any[] = [];
    for (const item of array) {
        const p: any = Promise.resolve().then(() => iteratorFn(item));
        ret.push(p);

        if (poolLimit <= array.length) {
            const e: any = p.then(() => executing.splice(executing.indexOf(e), 1));
            executing.push(e);
            if (executing.length >= poolLimit) {
                await Promise.race(executing);
            }
        }
    }
    return Promise.all(ret);
}

export type ProgressCallback = (step: string, fileName?: string) => void;

export async function analyzeRepository(
    repoUrl: string,
    token?: string,
    onProgress?: ProgressCallback
): Promise<AnalysisData> {
    if (token) github.setToken(token);

    const cleanUrl = repoUrl.replace(/^(https?:\/\/)?(www\.)?github\.com\//, '').replace(/\/$/, '');
    const match = cleanUrl.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);

    if (!match) throw new Error('Invalid GitHub URL');
    const [, owner, repo] = match;

    onProgress?.('scanning');
    onProgress?.('scanning');
    // 1. Scan Tree
    const allFiles = await github.scanTree(owner, repo);
    const codeFiles = allFiles.filter(f => f.isCode && f.size < 200000);

    onProgress?.('fetching');
    // 2. Fetch & Parse
    // Analyze all code files for complete results
    const filesToAnalyze = codeFiles;

    const parsedFiles = await asyncPool(10, filesToAnalyze, async (file) => {
        try {
            onProgress?.('parsing', file.path);
            const content = await github.getFile(owner, repo, file.path);
            if (!content) return file;

            file.content = content;
            file.lines = content.split('\n').length;
            onProgress?.('analyzing', file.path);
            file.functions = Parser.extract(content, file.path);
            file.variables = Parser.extractVariables(content, file.path);
            file.complexity = {
                score: Parser.calcComplexity(content),
                level: 'low'
            };

            const score = file.complexity.score;
            file.complexity.level = score > 30 ? 'high' : score > 15 ? 'medium' : 'low';

            onProgress?.('security', file.path);
            // Store temporary data for aggregation
            (file as any).securityIssues = Parser.detectSecurity(content, file.path);
            (file as any).rawImports = Parser.detectImports(content, file.path);

            return file;
        } catch (e) {
            console.error(`Failed to analyze ${file.path}`, e);
            return file;
        }
    });

    const fileMap = new Map<string, FileNode>();
    allFiles.forEach(f => fileMap.set(f.path, f));
    parsedFiles.forEach(f => fileMap.set(f.path, f));

    onProgress?.('building');
    // 3. Build Dependency Graph
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
        if ((file as any).securityIssues) {
            securityIssues.push(...(file as any).securityIssues);
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
        const rawImports = (file as any).rawImports || [];
        rawImports.forEach((imp: string) => {
            const target = files.find(f => {
                const pathWithoutExt = f.path.replace(/\.[^/.]+$/, "");
                return f.path.endsWith(imp) || pathWithoutExt.endsWith(imp) || (imp.startsWith('./') && file.path.split('/').slice(0, -1).join('/') + '/' + imp.replace('./', '') === pathWithoutExt);
            });

            if (target) {
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

    // 4. Dead Code Detection using comprehensive tracking
    let deadFunctions = 0;
    allFunctions.forEach(fn => {
        if (fn.isTopLevel && (fn.totalCalls || 0) === 0) {
            deadFunctions++;
            (fn as any).isDead = true;
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

    // 5. Build Stats
    const totalLines = files.reduce((acc, f) => acc + (f.content?.split('\n').length || 0), 0);
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
                        lines: f.content?.split('\n').length || 0
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
