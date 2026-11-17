/* Entry program (program/v1): hand the frontend in.
   Copies app/ and screenshots/ from the repository to the output directory
   and writes dossier.json with buildDossier from vendor/makefun-frontend.ts.
   In the grader, the repo is read-only at /bot and output is /output
   (MAKEFUN_BOT_DIR / MAKEFUN_OUTPUT_DIR); outside, MAKEFUN_OUTPUT_DIR stands
   in for /output and the repo is the working directory. Deterministic. */
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-frontend.ts';

const botDir: string = process.env.MAKEFUN_BOT_DIR || (existsSync('/bot/main.ts') ? '/bot' : process.cwd());
const outDir: string = process.env.MAKEFUN_OUTPUT_DIR || (existsSync('/output') ? '/output' : join(process.cwd(), 'out'));

function copyTree(src: string, dest: string): void {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true, dereference: false });
}

copyTree(join(botDir, 'app'), join(outDir, 'app'));
copyTree(join(botDir, 'screenshots'), join(outDir, 'screenshots'));

const dossier = buildDossier(join(outDir, 'app'));
writeFileSync(join(outDir, 'dossier.json'), JSON.stringify(dossier, null, 2) + '\n', 'utf8');
