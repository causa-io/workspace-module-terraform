import type { ModuleRegistrationContext } from '@causa/workspace';
import { InfrastructureDeployForTerraform } from './infrastructure-deploy-terraform.js';
import { InfrastructurePrepareForTerraform } from './infrastructure-prepare-terraform.js';
import { ProjectDependenciesUpdateForTerraform } from './project-dependencies-update-terraform.js';
import { ProjectInitForTerraform } from './project-init-terraform.js';
import { ProjectLintForTerraform } from './project-lint-terraform.js';

export function registerFunctions(context: ModuleRegistrationContext) {
  context.registerFunctionImplementations(
    InfrastructureDeployForTerraform,
    InfrastructurePrepareForTerraform,
    ProjectDependenciesUpdateForTerraform,
    ProjectInitForTerraform,
    ProjectLintForTerraform,
  );
}
