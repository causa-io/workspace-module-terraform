import { WorkspaceContext } from '@causa/workspace';
import { ProjectDependenciesUpdate } from '@causa/workspace-core';
import { TerraformService } from '../../services/index.js';

/**
 * Implements the {@link ProjectDependenciesUpdate} function for Terraform projects, by running `terraform init`.
 * This uses the `-upgrade` option to fetch the latest versions of the providers allowed by configured constraints, and
 * updates the lock file accordingly.
 */
export class ProjectDependenciesUpdateForTerraform extends ProjectDependenciesUpdate {
  async _call(context: WorkspaceContext): Promise<boolean> {
    context.logger.info('⬆️ Updating Terraform dependencies.');

    await context
      .service(TerraformService)
      .init({ upgrade: true, logging: 'debug' });

    context.logger.info(`️✅ Successfully updated Terraform dependencies.`);

    return true;
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      context.get('project.language') === 'terraform' &&
      context.get('project.type') === 'infrastructure'
    );
  }
}
