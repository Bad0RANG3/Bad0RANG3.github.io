import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const postsDir = path.join(rootDir, 'src', 'content', 'posts');

function usage() {
  console.log(`
Create a post template.

Usage:
  pnpm new:post -- <slug> [--title "..."] [--description "..."] [--category "..."] [--tags "tag-a,tag-b"]

Options:
  --date YYYY-MM-DD       Defaults to today.
  --draft                 Create as a draft.
  --featured              Mark the post as featured.
  --cover /image.png      Public cover image path; requires --cover-alt.
  --cover-alt "..."       Alternative text for the cover.
  --series "..."          Series name.
  --series-order 1        Positive order inside the series.
  --lang zh-CN            Content language (default: zh-CN).

Run without values in an interactive terminal to answer prompts.
`);
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
    const [rawKey, inlineValue] = argument.slice(2).split(/=(.*)/s, 2);
    if (rawKey.startsWith('no-')) {
      options[rawKey.slice(3)] = false;
      continue;
    }
    if (rawKey === 'help') {
      options.help = true;
      continue;
    }
    if (rawKey === 'draft' || rawKey === 'featured') {
      options[rawKey] = inlineValue === undefined ? true : inlineValue !== 'false';
      continue;
    }
    if (inlineValue !== undefined) {
      options[rawKey] = inlineValue;
      continue;
    }
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) throw new Error(`Missing a value for --${rawKey}.`);
    options[rawKey] = next;
    index += 1;
  }
  return { options, positional };
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

function requiredText(value, label) {
  const text = String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function yamlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function parseTags(value) {
  const tags = String(value ?? '').split(',').map((tag) => tag.trim()).filter(Boolean);
  if (tags.length === 0) throw new Error('At least one tag is required.');
  if (new Set(tags).size !== tags.length) throw new Error('Tags must be unique.');
  return tags;
}

async function createPrompter() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Missing required values. Use --help for non-interactive usage.');
  }
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  return {
    async ask(label, fallback = '') {
      const answer = await readline.question(`${label}${fallback ? ` (${fallback})` : ''}: `);
      return answer.trim() || fallback;
    },
    close() { readline.close(); },
  };
}

const { options, positional } = parseArgs(process.argv.slice(2));
if (options.help) {
  usage();
  process.exit(0);
}

let prompt;
try {
  const getValue = async (key, label, fallback = '') => {
    if (options[key] !== undefined) return options[key];
    if (!prompt) prompt = await createPrompter();
    return prompt.ask(label, fallback);
  };

  const slug = normalizeSlug(positional[0] ?? await getValue('slug', 'Slug'));
  const title = requiredText(await getValue('title', 'Title'), 'Title');
  const description = requiredText(await getValue('description', 'Description'), 'Description');
  const category = requiredText(await getValue('category', 'Category'), 'Category');
  const tags = parseTags(await getValue('tags', 'Tags (comma-separated)'));
  const date = String(options.date ?? localDate()).trim();
  const language = String(options.lang ?? 'zh-CN').trim() || 'zh-CN';
  const cover = options.cover ? requiredText(options.cover, 'Cover') : '';
  const coverAlt = options['cover-alt'] ? requiredText(options['cover-alt'], 'Cover alt') : '';
  const series = options.series ? requiredText(options.series, 'Series') : '';
  const seriesOrder = options['series-order'] === undefined ? undefined : Number(options['series-order']);

  if (!isValidDate(date)) throw new Error('Date must use YYYY-MM-DD and be a real calendar date.');
  if (cover && !coverAlt) throw new Error('--cover requires --cover-alt.');
  if (!cover && coverAlt) throw new Error('--cover-alt requires --cover.');
  if (seriesOrder !== undefined && (!series || !Number.isInteger(seriesOrder) || seriesOrder < 1)) {
    throw new Error('--series-order must be a positive integer and requires --series.');
  }

  const destination = path.join(postsDir, `${slug}.md`);
  try {
    await access(destination);
    throw new Error(`Refusing to overwrite existing file: ${path.relative(rootDir, destination)}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  const lines = [
    '---',
    `title: ${yamlString(title)}`,
    `description: ${yamlString(description)}`,
    `date: ${date}`,
    'tags:',
    ...tags.map((tag) => `  - ${yamlString(tag)}`),
    `category: ${yamlString(category)}`,
    `featured: ${options.featured === true}`,
    `draft: ${options.draft === true}`,
  ];
  if (cover) lines.push(`cover: ${yamlString(cover)}`, `coverAlt: ${yamlString(coverAlt)}`);
  if (series) lines.push(`series: ${yamlString(series)}`);
  if (seriesOrder !== undefined) lines.push(`seriesOrder: ${seriesOrder}`);
  lines.push(`lang: ${yamlString(language)}`, '---', '', `# ${title}`, '', '## Summary', '', 'Write the opening context and the problem this post solves.', '', '## Notes', '', '- Add the important details here.', '', '## References', '', '- Add links, commands, or source material here.', '');

  await mkdir(postsDir, { recursive: true });
  await writeFile(destination, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Created ${path.relative(rootDir, destination)}`);
} catch (error) {
  console.error(`new:post failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  prompt?.close();
}