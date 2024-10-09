import { WorkspaceContext } from '@causa/workspace';
import {
  ProcessServiceExitCodeError,
  ProjectLint,
} from '@causa/workspace-core';
import { TerraformService } from '../services/index.js';

/**
 * The list of file extensions that `terraform fmt` supports.
 */
const TERRAFORM_FILE_EXTENSIONS = ['.tf', '.tfvars', '.tftest.hcl'];

/**
 * Implements the {@link ProjectLint} function for Terraform projects, by running `terraform fmt`.
 * The Terraform format check is also run on any external files listed in the project configuration.
 */
export class ProjectLintForTerraform extends ProjectLint {
  async _call(context: WorkspaceContext): Promise<void> {
    const projectPath = context.getProjectPathOrThrow();
    const projectName = context.get('project.name');
    const terraformService = context.service(TerraformService);
    const externalPaths = await context.getProjectExternalPaths();
    const externalTerraformFiles = externalPaths.filter((p) =>
      TERRAFORM_FILE_EXTENSIONS.some((ext) => p.endsWith(ext)),
    );
    const targets = [projectPath, ...externalTerraformFiles];

    try {
      context.logger.info(
        `🎨 Checking format of Terraform code for project '${projectName}'.`,
      );
      context.logger.debug(
        `Targets for Terraform format: ${targets.map((t) => `'${t}'`).join(', ')}.`,
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
