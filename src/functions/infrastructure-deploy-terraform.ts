import { WorkspaceContext } from '@causa/workspace';
import { InfrastructureDeploy } from '@causa/workspace-core';
import { rm } from 'fs/promises';
import { resolve } from 'path';
import { TerraformService } from '../services/index.js';

/**
 * Implements the {@link InfrastructureDeploy} function for Infrastructure as Code defined using Terraform.
 * This calls the `terraform apply` command for the given project.
 */
export class InfrastructureDeployForTerraform extends InfrastructureDeploy {
  async _call(context: WorkspaceContext): Promise<void> {
    context.getProjectPathOrThrow();
    const projectName = context.getOrThrow('project.name');
    const terraformService = context.service(TerraformService);

    context.logger.info(
      `🧱 Applying Terraform plan for project '${projectName}'.`,
    );

    const plan = resolve(this.deployment);

    await terraformService.wrapWorkspaceOperation(() =>
      terraformService.apply(plan, { logging: 'info' }),
    );

    context.logger.info('🧱 Successfully applied Terraform plan.');

    await rm(plan);
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      context.get('project.language') === 'terraform' &&
      context.get('project.type') === 'infrastructure'
    );
  }
}
