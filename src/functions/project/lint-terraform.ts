import { ProjectLint } from '@causa/workspace-core';
import { ProcessServiceExitCodeError } from '@causa/workspace-core/services';
import { TerraformService } from '../../services/index.js';

/**
 * The list of file extensions that `terraform fmt` supports.
 */
const TERRAFORM_FILE_EXTENSIONS = ['.tf', '.tfvars', '.tftest.hcl'];

/**
 * Implements the {@link ProjectLint} function for Terraform projects, by running `terraform fmt`.
 * The Terraform format check is also run on any external files listed in the project configuration.
 */
export class ProjectLintForTerraform extends ProjectLint {
  async _call(): Promise<void> {
    const projectPath = this._context.getProjectPathOrThrow();
    const projectName = this._context.get('project.name');
    const terraformService = this._context.service(TerraformService);
    const externalPaths = await this._context.getProjectExternalPaths();
    const externalTerraformFiles = externalPaths.filter((p) =>
      TERRAFORM_FILE_EXTENSIONS.some((ext) => p.endsWith(ext)),
    );
    const targets = [projectPath, ...externalTerraformFiles];

    try {
      this._context.logger.info(
        `🎨 Checking format of Terraform code for project '${projectName}'.`,
      );
      this._context.logger.debug(
        `Targets for Terraform format: ${targets.map((t) => `'${t}'`).join(', ')}.`,
      );
      await terraformService.fmt({
        check: true,
        recursive: true,
        targets,
        logging: 'info',
      });

      this._context.logger.info('✅ Terraform code passed linting.');
    } catch (error) {
      if (error instanceof ProcessServiceExitCodeError) {
        throw new Error('Linting the Terraform project failed.');
      }

      throw error;
    }
  }

  _supports(): boolean {
    return (
      this._context.get('project.language') === 'terraform' &&
      this._context.get('project.type') === 'infrastructure'
    );
  }
}
