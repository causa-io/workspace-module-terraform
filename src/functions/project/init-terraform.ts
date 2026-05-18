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
  async _call(): Promise<void> {
    const projectName = this._context.get('project.name');

    if (this.force) {
      this._context.logger.info('🔥 Removing Terraform folder.');

      const terraformDir = join(
        this._context.getProjectPathOrThrow(),
        TERRAFORM_DIR,
      );
      await rm(terraformDir, { recursive: true, force: true });
    }

    this._context.logger.info(
      `️🎉 Initializing Terraform for project '${projectName}'.`,
    );

    await this._context.service(TerraformService).init({ logging: 'debug' });

    this._context.logger.info(`️✅ Successfully initialized Terraform.`);
  }

  _supports(): boolean {
    return (
      !this.workspace &&
      this._context.get('project.language') === 'terraform' &&
      this._context.get('project.type') === 'infrastructure'
    );
  }
}
