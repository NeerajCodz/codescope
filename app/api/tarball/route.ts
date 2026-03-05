import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

// Allow requests through self-signed TLS certs in dev only (e.g. corporate proxy).
// Guard against re-setting to avoid the repeated Node.js warning.
if (process.env.NODE_ENV !== 'production' && process.env['NODE_TLS_REJECT_UNAUTHORIZED'] !== '0') {
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
}

interface TarEntry {
  path: string;
  content: string;
  size: number;
}

/**
 * Downloads a GitHub repo tarball and extracts all text files in one shot.
 * Much faster than fetching files individually via the Contents API.
 * 
 * POST /api/tarball
 * Body: { owner, repo, branch?, token? }
 * Returns: { files: Array<{ path, content, size }>, branch }
 */
export async function POST(request: NextRequest) {
  try {
    const { owner, repo, branch, token } = await request.json();

    if (!owner || !repo) {
      return NextResponse.json({ error: 'owner and repo are required' }, { status: 400 });
    }

    // 1. Get default branch if not specified
    let targetBranch = branch;
    if (!targetBranch) {
      const repoRes = await ghFetch(
        `https://api.github.com/repos/${owner}/${repo}`,
        token
      );
      if (!repoRes.ok) {
        const err = await repoRes.text();
        return NextResponse.json(
          { error: `Failed to get repo info: ${err}` },
          { status: repoRes.status }
        );
      }
      const repoData = await repoRes.json();
      targetBranch = repoData.default_branch || 'main';
    }

    // 2. Download tarball
    const tarUrl = `https://api.github.com/repos/${owner}/${repo}/tarball/${targetBranch}`;
    const tarRes = await ghFetch(tarUrl, token);

    if (!tarRes.ok) {
      const err = await tarRes.text();
      return NextResponse.json(
        { error: `Failed to download tarball: ${err}` },
        { status: tarRes.status }
      );
    }

    const tarBuffer = await tarRes.arrayBuffer();

    // 3. Decompress gzip
    const decompressed = await decompressGzip(new Uint8Array(tarBuffer));

    // 4. Parse tar and extract files
    const entries = parseTar(decompressed);

    // 5. Filter and process files
    const BINARY_EXTS = new Set([
      '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.bmp', '.svg',
      '.woff', '.woff2', '.ttf', '.eot', '.otf',
      '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z',
      '.exe', '.dll', '.so', '.dylib', '.bin', '.dat',
      '.db', '.sqlite', '.mp3', '.mp4', '.wav', '.avi', '.mov', '.webm',
      '.pyc', '.pyo', '.class', '.o', '.obj', '.a', '.lib',
    ]);

    const IGNORE_DIRS = new Set([
      'node_modules', '.git', 'dist', 'build', '.next', '__pycache__',
      'vendor', 'target', '.gradle', '.idea', '.vscode',
      'coverage', '.nyc_output', '.cache', 'bower_components',
      '.svn', '.hg', 'venv', '.env', 'env',
    ]);

    const MAX_FILE_SIZE = 200_000; // 200KB

    const files: TarEntry[] = [];

    for (const entry of entries) {
      // Strip the root directory prefix (GitHub adds owner-repo-sha/)
      const rawPath = entry.name;
      const slashIdx = rawPath.indexOf('/');
      if (slashIdx === -1) continue;
      const path = rawPath.slice(slashIdx + 1);
      if (!path || path.endsWith('/')) continue;

      // Check ignored directories
      const parts = path.split('/');
      const isIgnored = parts.slice(0, -1).some(p => IGNORE_DIRS.has(p));
      if (isIgnored) continue;

      // Check binary extensions
      const lastDot = path.lastIndexOf('.');
      const ext = lastDot > -1 ? path.slice(lastDot).toLowerCase() : '';
      if (BINARY_EXTS.has(ext)) continue;

      // Size limit
      if (entry.data.length > MAX_FILE_SIZE) continue;

      // Try to decode as text
      try {
        const content = new TextDecoder('utf-8', { fatal: true }).decode(entry.data);

        // Verify it's actually text (skip files with too many null bytes)
        let nullCount = 0;
        const checkLen = Math.min(entry.data.length, 512);
        for (let i = 0; i < checkLen; i++) {
          if (entry.data[i] === 0) nullCount++;
        }
        if (nullCount > checkLen * 0.1) continue; // >10% null bytes = binary

        files.push({
          path,
          content,
          size: entry.data.length,
        });
      } catch {
        // Not valid UTF-8, skip
        continue;
      }
    }

    // Rate limit info from headers
    const rateLimitHeaders: Record<string, string> = {};
    const remaining = tarRes.headers.get('x-ratelimit-remaining');
    const limit = tarRes.headers.get('x-ratelimit-limit');
    const reset = tarRes.headers.get('x-ratelimit-reset');
    if (remaining) rateLimitHeaders['x-ratelimit-remaining'] = remaining;
    if (limit) rateLimitHeaders['x-ratelimit-limit'] = limit;
    if (reset) rateLimitHeaders['x-ratelimit-reset'] = reset;

    return NextResponse.json(
      { files, branch: targetBranch, fileCount: files.length },
      { headers: rateLimitHeaders }
    );

  } catch (error) {
    console.error('Tarball error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Tarball extraction failed' },
      { status: 500 }
    );
  }
}

// ---------- Helpers ----------

function ghFetch(url: string, token?: string): Promise<Response> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'CodeScope',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { headers });
}

async function decompressGzip(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();

  writer.write(new Uint8Array(data.buffer, data.byteOffset, data.byteLength) as unknown as BufferSource);
  writer.close();

  const chunks: Uint8Array[] = [];
  let totalLen = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLen += value.length;
  }

  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

interface TarRawEntry {
  name: string;
  data: Uint8Array;
  type: number;
}

function parseTar(data: Uint8Array): TarRawEntry[] {
  const entries: TarRawEntry[] = [];
  let offset = 0;

  while (offset < data.length - 512) {
    // Read 512-byte header
    const header = data.slice(offset, offset + 512);

    // Check for empty end-of-archive blocks
    let allZeros = true;
    for (let i = 0; i < 512; i++) {
      if (header[i] !== 0) { allZeros = false; break; }
    }
    if (allZeros) break;

    // Parse header fields
    const name = readString(header, 0, 100);
    const sizeOctal = readString(header, 124, 12);
    const typeFlag = header[156];

    // Handle UStar long name prefix
    const prefix = readString(header, 345, 155);
    const fullName = prefix ? `${prefix}/${name}` : name;

    // Parse size (octal)
    let size = 0;
    if (sizeOctal) {
      // Handle both octal string and binary size formats
      if (sizeOctal.charCodeAt(0) === 0x80) {
        // Binary size format (big-endian) - rare
        for (let i = 1; i < sizeOctal.length; i++) {
          size = size * 256 + sizeOctal.charCodeAt(i);
        }
      } else {
        size = parseInt(sizeOctal.trim(), 8) || 0;
      }
    }

    offset += 512; // Skip header

    if (size > 0) {
      // Type 0 or ASCII '0' (48) = regular file
      if (typeFlag === 0 || typeFlag === 48) {
        const fileData = data.slice(offset, offset + size);
        entries.push({ name: fullName, data: fileData, type: typeFlag });
      }

      // Advance to next 512-byte boundary
      const blocks = Math.ceil(size / 512);
      offset += blocks * 512;
    }
  }

  return entries;
}

function readString(buf: Uint8Array, offset: number, length: number): string {
  let end = offset;
  const max = offset + length;
  while (end < max && buf[end] !== 0) end++;
  const bytes = buf.slice(offset, end);
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}
