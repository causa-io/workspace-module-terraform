import { WorkspaceContext } from '@causa/workspace';
import { ProjectInit } from '@causa/workspace-core';
import { rm } from 'fs/promises';
import { join } from 'path';
import { TerraformService } from '../../services/index.js';

/**
 * The name of the folder automatically created by Terraform during initialization.
 */
const TERRAFORM_DIR = '.terraform';

/**
 * Implements the {@link ProjectInit} function for Terraform projects, by running `terraform init`.
 */
export class ProjectInitForTerraform extends ProjectInit {
  async _call(context: WorkspaceContext): Promise<void> {
    const projectName = context.get('project.name');

    if (this.force) {
      context.logger.info('🔥 Removing Terraform folder.');

      const terraformDir = join(context.getProjectPathOrThrow(), TERRAFORM_DIR);
      await rm(terraformDir, { recursive: true, force: true });
    }

    context.logger.info(
      `️🎉 Initializing Terraform for project '${projectName}'.`,
    );

    await context.service(TerraformService).init({ logging: 'debug' });

    context.logger.info(`️✅ Successfully initialized Terraform.`);
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      !this.workspace &&
      context.get('project.language') === 'terraform' &&
      context.get('project.type') === 'infrastructure'
    );
  }
}
