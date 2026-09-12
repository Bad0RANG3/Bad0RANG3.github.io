/**
 * `--max-image-size` becomes `maxImageSize`, matching the option keys the
 * scripts already used before this module existed.
 */
function toOptionKey(flagName) {
  return flagName.replace(/-([a-z0-9])/g, (_match, character) => character.toUpperCase());
}

function splitArgument(argument) {
  const match = /^--([a-z0-9-]+)(?:=(.*))?$/s.exec(argument);
  if (!match) throw new Error(`Unknown argument: ${argument}`);
  return { flagName: match[1], inlineValue: match[2] };
}

/**
 * Parses arguments for a script with a fixed option set.
 *
 * Accepts `--help`, the boolean flags listed in `booleans`, and the
 * `--key=value` flags listed in `values`. Anything else is rejected, which is
 * what keeps typos in CI workflows from silently passing.
 *
 * `--help` short-circuits and returns as soon as it is seen.
 *
 * A bare `--` separator is skipped, matching `parseOptions` below. pnpm only
 * consumes the separator itself on Windows; on Linux it reaches the script as a
 * literal argument, so the `pnpm <script> -- <flag>` form printed in every
 * usage message would otherwise fail on CI.
 */
export function parseFlags(argv, { booleans = [], values = [] } = {}) {
  const options = {};
  for (const argument of argv) {
    if (argument === '--help') return { help: true };
    if (argument === '--') continue;

    const { flagName, inlineValue } = splitArgument(argument);
    if (booleans.includes(flagName)) {
      if (inlineValue !== undefined) throw new Error(`--${flagName} does not take a value.`);
      options[toOptionKey(flagName)] = true;
      continue;
    }
    if (!values.includes(flagName)) throw new Error(`Unknown argument: ${argument}`);
    if (inlineValue === undefined) throw new Error(`Missing a value for --${flagName}.`);
    options[toOptionKey(flagName)] = inlineValue;
  }
  return options;
}

/**
 * Parses arguments for a script that collects free-form options.
 *
 * Supports `--key value`, `--key=value`, and `--help`. Boolean flags listed in
 * `booleans` may be passed bare or as `--key=false`; with `allowNegation`, a
 * `--no-key` form turns them off. Positional arguments are collected when
 * `allowPositional` is set and rejected otherwise.
 *
 * Option keys are camelCased, so `--series-order 2` is read as
 * `options.seriesOrder`.
 *
 * A bare `--` separator is skipped, so both `pnpm run x -- <arg>` and a direct
 * `node scripts/x.mjs -- <arg>` behave the same.
 */
export function parseOptions(argv, { booleans = [], allowPositional = false, allowNegation = false } = {}) {
  const options = {};
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--') continue;
    if (!argument.startsWith('--')) {
      if (!allowPositional) throw new Error(`Unexpected positional argument: ${argument}`);
      positional.push(argument);
      continue;
    }

    const [flagName, inlineValue] = argument.slice(2).split(/=(.*)/s, 2);
    if (flagName === 'help') {
      options.help = true;
      continue;
    }
    if (allowNegation && flagName.startsWith('no-')) {
      options[toOptionKey(flagName.slice(3))] = false;
      continue;
    }
    if (booleans.includes(flagName)) {
      options[toOptionKey(flagName)] = inlineValue === undefined ? true : inlineValue !== 'false';
      continue;
    }
    if (inlineValue !== undefined) {
      options[toOptionKey(flagName)] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith('--')) throw new Error(`Missing a value for --${flagName}.`);
    options[toOptionKey(flagName)] = next;
    index += 1;
  }

  return { options, positional };
}
