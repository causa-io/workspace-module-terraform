import { WorkspaceContext } from '@causa/workspace';
import { InfrastructurePrepare } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { resolve } from 'path';
import { TerraformService } from '../services/index.js';
import { InfrastructurePrepareForTerraform } from './infrastructure-prepare-terraform.js';

describe('InfrastructurePrepareForTerraform', () => {
  let context: WorkspaceContext;
  let terraformService: TerraformService;
  let planMock: jest.SpiedFunction<TerraformService['plan']>;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: { name: '🏗️', type: 'infrastructure', language: 'terraform' },
        terraform: { workspace: 'dev' },
        infrastructure: {
          variables: {
            my_normal_var: '🤖',
            my_template_var: {
              $format: "${ configuration('workspace.name') }",
            },
          },
        },
      },
      functions: [InfrastructurePrepareForTerraform],
    }));
    terraformService = context.service(TerraformService);
    jest.spyOn(terraformService, 'init').mockResolvedValueOnce();
    jest
      .spyOn(terraformService, 'workspaceShow')
      .mockResolvedValueOnce('other');
    jest.spyOn(terraformService, 'workspaceSelect').mockResolvedValue();
    planMock = jest.spyOn(terraformService, 'plan').mockResolvedValueOnce(true);
    jest.spyOn(terraformService, 'show').mockResolvedValueOnce('🗺️');
  });

  it('should render variables and call terraform plan', async () => {
    planMock.mockReset();
    planMock.mockResolvedValueOnce(false);

    const actualResult = await context.call(InfrastructurePrepare, {
      output: '/plan.out',
    });

    expect(actualResult).toEqual({
      output: '/plan.out',
      isDeploymentNeeded: false,
    });
    expect(terraformService.init).toHaveBeenCalledOnceWith({});
    expect(terraformService.workspaceShow).toHaveBeenCalledOnceWith({});
    expect(terraformService.workspaceSelect).toHaveBeenCalledWith('dev', {
      orCreate: true,
    });
    expect(terraformService.plan).toHaveBeenCalledOnceWith('/plan.out', {
      variables: {
        my_normal_var: '🤖',
        my_template_var: '🏷️',
      },
    });
    expect(terraformService.workspaceSelect).toHaveBeenCalledWith('other', {});
  });

  it('should print the plan and use the default plan file location', async () => {
    const expectedOutput = resolve('plan.out');

    const actualResult = await context.call(InfrastructurePrepare, {
      print: true,
    });

    expect(actualResult).toEqual({
      output: expectedOutput,
      isDeploymentNeeded: true,
    });
    expect(terraformService.init).toHaveBeenCalledOnceWith({});
    expect(terraformService.workspaceShow).toHaveBeenCalledOnceWith({});
    expect(terraformService.workspaceSelect).toHaveBeenCalledWith('dev', {
      orCreate: true,
    });
    expect(terraformService.plan).toHaveBeenCalledOnceWith(expectedOutput, {
      variables: {
        my_normal_var: '🤖',
        my_template_var: '🏷️',
      },
    });
    expect(terraformService.show).toHaveBeenCalledOnceWith(expectedOutput);
    expect(terraformService.workspaceSelect).toHaveBeenCalledWith('other', {});
  });

  it('should not handle non-terraform projects', async () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: { name: '🏗️', type: 'infrastructure', language: 'javascript' },
      },
      functions: [InfrastructurePrepareForTerraform],
    }));

    expect(() =>
      context.call(InfrastructurePrepare, {
        output: '/plan.out',
      }),
    ).toThrow(NoImplementationFoundError);
  });
});
