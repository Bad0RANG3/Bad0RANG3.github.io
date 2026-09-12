import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';

import { parseOptions } from './lib/args.mjs';
import { isValidDate, localDate, normalizeSlug } from './lib/content.mjs';
import { fromRoot, rootDir } from './lib/paths.mjs';

const thoughtsDir = fromRoot('src', 'content', 'thoughts');

function usage() {
  console.log(`
Create a thought template.

Usage:
  pnpm new:thought -- <slug> [--date YYYY-MM-DD]

The resulting file only requires a date in frontmatter; write the thought below it.
Run without a slug in an interactive terminal to answer a prompt.
`);
}

async function promptForSlug() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Missing a slug. Use --help for non-interactive usage.');
  }
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await readline.question('Slug: ');
  } finally {
    readline.close();
  }
}

try {
  // Parsed inside the try so that a mistyped flag is reported through the same
  // error path as a failed write, instead of as an uncaught stack trace.
  const { options, positional } = parseOptions(process.argv.slice(2), { allowPositional: true });
  if (options.help) {
    usage();
    process.exit(0);
  }

  const slug = normalizeSlug(positional[0] ?? options.slug ?? await promptForSlug());
  const date = String(options.date ?? localDate()).trim();
  if (!isValidDate(date)) throw new Error('Date must use YYYY-MM-DD and be a real calendar date.');

  const destination = path.join(thoughtsDir, `${slug}.md`);
  try {
    await access(destination);
    throw new Error(`Refusing to overwrite existing file: ${path.relative(rootDir, destination)}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  const content = `---\ndate: ${date}\n---\n\nWrite a short thought here.\n`;
  await mkdir(thoughtsDir, { recursive: true });
  await writeFile(destination, content, 'utf8');
  console.log(`Created ${path.relative(rootDir, destination)}`);
} catch (error) {
  console.error(`new:thought failed: ${error.message}`);
  process.exitCode = 1;
}