import { InfrastructureDeploy } from '@causa/workspace-core';
import { rm } from 'fs/promises';
import { resolve } from 'path';
import { TerraformService } from '../../services/index.js';

/**
 * Implements the {@link InfrastructureDeploy} function for Infrastructure as Code defined using Terraform.
 * This calls the `terraform apply` command for the given project.
 */
export class InfrastructureDeployForTerraform extends InfrastructureDeploy {
  async _call(): Promise<void> {
    this._context.getProjectPathOrThrow();
    const projectName = this._context.getOrThrow('project.name');
    const terraformService = this._context.service(TerraformService);

    this._context.logger.info(
      `🧱 Applying Terraform plan for project '${projectName}'.`,
    );

    const plan = resolve(this.deployment);

    await terraformService.wrapWorkspaceOperation(() =>
      terraformService.apply(plan, { logging: 'info' }),
    );

    this._context.logger.info('🧱 Successfully applied Terraform plan.');

    await rm(plan);
  }

  _supports(): boolean {
    return (
      this._context.get('project.language') === 'terraform' &&
      this._context.get('project.type') === 'infrastructure'
    );
  }
}
