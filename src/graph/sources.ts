import type { GraphOriginSource } from '@causa/workspace-core';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import type {
  TerraformArgument,
  TerraformBlock,
  TerraformModuleBlock,
  TerraformResourceBlock,
} from './blocks.js';

/**
 * A `module` block declared in a directory, independently of the modules including the directory.
 */
type ParsedModuleBlock = Omit<TerraformModuleBlock, 'module'>;

/**
 * A `resource` block declared in a directory, independently of the modules including the directory.
 */
type ParsedResourceBlock = Omit<TerraformResourceBlock, 'module'>;

/**
 * The blocks declared by the `*.tf` files of a directory.
 */
export type ParsedDirectory = {
  readonly moduleBlocks: ParsedModuleBlock[];
  readonly resourceBlocks: ParsedResourceBlock[];
};

/**
 * What expressions are evaluated against: the directory of the module, and its `local` values.
 */
type Scope = {
  /**
   * The directory of the module, relative to the workspace root, which is the value of `path.module`.
   */
  readonly directory: string;

  /**
   * The `local` values declared by all the files of the module.
   */
  readonly locals: Record<string, unknown>;
};

/**
 * The expected structure of a parsed `*.tf` file.
 */
type ParsedFile = {
  module?: Record<string, Record<string, unknown>[]>;
  resource?: Record<string, Record<string, Record<string, unknown>[]>>;
  locals?: Record<string, unknown>[];
};

/**
 * The start of a template sequence: an interpolation (`${`), a directive (`%{`), or their escapes (`$${` and `%%{`).
 */
const TEMPLATE_START = /[$%]\{/;

/**
 * Parses the `*.tf` files of a directory with `hcl2json`, not recursively, as Terraform does for a module.
 * Only literals, and expressions composed of `local` values and `path.module`, are evaluated in the arguments of the
 * blocks.
 *
 * @param rootPath The absolute path to the workspace root.
 * @param directory The directory, relative to the workspace root.
 * @returns The blocks declared in the directory, or `undefined` if the directory does not exist.
 */
export async function parseTerraformDirectory(
  rootPath: string,
  directory: string,
): Promise<ParsedDirectory | undefined> {
  let entries;
  try {
    entries = await readdir(join(rootPath, directory), { withFileTypes: true });
  } catch (error: any) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      return undefined;
    }

    throw error;
  }

  // Importing `hcl2json` loads its WebAssembly parser and starts a Go runtime, which would slow down every command
  // loading this module. It is only imported when directories are actually parsed.
  const { parse } = await import('@cdktf/hcl2json');
  const files = await Promise.all(
    entries
      .filter((e) => e.isFile() && e.name.endsWith('.tf'))
      .map((e) => join(directory, e.name))
      .sort()
      .map(async (file) => {
        const content = await readFile(join(rootPath, file), 'utf-8');
        const parsed = (await parse(file, content)) as ParsedFile;
        return { file, content, parsed };
      }),
  );

  // `local` values can be used by any file of the module, so they are all collected before evaluating arguments.
  const scope: Scope = {
    directory,
    locals: Object.assign({}, ...files.flatMap((f) => f.parsed.locals ?? [])),
  };
  const evaluateArguments = (block: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(block).map(([name, value]) => [
        name,
        evaluate(value, scope),
      ]),
    );

  const moduleBlocks: ParsedModuleBlock[] = [];
  const resourceBlocks: ParsedResourceBlock[] = [];
  for (const { file, content, parsed } of files) {
    const fileModuleBlocks: ParsedModuleBlock[] = [];
    for (const [name, blocks] of Object.entries(parsed.module ?? {})) {
      for (const { source, version, ...rest } of blocks) {
        const address = `module.${name}`;
        const declaration = locateBlock(content, file, address, 'module', [
          name,
        ]);
        fileModuleBlocks.push({
          name,
          address,
          declaration,
          ...(typeof source === 'string' ? { source } : {}),
          ...(typeof version === 'string' ? { version } : {}),
          arguments: evaluateArguments(rest),
        });
      }
    }

    const fileResourceBlocks: ParsedResourceBlock[] = [];
    for (const [type, byName] of Object.entries(parsed.resource ?? {})) {
      for (const [name, blocks] of Object.entries(byName)) {
        for (const block of blocks) {
          const address = `${type}.${name}`;
          const declaration = locateBlock(content, file, address, 'resource', [
            type,
            name,
          ]);
          fileResourceBlocks.push({
            type,
            name,
            address,
            declaration,
            arguments: evaluateArguments(block),
          });
        }
      }
    }

    // `hcl2json` sorts blocks by label. They are put back in the order of the file.
    moduleBlocks.push(...fileModuleBlocks.sort(byLine));
    resourceBlocks.push(...fileResourceBlocks.sort(byLine));
  }

  return { moduleBlocks, resourceBlocks };
}

/**
 * Evaluates the value of an argument, as rendered by `hcl2json`, which keeps templates as written.
 * A template is resolved when each interpolation is `path.module` or a `local.<name>` (itself evaluated recursively),
 * and evaluates to a string, a number, or a boolean. A whole expression can evaluate to any value, e.g. a list `local`.
 * Directives and templates nested in objects and lists are not evaluated. Anything that cannot be evaluated correctly
 * is returned as an unresolved expression.
 *
 * @param value The value, as rendered by `hcl2json`.
 * @param scope The module declaring the value.
 * @returns The evaluated argument.
 */
function evaluate(value: unknown, scope: Scope, depth = 0): TerraformArgument {
  if (typeof value !== 'string') {
    return containsTemplate(value)
      ? { expression: JSON.stringify(value) }
      : { value };
  }

  if (!TEMPLATE_START.test(value)) {
    return { value };
  }

  if (depth > 10) {
    return { expression: value };
  }

  // A single expression spanning the whole string can evaluate to any value, e.g. a list.
  const whole = /^\$\{([\s\S]*)\}$/.exec(value);
  if (whole && value.indexOf('${', 1) < 0 && !value.includes('%{')) {
    return evaluateExpression(whole[1].trim(), scope, depth);
  }

  let resolved = true;
  // The tokens are the escapes of interpolations and directives, directives, interpolations without nested braces, and
  // the start of any other interpolation.
  const rendered = value.replace(
    /\$\$\{|%%\{|%\{|\$\{([^{}]*)\}|\$\{/g,
    (token, expression) => {
      if (token === '$${') {
        return '${';
      }

      if (token === '%%{') {
        return '%{';
      }

      const result =
        expression !== undefined
          ? evaluateExpression(String(expression).trim(), scope, depth)
          : undefined;
      const evaluated = result && 'value' in result ? result.value : undefined;
      if (!['string', 'number', 'boolean'].includes(typeof evaluated)) {
        resolved = false;
        return token;
      }

      return String(evaluated);
    },
  );
  return resolved ? { value: rendered } : { expression: value };
}

function evaluateExpression(
  expression: string,
  scope: Scope,
  depth: number,
): TerraformArgument {
  if (expression === 'path.module') {
    return { value: scope.directory };
  }

  const local = /^local\.([A-Za-z_][\w-]*)$/.exec(expression);
  if (local) {
    return local[1] in scope.locals
      ? evaluate(scope.locals[local[1]], scope, depth + 1)
      : { expression: `\${${expression}}` };
  }

  return { expression: `\${${expression}}` };
}

/**
 * Returns whether a value rendered by `hcl2json` contains a template, possibly nested in objects and lists.
 */
function containsTemplate(value: unknown): boolean {
  if (typeof value === 'string') {
    return TEMPLATE_START.test(value);
  }

  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).some(containsTemplate)
  );
}

/**
 * Compares blocks by the line at which they start in the same file. Blocks whose line is unknown come last.
 */
function byLine(
  { declaration: a }: Pick<TerraformBlock, 'declaration'>,
  { declaration: b }: Pick<TerraformBlock, 'declaration'>,
) {
  return (
    (a.location?.start.line ?? Infinity) - (b.location?.start.line ?? Infinity)
  );
}

/**
 * Locates a block in its file, returning where it is declared as the origin source of what is extracted from it.
 *
 * @param content The content of the file.
 * @param file The file, relative to the workspace root.
 * @param address The address of the block in its module, used as the pointer.
 * @param kind The kind of block, e.g. `module`.
 * @param labels The labels of the block, e.g. the type and name of a resource.
 * @returns The origin source, with the line at which the block starts if it could be found.
 */
function locateBlock(
  content: string,
  file: string,
  address: string,
  kind: string,
  labels: string[],
): GraphOriginSource {
  const escaped = labels
    .map((label) => `"${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`)
    .join('\\s+');
  const match = new RegExp(`^[ \\t]*${kind}\\s+${escaped}\\s*\\{`, 'm').exec(
    content,
  );
  const line = match
    ? content.slice(0, match.index + match[0].indexOf(kind)).split('\n').length
    : undefined;

  return {
    path: file,
    pointer: address,
    ...(line ? { location: { start: { line } } } : {}),
  };
}
