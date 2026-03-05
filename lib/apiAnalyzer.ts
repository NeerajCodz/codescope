// API endpoint analyzer - detects Created and Used APIs in codebase

import { AnalysisData } from '@/types';
import { CreatedAPI, UsedAPI, APIStats, ServiceGroup } from '@/types/apiAnalysis';

// Extract route params from path like /api/users/:id → ['id']
function extractRouteParams(path: string): string[] {
  const params: string[] = [];
  const colonParams = path.match(/:(\w+)/g);
  if (colonParams) params.push(...colonParams.map(p => p.slice(1)));
  const bracketParams = path.match(/\[(\w+)\]/g);
  if (bracketParams) params.push(...bracketParams.map(p => p.slice(1, -1)));
  return params;
}

// Try to extract response/body info from handler code
function extractHandlerDetails(lines: string[], startLine: number): {
  queryParams: string[];
  bodyFields: string[];
  responseFields: string[];
  middleware: string[];
  description: string;
} {
  const queryParams: string[] = [];
  const bodyFields: string[] = [];
  const responseFields: string[] = [];
  const middleware: string[] = [];
  let description = '';

  // Look at surrounding lines (up to 40 lines after handler definition)
  const region = lines.slice(startLine - 1, startLine + 40);
  const regionText = region.join('\n');

  // Query params: searchParams.get('x'), query.x, req.query.x
  const queryMatches = regionText.matchAll(/(?:searchParams|query)\.(?:get\(['"](\w+)['"]\)|(\w+))/g);
  for (const m of queryMatches) queryParams.push(m[1] || m[2]);

  // Body fields: body.x, req.body.x, { x } = await request.json()
  const bodyDestructure = regionText.match(/\{\s*([\w\s,]+)\s*\}\s*=\s*(?:await\s+)?(?:request|req)\.(?:json|body)/);
  if (bodyDestructure) {
    bodyFields.push(...bodyDestructure[1].split(',').map(s => s.trim()).filter(Boolean));
  }
  const bodyAccess = regionText.matchAll(/(?:body|data)\.(\w+)/g);
  for (const m of bodyAccess) {
    if (!bodyFields.includes(m[1])) bodyFields.push(m[1]);
  }

  // Response structure: NextResponse.json({ x, y }), res.json({ x })
  const jsonResp = regionText.match(/\.json\(\s*\{([^}]{1,200})\}/);
  if (jsonResp) {
    const fields = jsonResp[1].matchAll(/(\w+)\s*[,:]/g);
    for (const m of fields) responseFields.push(m[1]);
  }

  // Middleware: from comment or decorators
  const mwMatch = regionText.match(/middleware\s*[:=]\s*\[([^\]]+)\]/);
  if (mwMatch) middleware.push(...mwMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')));

  // Description from JSDoc or comment above
  if (startLine > 1) {
    const above = lines.slice(Math.max(0, startLine - 5), startLine - 1).join('\n');
    const jsdoc = above.match(/\*\s*(.+?)(?:\n|\*\/)/);
    if (jsdoc) description = jsdoc[1].trim();
    const lineComment = above.match(/\/\/\s*(.+)$/m);
    if (!description && lineComment) description = lineComment[1].trim();
  }

  return { queryParams, bodyFields, responseFields, middleware, description };
}

// Detect API routes/handlers defined in the codebase
export function detectCreatedAPIs(data: AnalysisData): CreatedAPI[] {
  const apis: CreatedAPI[] = [];

  data.files.forEach(file => {
    if (!file.content) return;
    const lines = file.content.split('\n');

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;

      // Next.js App Router: export async function GET/POST/PUT/DELETE/PATCH
      const nextMatch = line.match(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*\(/);
      if (nextMatch) {
        const routePath = file.path
          .replace(/^app/, '')
          .replace(/\/route\.(ts|js|tsx|jsx)$/, '')
          .replace(/\[([^\]]+)\]/g, ':$1') || '/';
        const details = extractHandlerDetails(lines, lineNum);
        const params = extractRouteParams(routePath);
        apis.push({
          method: nextMatch[1] as CreatedAPI['method'],
          path: routePath,
          file: file.path,
          line: lineNum,
          handler: nextMatch[1],
          framework: 'Next.js App Router',
          params: params.length > 0 ? params : details.queryParams.length > 0 ? details.queryParams : undefined,
          middleware: details.middleware.length > 0 ? details.middleware : undefined,
          description: details.description || undefined,
          queryParams: details.queryParams,
          bodyFields: details.bodyFields,
          responseFields: details.responseFields,
        });
      }

      // Express/Fastify: app.get/post/put/delete/patch('path', ...)
      const expressMatch = line.match(/(?:app|router|server)\.(get|post|put|delete|patch|all)\s*\(\s*['"`]([^'"`]+)['"`]/i);
      if (expressMatch) {
        const routePath = expressMatch[2];
        const details = extractHandlerDetails(lines, lineNum);
        const params = extractRouteParams(routePath);
        apis.push({
          method: expressMatch[1].toUpperCase() as CreatedAPI['method'],
          path: routePath,
          file: file.path,
          line: lineNum,
          handler: `${expressMatch[1]}Handler`,
          framework: 'Express/Fastify',
          params: params.length > 0 ? params : undefined,
          description: details.description || undefined,
          queryParams: details.queryParams,
          bodyFields: details.bodyFields,
          responseFields: details.responseFields,
        });
      }

      // Next.js Pages API: pages/api/ with default export
      if (file.path.includes('pages/api/') && line.match(/export\s+default/)) {
        const routePath = file.path
          .replace(/^pages/, '')
          .replace(/\.(ts|js|tsx|jsx)$/, '')
          .replace(/\/index$/, '')
          .replace(/\[([^\]]+)\]/g, ':$1');
        const details = extractHandlerDetails(lines, lineNum);
        apis.push({
          method: 'ALL',
          path: routePath,
          file: file.path,
          line: lineNum,
          handler: 'default',
          framework: 'Next.js Pages API',
          description: details.description || undefined,
          queryParams: details.queryParams,
          bodyFields: details.bodyFields,
          responseFields: details.responseFields,
        });
      }

      // Flask/FastAPI: @app.route / @app.get etc
      const pythonMatch = line.match(/@(?:app|router)\.(route|get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/);
      if (pythonMatch) {
        const details = extractHandlerDetails(lines, lineNum);
        apis.push({
          method: pythonMatch[1] === 'route' ? 'ALL' : pythonMatch[1].toUpperCase() as CreatedAPI['method'],
          path: pythonMatch[2],
          file: file.path,
          line: lineNum,
          handler: 'handler',
          framework: 'Python (Flask/FastAPI)',
          description: details.description || undefined,
          queryParams: details.queryParams,
          bodyFields: details.bodyFields,
          responseFields: details.responseFields,
        });
      }
    });
  });

  return apis;
}

// Detect API calls/usage in the codebase
export function detectUsedAPIs(data: AnalysisData): UsedAPI[] {
  const apis: UsedAPI[] = [];

  data.files.forEach(file => {
    if (!file.content) return;
    const lines = file.content.split('\n');

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;

      // fetch() calls
      const fetchMatch = line.match(/fetch\s*\(\s*[`'"](https?:\/\/[^'"`\s]+|\/[^'"`\s]*)[`'"]/);
      if (fetchMatch) {
        const methodMatch = line.match(/method\s*:\s*['"](\w+)['"]/i);
        apis.push({
          url: fetchMatch[1],
          method: methodMatch ? methodMatch[1].toUpperCase() : 'GET',
          file: file.path,
          line: lineNum,
          library: 'fetch',
        });
      }

      // Template literal fetch
      const templateFetch = line.match(/fetch\s*\(\s*`([^`]+)`/);
      if (templateFetch && !fetchMatch) {
        const url = templateFetch[1].replace(/\$\{[^}]+\}/g, '{param}');
        if (url.startsWith('http') || url.startsWith('/')) {
          apis.push({
            url,
            method: 'GET',
            file: file.path,
            line: lineNum,
            library: 'fetch',
          });
        }
      }

      // axios calls
      const axiosMatch = line.match(/axios\.(get|post|put|delete|patch|head|options)\s*\(\s*[`'"](https?:\/\/[^'"`\s]+|\/[^'"`\s]*)[`'"]/i);
      if (axiosMatch) {
        apis.push({
          url: axiosMatch[2],
          method: axiosMatch[1].toUpperCase(),
          file: file.path,
          line: lineNum,
          library: 'axios',
        });
      }

      // XMLHttpRequest
      const xhrMatch = line.match(/\.open\s*\(\s*['"](\w+)['"]\s*,\s*['"]([^'"]+)['"]/);
      if (xhrMatch) {
        apis.push({
          url: xhrMatch[2],
          method: xhrMatch[1].toUpperCase(),
          file: file.path,
          line: lineNum,
          library: 'xhr',
        });
      }
    });
  });

  return apis;
}

// Group used APIs by base URL/service
export function groupByService(apis: UsedAPI[]): ServiceGroup[] {
  const groups = new Map<string, ServiceGroup>();

  apis.forEach(api => {
    let baseUrl: string;
    try {
      if (api.url.startsWith('http')) {
        const parsed = new URL(api.url);
        baseUrl = parsed.origin;
      } else {
        baseUrl = 'Internal API';
      }
    } catch {
      baseUrl = 'Unknown';
    }

    if (!groups.has(baseUrl)) {
      groups.set(baseUrl, {
        baseUrl,
        name: baseUrl.replace(/https?:\/\//, '').split('/')[0] || 'Internal',
        endpoints: [],
        frequency: 0,
        files: [],
      });
    }

    const group = groups.get(baseUrl)!;
    group.endpoints.push(api);
    group.frequency++;
    if (!group.files.includes(api.file)) group.files.push(api.file);
  });

  return Array.from(groups.values()).sort((a, b) => b.frequency - a.frequency);
}

// Calculate API stats
export function getAPIStats(created: CreatedAPI[], used: UsedAPI[]): APIStats {
  const services = new Set<string>();
  used.forEach(api => {
    try {
      if (api.url.startsWith('http')) {
        services.add(new URL(api.url).origin);
      }
    } catch { /* skip */ }
  });

  const methods: Record<string, number> = {};
  [...created, ...used].forEach(api => {
    methods[api.method] = (methods[api.method] || 0) + 1;
  });

  const frameworks = [...new Set(created.map(a => a.framework))];

  return {
    totalCreated: created.length,
    totalUsed: used.length,
    uniqueServices: services.size,
    frameworks,
    methods,
    exposedEndpoints: created.length,
  };
}
