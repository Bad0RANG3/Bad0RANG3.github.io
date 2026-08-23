import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const thoughtsDir = path.join(rootDir, 'src', 'content', 'thoughts');

function usage() {
  console.log(`
Create a thought template.

Usage:
  pnpm new:thought -- <slug> [--date YYYY-MM-DD]

The resulting file only requires a date in frontmatter; write the thought below it.
Run without a slug in an interactive terminal to answer a prompt.
`);
}

function localDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function normalizeSlug(value) {
  const slug = String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\.(?:md|mdx)$/i, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  if (!slug || slug === '.' || slug === '..' || /[\\/\0]/.test(slug) || slug.includes('..')) {
    throw new Error('Slug must be a simple file name and cannot contain path separators or "..".');
  }
  return slug;
}

function parseArgs(argv) {
  const options = {};
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) {
      positional.push(argument);
      continue;
    }
    const [key, inlineValue] = argument.slice(2).split(/=(.*)/s, 2);
    if (key === 'help') {
      options.help = true;
      continue;
    }
    if (inlineValue !== undefined) {
      options[key] = inlineValue;
      continue;
    }
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) throw new Error(`Missing a value for --${key}.`);
    options[key] = next;
    index += 1;
  }
  return { options, positional };
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

const { options, positional } = parseArgs(process.argv.slice(2));
if (options.help) {
  usage();
  process.exit(0);
}

try {
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