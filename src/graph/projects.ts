import {
  domainAt,
  DomainsFact,
  GraphFact,
  ProjectsFact,
  type GraphContext,
  type GraphFactOutput,
  type WorkspaceProject,
} from '@causa/workspace-core/graph';
import { relative, resolve } from 'path';
import type {
  TerraformModule,
  TerraformModuleBlock,
  TerraformProject,
} from './blocks.js';
import { parseTerraformDirectory, type ParsedDirectory } from './sources.js';

/**
 * The Terraform configurations applied by the infrastructure projects written in Terraform. The directory of each
 * project is its root module, and local `module` blocks (`source = "../some/directory"`) are followed from there.
 */
export class TerraformProjectsFact extends GraphFact<TerraformProject[]> {
  /**
   * The directories parsed during the extraction, keyed by path relative to the workspace root. A directory included
   * by several projects is only parsed once.
   */
  private readonly directories = new Map<
    string,
    Promise<ParsedDirectory | undefined>
  >();

  async compute(
    graph: GraphContext,
  ): Promise<GraphFactOutput<TerraformProject[]>> {
    const projects = await graph.get(ProjectsFact);
    const terraformProjects = await Promise.all(
      projects
        .filter(
          (p) => p.type === 'infrastructure' && p.language === 'terraform',
        )
        .map((project) => this.readModule(graph, project)),
    );
    graph.context.logger.debug(
      `🕸️ Found ${terraformProjects.length} Terraform project(s).`,
    );
    return { value: terraformProjects };
  }

  /**
   * Parses the `*.tf` files of a directory, once per extraction.
   *
   * @param graph The context of the extraction.
   * @param directory The directory, relative to the workspace root.
   * @returns The blocks declared in the directory, or `undefined` if the directory does not exist.
   */
  private parse(
    graph: GraphContext,
    directory: string,
  ): Promise<ParsedDirectory | undefined> {
    let parsed = this.directories.get(directory);
    if (!parsed) {
      parsed = parseTerraformDirectory(graph.context.rootPath, directory);
      this.directories.set(directory, parsed);
    }

    return parsed;
  }

  /**
   * Reads a module of the configuration applied by a project, then the local modules it includes.
   *
   * @param graph The context of the extraction.
   * @param project The project applying the configuration.
   * @param directory The directory of the module, relative to the workspace root. Defaults to the root module.
   * @param via The local `module` blocks including the module, from the root module.
   * @param terraformProject The configuration being read, to which the module and its blocks are added. Created when
   *   reading the root module.
   * @returns The configuration.
   */
  private async readModule(
    graph: GraphContext,
    project: WorkspaceProject,
    directory: string = project.directory,
    via: TerraformModuleBlock[] = [],
    terraformProject: TerraformProject = {
      project,
      modules: [],
      moduleBlocks: [],
      resourceBlocks: [],
      missingModules: [],
    },
  ): Promise<TerraformProject> {
    const [parsed, domains] = await Promise.all([
      this.parse(graph, directory),
      graph.get(DomainsFact),
    ]);
    const module: TerraformModule = {
      project,
      directory,
      domain: domainAt(domains, directory),
      address: via.map((b) => b.address).join('.'),
      via,
    };
    terraformProject.modules.push(module);
    const moduleBlocks = (parsed?.moduleBlocks ?? []).map((block) => ({
      ...block,
      module,
    }));
    terraformProject.moduleBlocks.push(...moduleBlocks);
    terraformProject.resourceBlocks.push(
      ...(parsed?.resourceBlocks ?? []).map((block) => ({ ...block, module })),
    );

    const { rootPath } = graph.context;
    for (const block of moduleBlocks) {
      // Only local modules, e.g. `../some/directory`, are included in the configuration.
      if (!block.source || !/^\.\.?\//.test(block.source)) {
        continue;
      }

      const included = relative(
        rootPath,
        resolve(rootPath, directory, block.source),
      );
      // A module including itself is invalid, and would never end.
      if (
        [...via.map((b) => b.module.directory), directory].includes(included)
      ) {
        continue;
      }

      if (!(await this.parse(graph, included))) {
        terraformProject.missingModules.push(block);
        continue;
      }

      await this.readModule(
        graph,
        project,
        included,
        [...via, block],
        terraformProject,
      );
    }

    return terraformProject;
  }
}
