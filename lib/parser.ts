import * as acorn from 'acorn';
import type { Node } from 'acorn';
import { FunctionDef, SecurityIssue, VariableDef } from '@/types';

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null;

const getNodeType = (value: unknown): string | undefined =>
    isRecord(value) && typeof value.type === 'string' ? value.type : undefined;

const getNodeName = (value: unknown): string | undefined =>
    isRecord(value) && typeof value.name === 'string' ? value.name : undefined;

const getNodeLoc = (value: unknown): { start?: { line?: number }; end?: { line?: number } } | undefined =>
    isRecord(value) && isRecord(value.loc)
        ? (value.loc as { start?: { line?: number }; end?: { line?: number } })
        : undefined;

const getArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

export const Parser = {
    codeExts: [
        '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
        '.py', '.java', '.go', '.rb', '.php',
        '.vue', '.svelte', '.rs', '.c', '.cpp', '.cc', '.h', '.hpp',
        '.cs', '.swift', '.kt', '.kts', '.scala', '.clj',
        '.ex', '.exs', '.erl', '.hs', '.lua', '.r', '.R',
        '.jl', '.dart', '.elm', '.fs', '.fsx', '.ml',
        '.pl', '.pm', '.sh', '.bash', '.zsh', '.fish',
        '.ps1', '.psm1', '.groovy', '.gradle',
    ],

    isCode(filename: string): boolean {
        return this.codeExts.some((ext) => filename.toLowerCase().endsWith(ext));
    },

    stripTypeScript(content: string): string {
        return content
            .replace(/:\s*[A-Za-z_$][\w$<>,\s|&\[\]]*(?=\s*[=,\)\}\];])/g, '')
            .replace(/\bas\s+[A-Za-z_$][\w$<>,\s|&\[\]]*(?=\s*[,\)\}\];])/g, '')
            .replace(/<[A-Za-z_$][\w$<>,\s|&\[\]]*>(?=\s*\()/g, '')
            .replace(/^import\s+type\s+.*/gm, '')
            .replace(/^export\s+type\s+.*/gm, '')
            .replace(/^export\s+interface\s+.*/gm, '')
            .replace(/interface\s+[A-Za-z_$][\w$]*\s*\{[^}]*\}/g, '')
            .replace(/type\s+[A-Za-z_$][\w$]*\s*=\s*[^;]+;/g, '');
    },

    extract(content: string, filename: string): FunctionDef[] {
        const fns: FunctionDef[] = [];
        const lines = content.split('\n');
        const ext = filename.toLowerCase();

        const extractCode = (startLine: number, endLine?: number): string => {
            const start = Math.max(0, startLine - 1);
            const end = Math.min(lines.length, endLine || startLine + 10);
            return lines.slice(start, end).join('\n');
        };

        const isJS = ext.endsWith('.js') || ext.endsWith('.jsx') || ext.endsWith('.mjs');
        const isTS = ext.endsWith('.ts') || ext.endsWith('.tsx');

        const paramToString = (param: unknown): string => {
            if (!param) return 'unknown';
            switch (getNodeType(param)) {
                case 'Identifier':
                    return getNodeName(param) || 'param';
                case 'AssignmentPattern': {
                    const left = isRecord(param) ? param.left : undefined;
                    return `${paramToString(left)}=?`;
                }
                case 'RestElement': {
                    const argument = isRecord(param) ? param.argument : undefined;
                    return `...${paramToString(argument)}`;
                }
                case 'ObjectPattern':
                    return '{...}';
                case 'ArrayPattern':
                    return '[...]';
                default:
                    return 'param';
            }
        };

        const functionReturnsValue = (node: unknown): boolean => {
            if (!node) return false;
            if (getNodeType(node) === 'ArrowFunctionExpression') {
                const expression = isRecord(node) ? node.expression : undefined;
                const body = isRecord(node) ? node.body : undefined;
                if (expression && body && getNodeType(body) !== 'BlockStatement') {
                    return true;
                }
            }
            let returnsValue = false;
            const walkReturn = (n: unknown) => {
                if (!isRecord(n)) return;
                if (getNodeType(n) === 'ReturnStatement') {
                    const argument = (n as { argument?: unknown }).argument;
                    if (argument) returnsValue = true;
                }
                Object.values(n).forEach((child) => {
                    if (Array.isArray(child)) child.forEach(walkReturn);
                    else if (isRecord(child)) walkReturn(child);
                });
            };
            const body = isRecord(node) ? node.body : undefined;
            walkReturn(body || node);
            return returnsValue;
        };

        if (isJS || isTS) {
            try {
                const parseContent = isTS ? this.stripTypeScript(content) : content;
                const ast = acorn.parse(parseContent, {
                    ecmaVersion: 2022,
                    sourceType: 'module',
                    locations: true,
                    ranges: true,
                }) as Node;

                const walk = (node: unknown, scope: number) => {
                    if (!isRecord(node)) return;
                    const nodeType = getNodeType(node);

                    if (nodeType === 'FunctionDeclaration') {
                        const id = (node as { id?: unknown }).id;
                        const name = getNodeName(id);
                        const loc = getNodeLoc(node);
                        if (!name || !loc?.start?.line) {
                            // skip unnamed/invalid nodes
                        } else {
                        fns.push({
                            name,
                            file: filename,
                            line: loc.start.line,
                            code: extractCode(loc.start.line, loc.end?.line || loc.start.line),
                            type: 'function',
                            isTopLevel: scope === 0,
                            params: getArray((node as { params?: unknown }).params).map(paramToString),
                            returnsValue: functionReturnsValue(node),
                            returnType: functionReturnsValue(node) ? 'value' : 'void',
                        });
                        }
                    }

                    if (nodeType === 'VariableDeclaration') {
                        const declarations = getArray((node as { declarations?: unknown }).declarations);
                        declarations.forEach((decl) => {
                            if (!isRecord(decl)) return;
                            const init = (decl as { init?: unknown }).init;
                            const initType = getNodeType(init);
                            if (init && (initType === 'ArrowFunctionExpression' || initType === 'FunctionExpression')) {
                                const id = (decl as { id?: unknown }).id;
                                const name = getNodeName(id);
                                const loc = getNodeLoc(decl);
                                if (name && loc?.start?.line) {
                                    fns.push({
                                        name,
                                        file: filename,
                                        line: loc.start.line,
                                        code: extractCode(loc.start.line, loc.end?.line || loc.start.line),
                                        type: initType === 'ArrowFunctionExpression' ? 'arrow' : 'function',
                                        isTopLevel: scope === 0,
                                        params: getArray((init as { params?: unknown }).params).map(paramToString),
                                        returnsValue: functionReturnsValue(init),
                                        returnType: functionReturnsValue(init) ? 'value' : 'void',
                                    });
                                }
                            }
                        });
                    }

                    if (nodeType === 'MethodDefinition') {
                        const key = (node as { key?: unknown }).key;
                        const name = getNodeName(key);
                        const value = (node as { value?: unknown }).value;
                        const loc = getNodeLoc(node);
                        if (name && loc?.start?.line) {
                        fns.push({
                            name,
                            file: filename,
                            line: loc.start.line,
                            code: extractCode(loc.start.line, loc.end?.line || loc.start.line),
                            type: 'method',
                            isClassMethod: true,
                            isTopLevel: false,
                            params: getArray((value as { params?: unknown }).params).map(paramToString),
                            returnsValue: functionReturnsValue(value),
                            returnType: functionReturnsValue(value) ? 'value' : 'void',
                        });
                        }
                    }

                    const newScope = (nodeType === 'FunctionDeclaration' || nodeType === 'ArrowFunctionExpression' || nodeType === 'FunctionExpression') ? scope + 1 : scope;
                    Object.values(node).forEach((child) => {
                        if (Array.isArray(child)) {
                            child.forEach((c) => walk(c, newScope));
                        } else if (isRecord(child)) {
                            walk(child, newScope);
                        }
                    });
                };

                walk(ast, 0);
                return fns;

            } catch (err) {
                console.warn(`AST parsing failed for ${filename}, falling back to regex`, err);
            }
        }

        // --- Multi-language Regex Fallback ---

        const patterns: Record<string, RegExp> = {
            py: /^\s*def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm,
            go: /^func\s+(?:\([^)]+\)\s*)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm,
            java: /(?:public|private|protected|static|\s)\s+[\w<>\[\]]+\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*\{/gm,
            rs: /^\s*(?:pub\s+)?fn\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm,
            rb: /^\s*def\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm,
            php: /^\s*(?:public|private|protected)?\s*function\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm,
            c: /^[a-zA-Z_][a-zA-Z0-9_]*\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm,
            js: /(?:function\s+([a-zA-Z_][\w]*)|(?:const|let|var)\s+([a-zA-Z_][\w]*)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>))/gm
        };

        const language =
            ext.endsWith('.py') ? 'py' :
                ext.endsWith('.go') ? 'go' :
                    (ext.endsWith('.java') || ext.endsWith('.cs')) ? 'java' :
                        ext.endsWith('.rs') ? 'rs' :
                            ext.endsWith('.rb') ? 'rb' :
                                ext.endsWith('.php') ? 'php' :
                                    (ext.endsWith('.c') || ext.endsWith('.cpp') || ext.endsWith('.h')) ? 'c' :
                                        (isJS || isTS) ? 'js' : null;

        if (language && patterns[language]) {
            let match;
            const regex = patterns[language];
            while ((match = regex.exec(content)) !== null) {
                const name = match[1] || match[2];
                if (!name || name === 'if' || name === 'for' || name === 'while' || name === 'switch') continue;
                const line = content.substring(0, match.index).split('\n').length;
                fns.push({
                    name,
                    file: filename,
                    line,
                    code: extractCode(line),
                    type: (language === 'java' || language === 'c') ? 'method' : 'function',
                    isTopLevel: !match[0].startsWith(' ') || language === 'go' || language === 'c',
                });
            }
        }

        return fns;
    },

    detectImports(content: string, filename: string): string[] {
        const imports: string[] = [];
        const ext = filename.toLowerCase();

        // JS/TS Imports
        if (ext.endsWith('.js') || ext.endsWith('.ts') || ext.endsWith('.jsx') || ext.endsWith('.tsx')) {
            const jsImportRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
            const jsRequireRegex = /require\(['"]([^'"]+)['"]\)/g;
            let match;
            while ((match = jsImportRegex.exec(content)) !== null) imports.push(match[1]);
            while ((match = jsRequireRegex.exec(content)) !== null) imports.push(match[1]);
        }

        // Python Imports
        if (ext.endsWith('.py')) {
            const pyImportRegex = /^(?:from|import)\s+([a-zA-Z0-9_.]+)/gm;
            let match;
            while ((match = pyImportRegex.exec(content)) !== null) imports.push(match[1]);
        }

        // Go Imports
        if (ext.endsWith('.go')) {
            const goImportRegex = /import\s+['"]([^'"]+)['"]/g;
            let match;
            while ((match = goImportRegex.exec(content)) !== null) imports.push(match[1]);
        }

        return [...new Set(imports)];
    },

    extractVariables(content: string, filename: string): VariableDef[] {
        const vars: VariableDef[] = [];
        const ext = filename.toLowerCase();
        const isJS = ext.endsWith('.js') || ext.endsWith('.jsx') || ext.endsWith('.mjs');
        const isTS = ext.endsWith('.ts') || ext.endsWith('.tsx');

        const inferValueType = (node: unknown): string | undefined => {
            if (!node) return undefined;
            switch (getNodeType(node)) {
                case 'Literal':
                    return typeof (node as { value?: unknown }).value;
                case 'ArrayExpression':
                    return 'array';
                case 'ObjectExpression':
                    return 'object';
                case 'ArrowFunctionExpression':
                case 'FunctionExpression':
                    return 'function';
                case 'CallExpression':
                    return 'call';
                case 'NewExpression':
                    return 'instance';
                default:
                    return undefined;
            }
        };

        if (isJS || isTS) {
            try {
                const parseContent = isTS ? this.stripTypeScript(content) : content;
                const ast = acorn.parse(parseContent, {
                    ecmaVersion: 2022,
                    sourceType: 'module',
                    locations: true,
                }) as Node;

                const walk = (node: unknown, scope: number) => {
                    if (!isRecord(node)) return;
                    const nodeType = getNodeType(node);

                    if (nodeType === 'VariableDeclaration') {
                        const declarations = getArray((node as { declarations?: unknown }).declarations);
                        declarations.forEach((decl) => {
                            if (!isRecord(decl)) return;
                            const id = (decl as { id?: unknown }).id;
                            const name = getNodeName(id);
                            if (name) {
                                vars.push({
                                    name,
                                    file: filename,
                                    line: getNodeLoc(decl)?.start?.line || 0,
                                    kind: (node as { kind?: VariableDef['kind'] }).kind || 'unknown',
                                    valueType: inferValueType((decl as { init?: unknown }).init),
                                    isTopLevel: scope === 0,
                                });
                            }
                        });
                    }

                    const newScope = (nodeType === 'FunctionDeclaration' || nodeType === 'ArrowFunctionExpression' || nodeType === 'FunctionExpression') ? scope + 1 : scope;
                    Object.values(node).forEach((child) => {
                        if (Array.isArray(child)) child.forEach((c) => walk(c, newScope));
                        else if (isRecord(child)) walk(child, newScope);
                    });
                };

                walk(ast, 0);
                return vars;
            } catch (err) {
                console.warn(`Variable parsing failed for ${filename}, using regex fallback`, err);
            }
        }

        const regex = /^(?:\s*)(const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
        let match;
        while ((match = regex.exec(content)) !== null) {
            const line = content.substring(0, match.index).split('\n').length;
            const kind = match[1] === 'const' || match[1] === 'let' || match[1] === 'var' ? match[1] : 'unknown';
            vars.push({
                name: match[2],
                file: filename,
                line,
                kind,
                isTopLevel: true,
            });
        }

        return vars;
    },

    findVariableUsages(content: string, variables: VariableDef[]): Record<string, { total: number; lines: number[] }> {
        const usageMap: Record<string, { total: number; lines: number[] }> = {};
        const lines = content.split('\n');

        variables.forEach((variable) => {
            const name = variable.name;
            if (!name) return;
            const regex = new RegExp(`\\b${name}\\b`, 'g');
            lines.forEach((line, idx) => {
                if (line.match(new RegExp(`\\b(?:const|let|var)\\s+${name}\\b`))) return;
                const matches = line.match(regex);
                if (matches && matches.length > 0) {
                    if (!usageMap[name]) usageMap[name] = { total: 0, lines: [] };
                    usageMap[name].total += matches.length;
                    usageMap[name].lines.push(idx + 1);
                }
            });
        });

        return usageMap;
    },

    detectSecurity(content: string, filename: string): SecurityIssue[] {
        const issues: SecurityIssue[] = [];
        const lines = content.split('\n');

        lines.forEach((line, idx) => {
            if (line.match(/(?:password|passwd|pwd|secret|api_key|apikey|token|auth)\s*[=:]\s*['"][^'"]{8,}['"]/i) &&
                !line.includes('process.env') && !line.includes('config.')) {
                issues.push({
                    severity: 'high',
                    title: 'Hardcoded Secret',
                    file: filename,
                    path: filename,
                    line: idx + 1,
                    desc: 'Potential hardcoded credential detected.',
                    code: line.trim()
                });
            }

            if (line.match(/.*(query|execute|SELECT|INSERT|UPDATE|DELETE).*(\+|\$\{).*/i)) {
                issues.push({
                    severity: 'high',
                    title: 'SQL Injection Risk',
                    file: filename,
                    path: filename,
                    line: idx + 1,
                    desc: 'Potential SQL injection via string concatenation.',
                    code: line.trim()
                });
            }

            if (line.match(/dangerouslySetInnerHTML/)) {
                issues.push({
                    severity: 'medium',
                    title: 'XSS Risk',
                    file: filename,
                    path: filename,
                    line: idx + 1,
                    desc: 'Usage of dangerouslySetInnerHTML can lead to XSS.',
                    code: line.trim()
                });
            }

            if (line.match(/eval\(|new Function\(/)) {
                issues.push({
                    severity: 'high',
                    title: 'Dynamic Code Execution',
                    file: filename,
                    path: filename,
                    line: idx + 1,
                    desc: 'Use of eval() or new Function() is dangerous.',
                    code: line.trim()
                });
            }
        });

        return issues;
    },

    calcComplexity(content: string): number {
        if (!content) return 0;
        const patterns = [
            /\bif\s*\(/g, /\belse\s+if\s*\(/g, /\bwhile\s*\(/g,
            /\bfor\s*\(/g, /\bcase\s+/g, /\bcatch\s*\(/g,
            /\?\s*[^:]+\s*:/g, /&&/g, /\|\|/g
        ];
        let complexity = 1;
        patterns.forEach(p => {
            const m = content.match(p);
            if (m) complexity += m.length;
        });
        return complexity;
    },

    /**
     * Find ALL function calls in content - tracks every single call site with line numbers
     * Returns: { fnName: { totalCalls: number, callSites: Array<{ line: number, caller?: string }> } }
     */
    findCalls(content: string, filename: string, allFunctionDefs: FunctionDef[]): Record<string, { totalCalls: number; callSites: Array<{ line: number; caller?: string }> }> {
        const callMap: Record<string, { totalCalls: number; callSites: Array<{ line: number; caller?: string }> }> = {};
        const lines = content.split('\n');
        const ext = filename.toLowerCase();
        const isJS = ext.endsWith('.js') || ext.endsWith('.jsx') || ext.endsWith('.mjs');
        const isTS = ext.endsWith('.ts') || ext.endsWith('.tsx');

        // Build set of all known function names
        const fnNames = new Set(allFunctionDefs.map(f => f.name));

        if (isJS || isTS) {
            try {
                const parseContent = isTS ? this.stripTypeScript(content) : content;
                const ast = acorn.parse(parseContent, {
                    ecmaVersion: 2022,
                    sourceType: 'module',
                    locations: true,
                }) as Node;

                const getPropertyName = (property: unknown): string | null => {
                    const type = getNodeType(property);
                    if (type === 'Identifier') return getNodeName(property) || null;
                    if (type === 'Literal') {
                        const value = (property as { value?: unknown }).value;
                        if (typeof value === 'string') return value;
                        if (typeof value === 'number') return String(value);
                    }
                    return null;
                };

                // Walk AST to find ALL call expressions
                const walk = (node: unknown, currentFn?: string) => {
                    if (!isRecord(node)) return;
                    const nodeType = getNodeType(node);

                    // Track current function scope
                    let fnContext = currentFn;
                    if (nodeType === 'FunctionDeclaration') {
                        const name = getNodeName((node as { id?: unknown }).id);
                        if (name) fnContext = name;
                    } else if (nodeType === 'VariableDeclaration') {
                        const declarations = getArray((node as { declarations?: unknown }).declarations);
                        declarations.forEach((decl) => {
                            if (!isRecord(decl)) return;
                            const id = (decl as { id?: unknown }).id;
                            const init = (decl as { init?: unknown }).init;
                            const initType = getNodeType(init);
                            if (id && init && (initType === 'ArrowFunctionExpression' || initType === 'FunctionExpression')) {
                                const name = getNodeName(id);
                                if (name) fnContext = name;
                            }
                        });
                    }

                    // CallExpression - tracks direct function calls foo()
                    if (nodeType === 'CallExpression' && (node as { callee?: unknown }).callee) {
                        const callee = (node as { callee?: unknown }).callee;
                        let calleeName: string | null = null;

                        if (getNodeType(callee) === 'Identifier') {
                            calleeName = getNodeName(callee) || null;
                        } else if (getNodeType(callee) === 'MemberExpression') {
                            // Handle obj.method() - extract method name
                            const property = (callee as { property?: unknown }).property;
                            calleeName = getPropertyName(property);
                        }

                        if (calleeName && fnNames.has(calleeName)) {
                            const line = getNodeLoc(node)?.start?.line || 0;
                            if (!callMap[calleeName]) {
                                callMap[calleeName] = { totalCalls: 0, callSites: [] };
                            }
                            callMap[calleeName].totalCalls++;
                            callMap[calleeName].callSites.push({ line, caller: fnContext });
                        }
                    }

                    // Recursively walk all child nodes
                    Object.values(node).forEach((child) => {
                        if (Array.isArray(child)) {
                            child.forEach((c) => walk(c, fnContext));
                        } else if (isRecord(child)) {
                            walk(child, fnContext);
                        }
                    });
                };

                walk(ast);
                return callMap;

            } catch (err) {
                console.warn(`AST parsing failed for ${filename}, using regex fallback`, err);
            }
        }

        // Regex fallback for all languages (including Python, Go, etc.)
        fnNames.forEach(fnName => {
            // Match function calls: fnName(
            const callRegex = new RegExp(`\\b${fnName}\\s*\\(`, 'g');
            lines.forEach((line, idx) => {
                while (callRegex.exec(line) !== null) {
                    // Skip if this is a function definition
                    if (line.match(new RegExp(`(?:function|def|fn|func)\\s+${fnName}\\s*\\(`)) ||
                        line.match(new RegExp(`(?:const|let|var)\\s+${fnName}\\s*=`))) {
                        continue;
                    }

                    if (!callMap[fnName]) {
                        callMap[fnName] = { totalCalls: 0, callSites: [] };
                    }
                    callMap[fnName].totalCalls++;
                    callMap[fnName].callSites.push({ line: idx + 1 });
                }
            });
        });

        return callMap;
    }
};

/**
 * Parse raw file contents (from client-side GitHub API fetch)
 * into a full AnalysisData structure. Used in "Simple" mode.
 */
export function parseFilesFromContents(
    contents: Map<string, string>,
    repoUrl: string
): import('@/types').AnalysisData {
    const fileMap = new Map<string, import('@/types').FileNode>();

    // Build FileNodes from all content entries
    for (const [path, content] of contents) {
        const pathParts = path.split('/');
        const name = pathParts.pop() || path;
        const folder = pathParts.join('/') || 'root';
        const ext = name.includes('.') ? '.' + name.split('.').pop()!.toLowerCase() : '';
        const isCode = Parser.isCode(name);
        const lines = content.split('\n').length;
        const size = new Blob([content]).size;

        // Determine layer heuristic
        let layer: string | undefined;
        if (path.includes('/components/') || path.includes('/ui/')) layer = 'ui';
        else if (path.includes('/services/') || path.includes('/api/') || path.includes('/lib/')) layer = 'service';
        else if (path.includes('/utils/') || path.includes('/helpers/')) layer = 'util';
        else if (path.includes('/data/') || path.includes('/models/') || path.includes('/types/')) layer = 'data';
        else if (path.includes('/config/') || path.includes('.config')) layer = 'config';
        else if (path.includes('/test') || path.includes('.test.') || path.includes('.spec.')) layer = 'test';

        const node: import('@/types').FileNode = {
            name,
            path,
            folder,
            isCode,
            content,
            lines,
            size,
            layer,
            functions: [],
            variables: [],
            rawImports: [],
            children: [],
        };

        if (isCode && size < 200000) {
            try {
                node.functions = Parser.extract(content, name);
                node.variables = Parser.extractVariables(content, name);
                const score = Parser.calcComplexity(content);
                node.complexity = { score, level: score > 30 ? 'high' : score > 15 ? 'medium' : 'low' };
                node.securityIssues = Parser.detectSecurity(content, path);
                node.rawImports = Parser.detectImports(content, path);
            } catch (e) {
                console.warn(`Parse error for ${path}:`, e);
            }
        }

        fileMap.set(path, node);
    }

    const files = Array.from(fileMap.values());

    // Build connections from imports
    const connections: import('@/types').Connection[] = [];
    for (const file of files) {
        if (!file.rawImports) continue;
        for (const imp of file.rawImports) {
            const target = files.find(f => {
                const p = f.path.replace(/\.[^/.]+$/, '');
                const i = imp.replace(/\.[^/.]+$/, '');
                return f.path === imp || f.path.endsWith('/' + imp) || p === i || p.endsWith('/' + i);
            });
            if (target && target.path !== file.path) {
                connections.push({ source: file.path, target: target.path, fn: 'import', count: 1, lines: [] });
            }
        }
    }

    // Detect patterns
    const patterns: import('@/types').Pattern[] = [];
    const patternBuckets: Record<string, string[]> = {
        Component: [], Hook: [], Provider: [], Singleton: [], Factory: [], Observer: [],
    };
    for (const file of files) {
        if (!file.content) continue;
        const c = file.content.toLowerCase();
        if (c.includes('static getinstance') || c.includes('static instance')) patternBuckets.Singleton.push(file.path);
        if (c.includes('createinstance') || c.includes('factory.')) patternBuckets.Factory.push(file.path);
        if (c.includes('subscribe(') || c.includes('notify(')) patternBuckets.Observer.push(file.path);
        if (c.includes('provider') && (c.includes('context') || c.includes('state'))) patternBuckets.Provider.push(file.path);
        if (file.name.startsWith('use') && file.path.includes('/hook')) patternBuckets.Hook.push(file.path);
        if ((c.includes('return (') || c.includes('return <')) && file.path.includes('/component')) patternBuckets.Component.push(file.path);
    }
    for (const [name, paths] of Object.entries(patternBuckets)) {
        if (paths.length > 0) {
            patterns.push({
                name,
                desc: `${paths.length} ${name} pattern instances`,
                severity: 'info',
                metrics: {},
                files: paths.map(p => {
                    const f = fileMap.get(p)!;
                    return { name: f.name, path: f.path, fns: f.functions?.length || 0, lines: f.lines || 0 };
                }),
                icon: name === 'Component' ? '🧩' : name === 'Hook' ? '🪝' : '🏗️',
            });
        }
    }

    // Security issues
    const securityIssues = files.flatMap(f => f.securityIssues || []);

    // Stats
    const allFunctions = files.flatMap(f => f.functions || []);
    const totalLines = files.reduce((a, f) => a + (f.lines || 0), 0);

    // Languages
    const languages: Record<string, number> = {};
    for (const file of files) {
        if (!file.isCode) continue;
        const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
        const lang = ext.replace('.', '') || 'unknown';
        languages[lang] = (languages[lang] || 0) + 1;
    }

    return {
        files,
        connections,
        stats: {
            files: files.length,
            codeFiles: files.filter(f => f.isCode).length,
            functions: allFunctions.length,
            dead: 0,
            connections: connections.length,
            avgComplexity: Math.round(files.reduce((a, f) => a + (f.complexity?.score || 0), 0) / (files.filter(f => f.isCode).length || 1)),
        },
        issues: [],
        patterns,
        securityIssues,
        duplicates: [],
        layerViolations: [],
        languages,
        totalLines,
    };
}
