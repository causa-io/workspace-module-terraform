import { ProjectDependenciesUpdate } from '@causa/workspace-core';
import { TerraformService } from '../../services/index.js';

/**
 * Implements the {@link ProjectDependenciesUpdate} function for Terraform projects, by running `terraform init`.
 * This uses the `-upgrade` option to fetch the latest versions of the providers allowed by configured constraints, and
 * updates the lock file accordingly.
 */
export class ProjectDependenciesUpdateForTerraform extends ProjectDependenciesUpdate {
  async _call(): Promise<boolean> {
    this._context.logger.info('⬆️ Updating Terraform dependencies.');

    await this._context
      .service(TerraformService)
      .init({ upgrade: true, logging: 'debug' });

    this._context.logger.info(
      `️✅ Successfully updated Terraform dependencies.`,
    );

    return true;
  }

  _supports(): boolean {
    return (
      this._context.get('project.language') === 'terraform' &&
      this._context.get('project.type') === 'infrastructure'
    );
  }
}
