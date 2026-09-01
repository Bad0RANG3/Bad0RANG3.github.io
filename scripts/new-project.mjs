import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const allowedTones = new Set(['teal', 'coral', 'citrus']);

function usage() {
  console.log(`
Create a project configuration snippet.

Usage:
  pnpm new:project -- --name "..." --summary "..." --href "..." [options]

Options:
  --tone teal            One of: teal, coral, citrus (default: teal).
  --output path/to/file  Write the snippet to a new file instead of stdout.
`);
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--') continue;
    if (!argument.startsWith('--')) throw new Error(`Unexpected positional argument: ${argument}`);
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
  return options;
}

function text(value, label) {
  const normalized = String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

async function createPrompter() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Missing required values. Use --help for non-interactive usage.');
  }
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  return {
    async ask(label) { return (await readline.question(`${label}: `)).trim(); },
    close() { readline.close(); },
  };
}

function objectSnippet(project) {
  return [
    '{',
    `  name: ${JSON.stringify(project.name)},`,
    `  summary: ${JSON.stringify(project.summary)},`,
    `  href: ${JSON.stringify(project.href)},`,
    `  tone: ${JSON.stringify(project.tone)},`,
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
  const getValue = async (key, label) => {
    if (options[key] !== undefined) return options[key];
    if (!prompt) prompt = await createPrompter();
    return prompt.ask(label);
  };
  const tone = String(options.tone ?? 'teal').trim();
  if (!allowedTones.has(tone)) throw new Error(`Tone must be one of: ${[...allowedTones].join(', ')}.`);

  const project = {
    name: text(await getValue('name', 'Name'), 'Name'),
    summary: text(await getValue('summary', 'Summary'), 'Summary'),
    href: text(await getValue('href', 'Link or site path'), 'Link or site path'),
    tone,
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
