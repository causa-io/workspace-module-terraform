import { WorkspaceContext } from '@causa/workspace';
import { InfrastructurePrepare } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import { mkdtemp, rm, stat, writeFile } from 'fs/promises';
import 'jest-extended';
import { resolve } from 'path';
import { TerraformService } from '../../services/index.js';
import { InfrastructurePrepareForTerraform } from './prepare-terraform.js';

describe('InfrastructurePrepareForTerraform', () => {
  let context: WorkspaceContext;
  let terraformService: TerraformService;
  let planMock: jest.SpiedFunction<TerraformService['plan']>;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = resolve(await mkdtemp('causa-test-'));
    ({ context } = createContext({
      rootPath: '/some',
      projectPath: '/some/project/path',
      workingDirectory: '/some/project/path/nested',
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

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should render variables and call terraform plan', async () => {
    const actualResult = await context.call(InfrastructurePrepare, {
      output: '/plan.out',
    });

    expect(actualResult).toEqual({
      output: '/plan.out',
      isDeploymentNeeded: true,
    });
    expect(terraformService.init).toHaveBeenCalledExactlyOnceWith({});
    expect(terraformService.workspaceShow).toHaveBeenCalledExactlyOnceWith({});
    expect(terraformService.workspaceSelect).toHaveBeenCalledWith('dev', {
      orCreate: true,
    });
    expect(terraformService.plan).toHaveBeenCalledExactlyOnceWith('/plan.out', {
      variables: {
        my_normal_var: '🤖',
        my_template_var: '🏷️',
      },
    });
    expect(terraformService.show).not.toHaveBeenCalled();
    expect(terraformService.workspaceSelect).toHaveBeenCalledWith('other', {});
  });

  it('should plan the destruction', async () => {
    const actualResult = await context.call(InfrastructurePrepare, {
      output: '/plan.out',
      destroy: true,
    });

    expect(actualResult).toEqual({
      output: '/plan.out',
      isDeploymentNeeded: true,
    });
    expect(terraformService.init).toHaveBeenCalledExactlyOnceWith({});
    expect(terraformService.workspaceShow).toHaveBeenCalledExactlyOnceWith({});
    expect(terraformService.workspaceSelect).toHaveBeenCalledWith('dev', {
      orCreate: false,
    });
    expect(terraformService.plan).toHaveBeenCalledExactlyOnceWith('/plan.out', {
      variables: {
        my_normal_var: '🤖',
        my_template_var: '🏷️',
      },
      destroy: true,
    });
    expect(terraformService.show).not.toHaveBeenCalled();
    expect(terraformService.workspaceSelect).toHaveBeenCalledWith('other', {});
  });

  it('should print the plan and use the default plan file location', async () => {
    const expectedOutput = resolve(context.projectPath ?? '', 'plan.out');

    const actualResult = await context.call(InfrastructurePrepare, {
      print: true,
    });

    expect(actualResult).toEqual({
      output: expectedOutput,
      isDeploymentNeeded: true,
    });
    expect(terraformService.init).toHaveBeenCalledExactlyOnceWith({});
    expect(terraformService.workspaceShow).toHaveBeenCalledExactlyOnceWith({});
    expect(terraformService.workspaceSelect).toHaveBeenCalledWith('dev', {
      orCreate: true,
    });
    expect(terraformService.plan).toHaveBeenCalledExactlyOnceWith(
      expectedOutput,
      {
        variables: {
          my_normal_var: '🤖',
          my_template_var: '🏷️',
        },
      },
    );
    expect(terraformService.show).toHaveBeenCalledExactlyOnceWith(
      expectedOutput,
    );
    expect(terraformService.workspaceSelect).toHaveBeenCalledWith('other', {});
  });

  it('should remove the plan file if no deployment is needed', async () => {
    const output = resolve(tmpDir, 'plan.out');
    planMock.mockReset();
    planMock.mockImplementationOnce(async () => {
      await writeFile(output, '🗺️');
      return false;
    });

    const actualResult = await context.call(InfrastructurePrepare, {
      output,
    });

    expect(actualResult).toEqual({
      output: '',
      isDeploymentNeeded: false,
    });
    expect(terraformService.init).toHaveBeenCalledExactlyOnceWith({});
    expect(terraformService.workspaceShow).toHaveBeenCalledExactlyOnceWith({});
    expect(terraformService.workspaceSelect).toHaveBeenCalledWith('dev', {
      orCreate: true,
    });
    expect(terraformService.plan).toHaveBeenCalledExactlyOnceWith(output, {
      variables: {
        my_normal_var: '🤖',
        my_template_var: '🏷️',
      },
    });
    expect(terraformService.show).not.toHaveBeenCalled();
    expect(terraformService.workspaceSelect).toHaveBeenCalledWith('other', {});
    expect(stat(output)).rejects.toThrow('ENOENT');
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
