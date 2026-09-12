import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function usage() {
  console.log(`
Record or compare a byte-level fingerprint of the build output.

Usage:
  pnpm dist:fingerprint -- --write=.verify/baseline.json
  pnpm dist:fingerprint -- --compare=.verify/baseline.json [--write=.verify/current.json]

Options:
  --dist=<dir>       Build output directory (default: dist).
  --write=<file>     Write the fingerprint manifest to a JSON file.
  --compare=<file>   Compare the build output against a recorded manifest.
  --quiet            Only print the aggregate hash and the verdict.

Exit code is 1 when --compare finds any added, removed, or modified file.
`);
}

function parseArgs(argv) {
  const options = { distDir: path.join(rootDir, 'dist') };
  for (const argument of argv) {
    if (argument === '--help') options.help = true;
    else if (argument === '--quiet') options.quiet = true;
    else if (argument.startsWith('--dist=')) options.distDir = path.resolve(rootDir, argument.slice('--dist='.length));
    else if (argument.startsWith('--write=')) options.write = path.resolve(rootDir, argument.slice('--write='.length));
    else if (argument.startsWith('--compare=')) options.compare = path.resolve(rootDir, argument.slice('--compare='.length));
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.help && !options.write && !options.compare) {
    throw new Error('Pass --write=<file>, --compare=<file>, or both.');
  }
  return options;
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(entries.map(async (entry) => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(filename) : [filename];
  }));
  return groups.flat();
}

async function isDirectory(directory) {
  try { return (await stat(directory)).isDirectory(); } catch { return false; }
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

/**
 * Hashes every file in the build output. The aggregate digest covers the sorted
 * `relative-path sha256` pairs, so it changes when a file is added, removed,
 * renamed, or edited by even one byte.
 */
async function fingerprint(distDir) {
  const filenames = (await walk(distDir)).sort();
  const files = {};
  for (const filename of filenames) {
    files[toPosix(path.relative(distDir, filename))] = createHash('sha256').update(await readFile(filename)).digest('hex');
  }
  const aggregate = createHash('sha256')
    .update(Object.entries(files).map(([relative, hash]) => `${relative} ${hash}\n`).join(''))
    .digest('hex');
  return { aggregate, fileCount: Object.keys(files).length, files };
}

function readManifest(source, label) {
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
  if (typeof parsed?.aggregate !== 'string' || typeof parsed?.files !== 'object' || parsed.files === null) {
    throw new Error(`${label} is not a fingerprint manifest.`);
  }
  return parsed;
}

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  usage();
  process.exit(0);
}

try {
  if (!await isDirectory(options.distDir)) {
    throw new Error(`${path.relative(rootDir, options.distDir)} is missing; run pnpm build first.`);
  }

  const current = await fingerprint(options.distDir);
  const manifest = {
    distDir: toPosix(path.relative(rootDir, options.distDir)) || '.',
    aggregate: current.aggregate,
    fileCount: current.fileCount,
    files: current.files,
  };

  if (options.write) {
    await mkdir(path.dirname(options.write), { recursive: true });
    await writeFile(options.write, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    if (!options.quiet) console.log(`Recorded ${current.fileCount} file(s) to ${toPosix(path.relative(rootDir, options.write))}.`);
  }

  console.log(`dist fingerprint: ${current.aggregate} (${current.fileCount} files)`);

  if (options.compare) {
    const baseline = readManifest(await readFile(options.compare, 'utf8'), toPosix(path.relative(rootDir, options.compare)));
    const differences = [];
    for (const [relative, hash] of Object.entries(baseline.files)) {
      if (!Object.hasOwn(current.files, relative)) differences.push(`removed   ${relative}`);
      else if (current.files[relative] !== hash) differences.push(`modified  ${relative}`);
    }
    for (const relative of Object.keys(current.files)) {
      if (!Object.hasOwn(baseline.files, relative)) differences.push(`added     ${relative}`);
    }

    if (differences.length === 0 && baseline.aggregate === current.aggregate) {
      console.log(`IDENTICAL to ${toPosix(path.relative(rootDir, options.compare))} (${baseline.fileCount} files).`);
    } else {
      for (const difference of differences.slice(0, 50)) console.error(`  ${difference}`);
      if (differences.length > 50) console.error(`  ... and ${differences.length - 50} more`);
      console.error(`MISMATCH: ${differences.length} file(s) differ from ${toPosix(path.relative(rootDir, options.compare))}.`);
      process.exitCode = 1;
    }
  }
} catch (error) {
  console.error(`dist:fingerprint failed: ${error.message}`);
  process.exit(1);
}
