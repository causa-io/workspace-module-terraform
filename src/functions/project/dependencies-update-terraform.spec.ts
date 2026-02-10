import { WorkspaceContext } from '@causa/workspace';
import { ProjectDependenciesUpdate } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { TerraformService } from '../../services/index.js';
import { ProjectDependenciesUpdateForTerraform } from './dependencies-update-terraform.js';

describe('ProjectDependenciesUpdateForTerraform', () => {
  let context: WorkspaceContext;
  let terraformService: TerraformService;

  beforeEach(async () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: { name: '🏗️', type: 'infrastructure', language: 'terraform' },
      },
      functions: [ProjectDependenciesUpdateForTerraform],
    }));
    terraformService = context.service(TerraformService);
    jest.spyOn(terraformService, 'init').mockResolvedValue();
  });

  it('should not handle non-terraform projects', async () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: { name: '🏗️', type: 'infrastructure', language: 'python' },
      },
      functions: [ProjectDependenciesUpdateForTerraform],
    }));

    expect(() => context.call(ProjectDependenciesUpdate, {})).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should run terraform init with the upgrade option', async () => {
    const actualDidUpdate = await context.call(ProjectDependenciesUpdate, {});

    expect(actualDidUpdate).toBeTrue();
    expect(terraformService.init).toHaveBeenCalledExactlyOnceWith({
      upgrade: true,
      logging: 'debug',
    });
  });
});
