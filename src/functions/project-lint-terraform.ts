import { WorkspaceContext } from '@causa/workspace';
import {
  ProcessServiceExitCodeError,
  ProjectLint,
} from '@causa/workspace-core';
import { TerraformService } from '../services/index.js';

/**
 * Implements the {@link ProjectLint} function for Terraform projects, by running `terraform validate` and
 * `terraform fmt`.
 * The Terraform format check is also run on any additional directories listed in the project configuration.
 */
export class ProjectLintForTerraform extends ProjectLint {
  async _call(context: WorkspaceContext): Promise<void> {
    const projectPath = context.getProjectPathOrThrow();
    const projectName = context.get('project.name');
    const terraformService = context.service(TerraformService);
    const targets = [
      projectPath,
      ...(await context.getProjectAdditionalDirectories()),
    ];

    try {
      context.logger.info(
        `🚨 Validating Terraform code for project '${projectName}'.`,
      );
      await terraformService.validate({
        logging: { stdout: null, stderr: 'info' },
      });

      context.logger.info(
        `🎨 Checking format of Terraform code for project '${projectName}'.`,
      );
      await terraformService.fmt({
        check: true,
        recursive: true,
        targets,
        logging: 'info',
      });

      context.logger.info('✅ Terraform code passed linting.');
    } catch (error) {
      if (error instanceof ProcessServiceExitCodeError) {
        throw new Error('Linting the Terraform project failed.');
      }

      throw error;
    }
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      context.get('project.language') === 'terraform' &&
      context.get('project.type') === 'infrastructure'
    );
  }
}
