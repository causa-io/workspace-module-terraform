import { WorkspaceContext } from '@causa/workspace';
import { InfrastructureDeploy } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import { mkdtemp, rm, stat, writeFile } from 'fs/promises';
import 'jest-extended';
import { resolve } from 'path';
import { TerraformService } from '../../services/index.js';
import { InfrastructureDeployForTerraform } from './deploy-terraform.js';

describe('InfrastructureDeployForTerraform', () => {
  let context: WorkspaceContext;
  let terraformService: TerraformService;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = resolve(await mkdtemp('causa-test-'));
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

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should call terraform apply and remove the plan file', async () => {
    const deployment = resolve(tmpDir, 'plan.out');
    await writeFile(deployment, '📄');

    await context.call(InfrastructureDeploy, { deployment });

    expect(terraformService.init).toHaveBeenCalledExactlyOnceWith({});
    expect(terraformService.workspaceShow).toHaveBeenCalledExactlyOnceWith({});
    expect(terraformService.workspaceSelect).toHaveBeenCalledWith('dev', {
      orCreate: undefined,
    });
    expect(terraformService.apply).toHaveBeenCalledExactlyOnceWith(deployment, {
      logging: 'info',
    });
    expect(terraformService.workspaceSelect).toHaveBeenCalledWith('other', {});
    expect(stat(deployment)).rejects.toThrow('ENOENT');
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
