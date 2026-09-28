import type { GraphOriginSource, GraphRuleEdge } from '@causa/workspace-core';
import {
  projectId,
  type WorkspaceDomain,
  type WorkspaceProject,
} from '@causa/workspace-core/graph';

/**
 * The value of a block argument, evaluated from the Terraform sources alone.
 * Only literals, and templates composed of `local` values and `path.module`, can be evaluated. Anything that cannot be
 * evaluated correctly is returned as written: other expressions (variables, resource attributes, function calls),
 * template directives, and objects and lists containing templates, which are rendered as JSON.
 */
export type TerraformArgument =
  { readonly value: unknown } | { readonly expression: string };

/**
 * A Terraform module as applied by a project: the root module, which is the project directory, or a directory included
 * through local `module` blocks. A directory included by several projects, or several times by the same project, is a
 * distinct module each time, as each inclusion creates its own resources.
 */
export type TerraformModule = {
  /**
   * The project applying the module.
   */
  readonly project: WorkspaceProject;

  /**
   * The directory whose `*.tf` files make the module, relative to the workspace root.
   */
  readonly directory: string;

  /**
   * The domain the directory belongs to.
   */
  readonly domain: WorkspaceDomain | undefined;

  /**
   * The address of the module from the root module, e.g. `module.ordering`. Empty for the root module.
   */
  readonly address: string;

  /**
   * The local `module` blocks through which the root module includes this one, from the outermost. Empty for the root
   * module.
   */
  readonly via: TerraformModuleBlock[];
};

/**
 * A block of a Terraform module.
 * `count` and `for_each` are not expanded: a block stands for all its instances, and those arguments are evaluated like
 * the others.
 */
export type TerraformBlock = {
  /**
   * The address of the block in its module, e.g. `module.my_service` or `google_storage_bucket.assets`.
   */
  readonly address: string;

  /**
   * Where the block is declared: its file, address, and line.
   */
  readonly declaration: GraphOriginSource;

  /**
   * The module declaring the block.
   */
  readonly module: TerraformModule;

  /**
   * The arguments of the block.
   */
  readonly arguments: Record<string, TerraformArgument>;
};

/**
 * A `module` block.
 */
export type TerraformModuleBlock = TerraformBlock & {
  /**
   * The name of the block, e.g. `my_service`.
   */
  readonly name: string;

  /**
   * The `source` of the module.
   */
  readonly source?: string;

  /**
   * The `version` of the module.
   */
  readonly version?: string;
};

/**
 * A `resource` block.
 */
export type TerraformResourceBlock = TerraformBlock & {
  /**
   * The type of the resource, e.g. `google_storage_bucket`.
   */
  readonly type: string;

  /**
   * The name of the resource, e.g. `assets`.
   */
  readonly name: string;
};

/**
 * The Terraform configuration applied by an infrastructure project written in Terraform.
 * The project directory is the root module, from which local `module` blocks are followed.
 */
export type TerraformProject = {
  /**
   * The project.
   */
  readonly project: WorkspaceProject;

  /**
   * The modules of the configuration: the root module first, then the included ones, depth first.
   */
  readonly modules: TerraformModule[];

  /**
   * All the `module` blocks of the configuration, including the ones including local modules.
   */
  readonly moduleBlocks: TerraformModuleBlock[];

  /**
   * All the `resource` blocks of the configuration.
   */
  readonly resourceBlocks: TerraformResourceBlock[];

  /**
   * The `module` blocks whose source is a local directory that does not exist.
   */
  readonly missingModules: TerraformModuleBlock[];
};

/**
 * Returns the module blocks with the given source, in the configurations of all the Terraform projects.
 *
 * @param projects The Terraform projects of the workspace.
 * @param source The source of the module, e.g. `causa-io/api-router/google`.
 * @returns The blocks of the module.
 */
export function modulesWithSource(
  projects: readonly TerraformProject[],
  source: string,
): TerraformModuleBlock[] {
  return projects.flatMap(({ moduleBlocks }) =>
    moduleBlocks.filter((block) => block.source === source),
  );
}

/**
 * Returns the value of an argument if it could be evaluated.
 *
 * @param argument The argument.
 * @returns The value, or `undefined` if the argument is absent or could not be evaluated.
 */
export function terraformValue(
  argument: TerraformArgument | undefined,
): unknown {
  return argument && 'value' in argument ? argument.value : undefined;
}

/**
 * Returns the `deploys` edges from the project applying a block to a node the block creates.
 * Rules mirroring Terraform code call this for each node they extract from a block.
 *
 * @param block The block.
 * @param to The ID of the node created by the block.
 * @returns The `deploys` edges, whose sources are the block and the local module blocks including it.
 */
export function terraformDeploys(
  block: TerraformBlock,
  to: string,
): GraphRuleEdge[] {
  const { project, via } = block.module;
  return [
    {
      type: 'deploys',
      from: projectId(project.directory),
      to,
      sources: [block.declaration, ...via.map((b) => b.declaration)],
    },
  ];
}
