/* make.fun frontend kit library — public API types + dossier builder.
   NOTE: the competition kit ships this file; entrants copy it unchanged
   (vendor/makefun-frontend.ts). This copy is provided so the entry builds
   standalone; replace it with the kit's copy before submitting. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const MAKEFUN_API = 'https://make.fun/api';
export const MAKEFUN_SITE = 'https://make.fun';

export interface DossierFile {
  path: string;
  size: number;
  kind: string;
  declarations: string[];
}
export interface Dossier {
  firstLoadBytes: number;
  firstLoadFiles: string[];
  files: DossierFile[];
  totalBytes: number;
  fileCount: number;
}

function toPosix(p: string): string {
  return p.split(sep).join('/');
}

/** Every regular file under dir, as posix relative paths, sorted. */
export function listFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d).sort()) {
      const full = join(d, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (st.isFile()) out.push(toPosix(relative(dir, full)));
    }
  };
  walk(dir);
  return out.sort();
}

/** Top-level declarations of a JS/TS module: exported names + function/class names. */
export function jsDeclarations(src: string): string[] {
  const names = new Set<string>();
  const patterns = [
    /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
    /export\s+class\s+([A-Za-z_$][\w$]*)/g,
    /export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,
    /export\s+interface\s+([A-Za-z_$][\w$]*)/g,
    /export\s+type\s+([A-Za-z_$][\w$]*)/g,
    /export\s*\{([^}]+)\}/g,
    /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm,
    /^class\s+([A-Za-z_$][\w$]*)/gm,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      if (re.source.includes('export\\s*\\{')) {
        for (const part of m[1].split(',')) {
          const name = part.trim().split(/\s+as\s+/).pop()?.trim();
          if (name) names.add(name);
        }
      } else if (m[1]) names.add(m[1]);
    }
  }
  return [...names].sort();
}

/** Static import specifiers of a JS/TS module (relative ones only). */
export function jsImports(src: string): string[] {
  const out = new Set<string>();
  const re = /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const spec = m[1] || m[2];
    if (spec && (spec.startsWith('./') || spec.startsWith('../'))) out.add(spec);
  }
  return [...out].sort();
}

/** Asset references of an HTML page: <link rel=stylesheet>, <script src>, <img src>. */
export function htmlReferences(src: string): string[] {
  const out = new Set<string>();
  const re = /<(?:link|script|img)[^>]+(?:href|src)\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) out.add(m[1]);
  return [...out].sort();
}

function kindOf(path: string): string {
  if (path.endsWith('.html') || path.endsWith('.htm')) return 'html';
  if (path.endsWith('.css')) return 'css';
  if (path.endsWith('.js') || path.endsWith('.mjs')) return 'js';
  if (path.endsWith('.ts')) return 'ts';
  if (/\.(png|jpe?g|webp|gif|svg|ico)$/.test(path)) return 'image';
  if (/\.(woff2?|ttf|otf)$/.test(path)) return 'font';
  return 'other';
}

function declarationsOf(path: string, src: string): string[] {
  const kind = kindOf(path);
  if (kind === 'js' || kind === 'ts') return jsDeclarations(src);
  if (kind === 'html') {
    const title = /<title>([^<]*)<\/title>/i.exec(src)?.[1]?.trim();
    return title ? [`title:${title}`] : [];
  }
  if (kind === 'css') {
    const selectors = new Set<string>();
    const re = /([.#][A-Za-z_-][\w-]*)\s*[,{]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) selectors.add(m[1]);
    return [...selectors].sort().slice(0, 40);
  }
  return [];
}

/**
 * Build the entry dossier for an app/ directory: the first-load byte total,
 * then every file's path, size and declarations. Deterministic: sorted
 * paths, no timestamps, stable JSON. Never includes file contents.
 */
export function buildDossier(appDir: string): Dossier {
  const files = listFiles(appDir);
  const sizes = new Map<string, number>();
  const contents = new Map<string, string>();
  for (const f of files) {
    const full = join(appDir, f);
    sizes.set(f, statSync(full).size);
    if (/\.(html?|css|js|mjs|ts|json|txt|svg)$/.test(f)) {
      try { contents.set(f, readFileSync(full, 'utf8')); } catch { /* binary */ }
    }
  }
  // First load: index.html + its references + their transitive JS imports.
  const firstLoad = new Set<string>();
  const queue: string[] = ['index.html'];
  while (queue.length) {
    const cur = queue.shift() as string;
    if (firstLoad.has(cur) || !sizes.has(cur)) continue;
    firstLoad.add(cur);
    const src = contents.get(cur);
    if (!src) continue;
    const kind = kindOf(cur);
    const refs = kind === 'html' ? htmlReferences(src) : kind === 'js' || kind === 'ts' ? jsImports(src) : [];
    for (const ref of refs) {
      if (/^(https?:|data:)/.test(ref)) continue;
      const resolved = resolveRef(cur, ref);
      if (resolved && sizes.has(resolved)) queue.push(resolved);
    }
  }
  const firstLoadFiles = [...firstLoad].sort();
  const firstLoadBytes = firstLoadFiles.reduce((a, f) => a + (sizes.get(f) || 0), 0);
  const dossierFiles: DossierFile[] = files.map((f) => ({
    path: f,
    size: sizes.get(f) || 0,
    kind: kindOf(f),
    declarations: contents.has(f) ? declarationsOf(f, contents.get(f) as string) : [],
  }));
  return {
    firstLoadBytes,
    firstLoadFiles,
    files: dossierFiles,
    totalBytes: dossierFiles.reduce((a, f) => a + f.size, 0),
    fileCount: dossierFiles.length,
  };
}

function resolveRef(fromFile: string, ref: string): string | null {
  const clean = ref.split(/[?#]/)[0];
  if (!clean) return null;
  if (clean.startsWith('/')) return clean.slice(1);
  const dir = fromFile.includes('/') ? fromFile.slice(0, fromFile.lastIndexOf('/')) : '';
  const parts = (dir ? dir.split('/') : []).concat(clean.split('/'));
  const stack: string[] = [];
  for (const p of parts) {
    if (p === '.' || p === '') continue;
    if (p === '..') stack.pop();
    else stack.push(p);
  }
  return stack.join('/');
}
