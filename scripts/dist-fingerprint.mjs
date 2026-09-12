import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { parseFlags } from './lib/args.mjs';
import { isDirectory, walk } from './lib/fs.mjs';
import { fromRoot, rootDir } from './lib/paths.mjs';

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

const parsed = parseFlags(process.argv.slice(2), { booleans: ['quiet'], values: ['dist', 'write', 'compare'] });
if (parsed.help) {
  usage();
  process.exit(0);
}

const options = {
  distDir: parsed.dist ? path.resolve(rootDir, parsed.dist) : fromRoot('dist'),
  write: parsed.write ? path.resolve(rootDir, parsed.write) : undefined,
  compare: parsed.compare ? path.resolve(rootDir, parsed.compare) : undefined,
  quiet: parsed.quiet === true,
};
if (!options.write && !options.compare) {
  throw new Error('Pass --write=<file>, --compare=<file>, or both.');
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
