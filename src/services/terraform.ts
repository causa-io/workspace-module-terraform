import { WorkspaceContext } from '@causa/workspace';
import {
  ProcessService,
  ProcessServiceExitCodeError,
  SpawnOptions,
  SpawnedProcessResult,
} from '@causa/workspace-core';
import { Logger } from 'pino';
import { TerraformConfiguration } from '../configurations/index.js';

/**
 * Options for the {@link TerraformService.wrapWorkspaceOperation} method.
 */
type WrapWorkspaceOperationOptions = {
  /**
   * The Terraform workspace to select, instead of {@link TerraformService.defaultTerraformWorkspace}.
   */
  workspace?: string;

  /**
   * Whether the Terraform workspace should be created if it does not already exists.
   */
  createWorkspaceIfNeeded?: boolean;

  /**
   * Whether the `terraform init` step should be skipped.
   */
  skipInit?: boolean;
} & SpawnOptions;

/**
 * A service exposing the Terraform CLI.
 */
export class TerraformService {
  /**
   * The underlying {@link ProcessService} spawning the Terraform CLI.
   */
  private readonly processService: ProcessService;

  /**
   * Default options when spawning a `terraform` process.
   * The {@link SpawnOptions.workingDirectory} will be set to the project's root (if it is defined).
   */
  private readonly defaultSpawnOptions: SpawnOptions;

  /**
   * The logger to use.
   */
  private readonly logger: Logger;

  /**
   * The default Terraform workspace, obtained from the configuration at `terraform.workspace`.
   * This is used by {@link TerraformService.wrapWorkspaceOperation} if no workspace is specified.
   */
  private readonly defaultTerraformWorkspace: string | undefined;

  constructor(context: WorkspaceContext) {
    this.processService = context.service(ProcessService);
    this.defaultSpawnOptions = {
      workingDirectory: context.projectPath ?? undefined,
    };
    this.logger = context.logger;
    this.defaultTerraformWorkspace = context
      .asConfiguration<TerraformConfiguration>()
      .get('terraform.workspace');
  }

  /**
   * Runs `terraform init`.
   *
   * @param options Options when initializing Terraform.
   */
  async init(options: SpawnOptions = {}): Promise<void> {
    await this.terraform('init', ['-input=false'], options);
  }

  /**
   * Runs `terraform workspace show` and returns the currently selected workspace.
   *
   * @param options Options when running the command.
   * @returns The name of the currently selected workspace.
   */
  async workspaceShow(options: SpawnOptions = {}): Promise<string> {
    const result = await this.terraform('workspace', ['show'], {
      logging: { stdout: null, stderr: 'debug' },
      ...options,
      capture: { ...options.capture, stdout: true },
    });
    return result.stdout?.trim() ?? '';
  }

  /**
   * Runs `terraform workspace select` to change the active workspace.
   *
   * @param workspace The workspace to select.
   * @param options Options when running the command.
   */
  async workspaceSelect(
    workspace: string,
    options: { orCreate?: boolean } & SpawnOptions = {},
  ): Promise<void> {
    const { orCreate, ...spawnOptions } = options;
    await this.terraform(
      'workspace',
      ['select', ...(orCreate ? ['-or-create=true'] : []), workspace],
      spawnOptions,
    );
  }

  /**
   * Runs `terraform plan` and writes the corresponding plan to a file.
   *
   * @param out The path to the output file plan.
   * @param options Options for the `plan` command.
   * @returns `true` if the plan contains changes, `false` otherwise.
   */
  async plan(
    out: string,
    options: {
      /**
       * Whether destruction of the workspace should be planned, instead of comparing it with the infrastructure
       * definition.
       */
      destroy?: boolean;

      /**
       * A map of Terraform variables to forward to `terraform plan`.
       */
      variables?: Record<string, string>;
    } & SpawnOptions = {},
  ): Promise<boolean> {
    const { destroy, variables, ...spawnOptions } = options;

    const args = ['-input=false', `-out=${out}`, '-detailed-exitcode'];
    if (destroy) {
      args.push('-destroy');
    }
    Object.entries(variables ?? {}).forEach(([varName, varValue]) =>
      args.push('-var', `${varName}=${varValue}`),
    );

    try {
      await this.terraform('plan', args, spawnOptions);
      // When specifying `-detailed-exitcode`, a return code of `0` means that the plan does not contain any change.
      return false;
    } catch (error) {
      // When specifying `-detailed-exitcode`, a return code of `2` means that the plan contains changes.
      if (
        error instanceof ProcessServiceExitCodeError &&
        error.result.code === 2
      ) {
        return true;
      }

      throw error;
    }
  }

  /**
   * Runs `terraform apply` to perform the changes described in the given plan.
   *
   * @param plan The path to the plan file to apply.
   * @param options Options when running the command.
   */
  async apply(plan: string, options: SpawnOptions = {}): Promise<void> {
    await this.terraform('apply', ['-input=false', plan], options);
  }

  /**
   * Runs `terraform show` on the given plan and returns the output of the command.
   *
   * @param path The path to the plan to describe.
   * @param options Options when running the command. `capture` is enabled automatically.
   * @returns The standard output of the command, describing the plan.
   */
  async show(
    path: string,
    options: Omit<SpawnOptions, 'capture'> = {},
  ): Promise<string> {
    const result = await this.terraform('show', [path], {
      ...options,
      capture: { stdout: true, stderr: true },
      logging: options.logging ?? null,
    });
    return result.stdout ?? '';
  }

  /**
   * Runs `terraform validate`.
   *
   * @param options Options when running the command.
   */
  async validate(options: SpawnOptions = {}): Promise<void> {
    await this.terraform('validate', [], options);
  }

  /**
   * Wrap the `fn` function and ensures Terraform is initialized and that the correct Terraform workspace is selected.
   * After `fn` has run, the workspace is reverted back to the previous workspace if necessary.
   *
   * @param fn The function to run after Terraform has been initialized and the workspace selected.
   * @returns The result of `fn`.
   */
  async wrapWorkspaceOperation<T>(fn: () => Promise<T>): Promise<T>;

  /**
   * Wrap the `fn` function and ensures Terraform is initialized and that the correct Terraform workspace is selected.
   * After `fn` has run, the workspace is reverted back to the previous workspace if necessary.
   *
   * @param options Options when performing the operation.
   * @param fn The function to run after Terraform has been initialized and the workspace selected.
   * @returns The result of `fn`.
   */
  async wrapWorkspaceOperation<T>(
    options: WrapWorkspaceOperationOptions,
    fn: () => Promise<T>,
  ): Promise<T>;

  async wrapWorkspaceOperation<T>(
    optionsOrFn: WrapWorkspaceOperationOptions | (() => Promise<T>),
    fn?: () => Promise<T>,
  ): Promise<T> {
    const options = fn ? (optionsOrFn as WrapWorkspaceOperationOptions) : {};
    const func = fn ?? (optionsOrFn as () => Promise<T>);

    const { skipInit, createWorkspaceIfNeeded, workspace, ...spawnOptions } =
      options;

    const workspaceToSelect = workspace ?? this.defaultTerraformWorkspace;
    if (workspaceToSelect === undefined) {
      throw new Error(
        'The Terraform workspace for the operation is not configured.',
      );
    }

    if (!skipInit) {
      await this.init(spawnOptions);
    }

    let workspaceToRestore: string | null = null;

    try {
      const currentWorkspace = await this.workspaceShow(spawnOptions);
      if (workspaceToSelect !== currentWorkspace) {
        this.logger.debug(
          `🔧 Changing Terraform workspace from '${currentWorkspace}' to '${workspaceToSelect}'.`,
        );

        await this.workspaceSelect(workspaceToSelect, {
          orCreate: createWorkspaceIfNeeded,
          ...spawnOptions,
        });
        workspaceToRestore = currentWorkspace;
      } else {
        this.logger.debug(
          `🔧 Terraform workspace '${workspaceToSelect}' is already configured.`,
        );
      }

      return await func();
    } finally {
      if (workspaceToRestore) {
        this.logger.debug(
          `🔧 Switching back to Terraform workspace '${workspaceToRestore}'.`,
        );
        await this.workspaceSelect(workspaceToRestore, spawnOptions);
      }
    }
  }

  /**
   * Runs an arbitrary Terraform command.
   *
   * @param command The Terraform command to run.
   * @param args Arguments to place after the command name.
   * @param options {@link SpawnOptions} for the process.
   * @returns The result of the spawned process.
   */
  async terraform(
    command: string,
    args: string[],
    options: SpawnOptions = {},
  ): Promise<SpawnedProcessResult> {
    const p = this.processService.spawn('terraform', [command, ...args], {
      ...this.defaultSpawnOptions,
      ...options,
    });
    return await p.result;
  }
}
