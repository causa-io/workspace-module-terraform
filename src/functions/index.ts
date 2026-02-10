import type { ModuleRegistrationContext } from '@causa/workspace';
import { CausaListConfigurationSchemasForTerraform } from './causa/index.js';
import {
  InfrastructureDeployForTerraform,
  InfrastructurePrepareForTerraform,
} from './infrastructure/index.js';
import {
  ProjectDependenciesUpdateForTerraform,
  ProjectInitForTerraform,
  ProjectLintForTerraform,
} from './project/index.js';

export function registerFunctions(context: ModuleRegistrationContext) {
  context.registerFunctionImplementations(
    CausaListConfigurationSchemasForTerraform,
    InfrastructureDeployForTerraform,
    InfrastructurePrepareForTerraform,
    ProjectDependenciesUpdateForTerraform,
    ProjectInitForTerraform,
    ProjectLintForTerraform,
  );
}
