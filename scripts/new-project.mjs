import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectConfigPath = path.join(rootDir, 'src', 'config', 'projects.ts');
const allowedTones = new Set(['teal', 'coral', 'citrus']);

function usage() {
  console.log(`
Create a project configuration snippet.

Usage:
  pnpm new:project -- --slug "..." --name "..." --summary "..." --description "..." --href "..." --action-label "..." --type "..." --status "..." --tags "tag-a,tag-b" --highlights "point one|point two" [options]

Options:
  --code 06              Defaults to the next code found in src/config/projects.ts.
  --tone teal            One of: teal, coral, citrus (default: teal).
  --featured             Set featured: true.
  --output path/to/file  Write the snippet to a new file instead of stdout.

This script does not edit src/config/projects.ts automatically. Paste the generated object into its projects array.
`);
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) throw new Error(`Unexpected positional argument: ${argument}`);
    const [rawKey, inlineValue] = argument.slice(2).split(/=(.*)/s, 2);
    if (rawKey === 'help') {
      options.help = true;
      continue;
    }
    if (rawKey === 'featured') {
      options.featured = inlineValue === undefined ? true : inlineValue !== 'false';
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
  return options;
}

function text(value, label) {
  const normalized = String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function tags(value) {
  const result = String(value ?? '').split(',').map((tag) => tag.trim()).filter(Boolean);
  if (result.length === 0) throw new Error('At least one tag is required.');
  if (new Set(result).size !== result.length) throw new Error('Tags must be unique.');
  return result;
}

function slug(value) {
  const normalized = text(value, 'Slug').toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new Error('Slug must use lowercase letters, numbers, and single hyphens only.');
  }
  return normalized;
}

function highlights(value) {
  const result = String(value ?? '').split('|').map((item) => item.trim()).filter(Boolean);
  if (result.length === 0) throw new Error('At least one highlight is required.');
  return result;
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

async function nextCode() {
  const source = await readFile(projectConfigPath, 'utf8');
  const codes = [...source.matchAll(/code:\s*['\"](\d+)['\"]/g)].map((match) => Number(match[1]));
  return String((codes.length ? Math.max(...codes) : 0) + 1).padStart(2, '0');
}

function objectSnippet(project) {
  return [
    '{',
    `  code: ${JSON.stringify(project.code)},`,
    `  slug: ${JSON.stringify(project.slug)},`,
    `  name: ${JSON.stringify(project.name)},`,
    `  summary: ${JSON.stringify(project.summary)},`,
    `  description: ${JSON.stringify(project.description)},`,
    `  href: ${JSON.stringify(project.href)},`,
    `  primaryActionLabel: ${JSON.stringify(project.primaryActionLabel)},`,
    `  type: ${JSON.stringify(project.type)},`,
    `  status: ${JSON.stringify(project.status)},`,
    '  tags: [',
    ...project.tags.map((tag) => `    ${JSON.stringify(tag)},`),
    '  ],',
    `  tone: ${JSON.stringify(project.tone)},`,
    `  featured: ${project.featured},`,
    '  highlights: [',
    ...project.highlights.map((highlight) => `    ${JSON.stringify(highlight)},`),
    '  ],',
    '},',
  ].join('\n');
}

const options = parseArgs(process.argv.slice(2));
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

  const tone = String(options.tone ?? 'teal').trim();
  if (!allowedTones.has(tone)) throw new Error(`Tone must be one of: ${[...allowedTones].join(', ')}.`);

  const project = {
    code: text(options.code ?? await nextCode(), 'Code'),
    slug: slug(await getValue('slug', 'Slug (lowercase-hyphenated)')),
    name: text(await getValue('name', 'Name'), 'Name'),
    summary: text(await getValue('summary', 'Summary'), 'Summary'),
    description: text(await getValue('description', 'Description'), 'Description'),
    href: text(await getValue('href', 'Link or site path'), 'Link or site path'),
    primaryActionLabel: text(await getValue('action-label', 'Primary action label'), 'Primary action label'),
    type: text(await getValue('type', 'Type'), 'Type'),
    status: text(await getValue('status', 'Status'), 'Status'),
    tags: tags(await getValue('tags', 'Tags (comma-separated)')),
    tone,
    featured: options.featured === true,
    highlights: highlights(await getValue('highlights', 'Highlights (separated by |)')),
  };

  const snippet = `${objectSnippet(project)}\n`;
  if (options.output) {
    const destination = path.resolve(rootDir, options.output);
    await writeFile(destination, snippet, { encoding: 'utf8', flag: 'wx' });
    console.log(`Created ${path.relative(rootDir, destination)}`);
  } else {
    console.log('\nPaste this object into the projects array in src/config/projects.ts:\n');
    console.log(snippet);
  }
} catch (error) {
  console.error(`new:project failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  prompt?.close();
}