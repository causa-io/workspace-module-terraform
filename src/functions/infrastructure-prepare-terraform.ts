import { WorkspaceContext } from '@causa/workspace';
import {
  type InfrastructureConfiguration,
  InfrastructurePrepare,
  type PrepareResult,
} from '@causa/workspace-core';
import { rm } from 'fs/promises';
import { resolve } from 'path';
import { TerraformService } from '../services/index.js';

/**
 * The default name of the output Terraform plan file.
 */
const DEFAULT_PLAN_FILE = 'plan.out';

/**
 * Implements the {@link InfrastructurePrepare} function for Infrastructure as Code defined using Terraform.
 * This calls the `terraform plan` command for the given project.
 */
export class InfrastructurePrepareForTerraform extends InfrastructurePrepare {
  async _call(context: WorkspaceContext): Promise<PrepareResult> {
    const projectPath = context.getProjectPathOrThrow();
    const infrastructureConf =
      context.asConfiguration<InfrastructureConfiguration>();
    const projectName = infrastructureConf.getOrThrow('project.name');
    const terraformService = context.service(TerraformService);

    const variables =
      (await infrastructureConf.getAndRender('infrastructure.variables')) ?? {};
    const output = this.output
      ? resolve(this.output)
      : resolve(projectPath, DEFAULT_PLAN_FILE);

    context.logger.info(
      `🧱 Planning Terraform deployment for project '${projectName}'.`,
    );

    const isDeploymentNeeded = await terraformService.wrapWorkspaceOperation(
      { createWorkspaceIfNeeded: !this.destroy },
      () => terraformService.plan(output, { variables, destroy: this.destroy }),
    );

    if (isDeploymentNeeded) {
      context.logger.info(
        '🧱 Terraform plan has changes that can be deployed.',
      );

      if (this.print) {
        const show = await terraformService.show(output);
        console.log(show);
      }

      return { output, isDeploymentNeeded };
    }

    context.logger.info('🧱 Terraform plan has no change.');
    await rm(output);

    return { output: '', isDeploymentNeeded };
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      context.get('project.language') === 'terraform' &&
      context.get('project.type') === 'infrastructure'
    );
  }
}
