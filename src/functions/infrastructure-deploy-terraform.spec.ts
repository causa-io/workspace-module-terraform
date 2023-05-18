import { WorkspaceContext } from '@causa/workspace';
import { InfrastructureDeploy } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { TerraformService } from '../services/index.js';
import { InfrastructureDeployForTerraform } from './infrastructure-deploy-terraform.js';

describe('InfrastructureDeployForTerraform', () => {
  let context: WorkspaceContext;
  let terraformService: TerraformService;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: { name: '🏗️', type: 'infrastructure', language: 'terraform' },
        terraform: { workspace: 'dev' },
      },
      functions: [InfrastructureDeployForTerraform],
    }));
    terraformService = context.service(TerraformService);
    jest.spyOn(terraformService, 'init').mockResolvedValueOnce();
    jest
      .spyOn(terraformService, 'workspaceShow')
      .mockResolvedValueOnce('other');
    jest.spyOn(terraformService, 'workspaceSelect').mockResolvedValue();
    jest.spyOn(terraformService, 'apply').mockResolvedValueOnce();
  });

  it('should call terraform apply', async () => {
    await context.call(InfrastructureDeploy, {
      deployment: '/plan.out',
    });

    expect(terraformService.init).toHaveBeenCalledOnceWith({});
    expect(terraformService.workspaceShow).toHaveBeenCalledOnceWith({});
    expect(terraformService.workspaceSelect).toHaveBeenCalledWith('dev', {
      orCreate: undefined,
    });
    expect(terraformService.apply).toHaveBeenCalledOnceWith('/plan.out', {
      logging: 'info',
    });
    expect(terraformService.workspaceSelect).toHaveBeenCalledWith('other', {});
  });

  it('should not handle non-terraform projects', async () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: { name: '🏗️', type: 'infrastructure', language: 'javascript' },
      },
      functions: [InfrastructureDeployForTerraform],
    }));

    expect(() =>
      context.call(InfrastructureDeploy, {
        deployment: '/plan.out',
      }),
    ).toThrow(NoImplementationFoundError);
  });
});
