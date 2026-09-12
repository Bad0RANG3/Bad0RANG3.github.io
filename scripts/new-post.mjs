import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';

import { parseOptions } from './lib/args.mjs';
import { isValidDate, localDate, normalizeSlug } from './lib/content.mjs';
import { fromRoot, rootDir } from './lib/paths.mjs';

const postsDir = fromRoot('src', 'content', 'posts');

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

let prompt;
try {
  // Parsed inside the try so that a mistyped flag is reported through the same
  // error path as a failed write, instead of as an uncaught stack trace.
  const { options, positional } = parseOptions(process.argv.slice(2), {
    booleans: ['draft', 'featured'],
    allowPositional: true,
    allowNegation: true,
  });
  if (options.help) {
    usage();
    process.exit(0);
  }

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
  const coverAlt = options.coverAlt ? requiredText(options.coverAlt, 'Cover alt') : '';
  const series = options.series ? requiredText(options.series, 'Series') : '';
  const seriesOrder = options.seriesOrder === undefined ? undefined : Number(options.seriesOrder);

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