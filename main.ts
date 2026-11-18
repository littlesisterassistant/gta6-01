// SOLMAR HEAT — entrypoint: copies game/ + screenshots/ to the output
// directory and writes /output/dossier.json with the kit's buildDossier.
// Node 22, standard library only. Deterministic: same bytes every run.
import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname ?? '.');

function outDir(): string {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--output' && argv[i + 1]) return resolve(argv[i + 1]);
    if (argv[i].startsWith('--output=')) return resolve(argv[i].slice('--output='.length));
  }
  if (process.env.MAKEFUN_OUTPUT_DIR) return resolve(process.env.MAKEFUN_OUTPUT_DIR);
  return '/output';
}

// Copy a tree of regular files, skipping dot-names, in sorted order so the
// output is stable. Directories are recreated; symlinks are refused.
function copyTree(src: string, dst: string): void {
  mkdirSync(dst, { recursive: true });
  const names = readdirSync(src).sort();
  for (const name of names) {
    if (name.startsWith('.')) continue;
    const from = join(src, name);
    const to = join(dst, name);
    const st = statSync(from);
    if (st.isDirectory()) {
      copyTree(from, to);
    } else if (st.isFile()) {
      cpSync(from, to);
    } else {
      throw new Error(`refusing non-regular entry: ${from}`);
    }
  }
}

function main(): void {
  const out = outDir();
  const gameSrc = join(ROOT, 'game');
  const shotsSrc = join(ROOT, 'screenshots');
  if (!existsSync(gameSrc) || !statSync(gameSrc).isDirectory()) {
    console.error('game/ is missing');
    process.exit(2);
  }
  // Clear the output directory's CONTENTS, never the directory itself: the
  // grader runs as uid 65534 and /output is a mount owned by root, so
  // deleting the directory itself fails with EPERM.
  mkdirSync(out, { recursive: true });
  for (const name of readdirSync(out)) {
    rmSync(join(out, name), { recursive: true, force: true });
  }
  copyTree(gameSrc, join(out, 'game'));
  if (existsSync(shotsSrc) && statSync(shotsSrc).isDirectory()) {
    copyTree(shotsSrc, join(out, 'screenshots'));
  } else {
    mkdirSync(join(out, 'screenshots'), { recursive: true });
  }
  const dossier = buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 48 * 1024 * 1024,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(out, 'dossier.json'), dossier);
  console.log(`wrote ${out} (dossier ${dossier.length} bytes)`);
}

main();
