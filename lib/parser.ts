import * as acorn from 'acorn';
import { FunctionDef, Pattern, SecurityIssue, VariableDef } from '@/types';

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

        const paramToString = (param: any): string => {
            if (!param) return 'unknown';
            switch (param.type) {
                case 'Identifier':
                    return param.name;
                case 'AssignmentPattern':
                    return `${paramToString(param.left)}=?`;
                case 'RestElement':
                    return `...${paramToString(param.argument)}`;
                case 'ObjectPattern':
                    return '{...}';
                case 'ArrayPattern':
                    return '[...]';
                default:
                    return 'param';
            }
        };

        const functionReturnsValue = (node: any): boolean => {
            if (!node) return false;
            if (node.type === 'ArrowFunctionExpression' && node.expression && node.body && node.body.type !== 'BlockStatement') {
                return true;
            }
            let returnsValue = false;
            const walkReturn = (n: any) => {
                if (!n || typeof n !== 'object') return;
                if (n.type === 'ReturnStatement') {
                    if (n.argument) returnsValue = true;
                }
                Object.values(n).forEach((child) => {
                    if (Array.isArray(child)) child.forEach(walkReturn);
                    else if (typeof child === 'object') walkReturn(child);
                });
            };
            walkReturn(node.body || node);
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
                });

                const walk = (node: any, scope: number) => {
                    if (!node || typeof node !== 'object') return;

                    if (node.type === 'FunctionDeclaration' && node.id) {
                        fns.push({
                            name: node.id.name,
                            file: filename,
                            line: node.loc.start.line,
                            code: extractCode(node.loc.start.line, node.loc.end.line),
                            type: 'function',
                            isTopLevel: scope === 0,
                            params: (node.params || []).map(paramToString),
                            returnsValue: functionReturnsValue(node),
                            returnType: functionReturnsValue(node) ? 'value' : 'void',
                        });
                    }

                    if (node.type === 'VariableDeclaration') {
                        node.declarations.forEach((decl: any) => {
                            if (decl.init && (decl.init.type === 'ArrowFunctionExpression' || decl.init.type === 'FunctionExpression')) {
                                if (decl.id && decl.id.name) {
                                    fns.push({
                                        name: decl.id.name,
                                        file: filename,
                                        line: decl.loc.start.line,
                                        code: extractCode(decl.loc.start.line, decl.loc.end.line),
                                        type: decl.init.type === 'ArrowFunctionExpression' ? 'arrow' : 'function',
                                        isTopLevel: scope === 0,
                                        params: (decl.init.params || []).map(paramToString),
                                        returnsValue: functionReturnsValue(decl.init),
                                        returnType: functionReturnsValue(decl.init) ? 'value' : 'void',
                                    });
                                }
                            }
                        });
                    }

                    if (node.type === 'MethodDefinition' && node.key && node.key.name) {
                        fns.push({
                            name: node.key.name,
                            file: filename,
                            line: node.loc.start.line,
                            code: extractCode(node.loc.start.line, node.loc.end.line),
                            type: 'method',
                            isClassMethod: true,
                            isTopLevel: false,
                            params: (node.value?.params || []).map(paramToString),
                            returnsValue: functionReturnsValue(node.value),
                            returnType: functionReturnsValue(node.value) ? 'value' : 'void',
                        });
                    }

                    const newScope = (node.type === 'FunctionDeclaration' || node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') ? scope + 1 : scope;
                    Object.values(node).forEach((child) => {
                        if (Array.isArray(child)) {
                            child.forEach((c) => walk(c, newScope));
                        } else if (typeof child === 'object') {
                            walk(child, newScope);
                        }
                    });
                };

                walk(ast, 0);
                return fns;

            } catch (e) {
                console.warn(`AST parsing failed for ${filename}, falling back to regex`);
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

        const inferValueType = (node: any): string | undefined => {
            if (!node) return undefined;
            switch (node.type) {
                case 'Literal':
                    return typeof node.value;
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
                });

                const walk = (node: any, scope: number) => {
                    if (!node || typeof node !== 'object') return;

                    if (node.type === 'VariableDeclaration') {
                        node.declarations.forEach((decl: any) => {
                            if (decl.id && decl.id.name) {
                                vars.push({
                                    name: decl.id.name,
                                    file: filename,
                                    line: decl.loc?.start?.line || 0,
                                    kind: node.kind || 'unknown',
                                    valueType: inferValueType(decl.init),
                                    isTopLevel: scope === 0,
                                });
                            }
                        });
                    }

                    const newScope = (node.type === 'FunctionDeclaration' || node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') ? scope + 1 : scope;
                    Object.values(node).forEach((child) => {
                        if (Array.isArray(child)) child.forEach((c) => walk(c, newScope));
                        else if (typeof child === 'object') walk(child, newScope);
                    });
                };

                walk(ast, 0);
                return vars;
            } catch (e) {
                console.warn(`Variable parsing failed for ${filename}, using regex fallback`);
            }
        }

        const regex = /^(?:\s*)(const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
        let match;
        while ((match = regex.exec(content)) !== null) {
            const line = content.substring(0, match.index).split('\n').length;
            vars.push({
                name: match[2],
                file: filename,
                line,
                kind: (match[1] as any) || 'unknown',
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
                });

                // Walk AST to find ALL call expressions
                const walk = (node: any, currentFn?: string) => {
                    if (!node || typeof node !== 'object') return;

                    // Track current function scope
                    let fnContext = currentFn;
                    if (node.type === 'FunctionDeclaration' && node.id) {
                        fnContext = node.id.name;
                    } else if (node.type === 'VariableDeclaration') {
                        node.declarations.forEach((decl: any) => {
                            if (decl.id && decl.init && (decl.init.type === 'ArrowFunctionExpression' || decl.init.type === 'FunctionExpression')) {
                                fnContext = decl.id.name;
                            }
                        });
                    }

                    // CallExpression - tracks direct function calls foo()
                    if (node.type === 'CallExpression' && node.callee) {
                        let calleeName: string | null = null;

                        if (node.callee.type === 'Identifier') {
                            calleeName = node.callee.name;
                        } else if (node.callee.type === 'MemberExpression' && node.callee.property) {
                            // Handle obj.method() - extract method name
                            calleeName = node.callee.property.name || node.callee.property.value;
                        }

                        if (calleeName && fnNames.has(calleeName)) {
                            const line = node.loc ? node.loc.start.line : 0;
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
                        } else if (typeof child === 'object') {
                            walk(child, fnContext);
                        }
                    });
                };

                walk(ast);
                return callMap;

            } catch (e) {
                console.warn(`AST parsing failed for ${filename}, using regex fallback`);
            }
        }

        // Regex fallback for all languages (including Python, Go, etc.)
        fnNames.forEach(fnName => {
            // Match function calls: fnName(
            const callRegex = new RegExp(`\\b${fnName}\\s*\\(`, 'g');
            lines.forEach((line, idx) => {
                let match;
                while ((match = callRegex.exec(line)) !== null) {
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
