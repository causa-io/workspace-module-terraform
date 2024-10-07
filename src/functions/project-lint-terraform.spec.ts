import { WorkspaceContext } from '@causa/workspace';
import {
  ProcessServiceExitCodeError,
  ProjectLint,
} from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import { mkdir, mkdtemp, rm } from 'fs/promises';
import 'jest-extended';
import { join, resolve } from 'path';
import { TerraformService } from '../services/index.js';
import { ProjectLintForTerraform } from './project-lint-terraform.js';

describe('ProjectLintForTerraform', () => {
  let tmpDir: string;
  let context: WorkspaceContext;
  let terraformService: TerraformService;
  let validateMock: jest.SpiedFunction<TerraformService['validate']>;

  beforeEach(async () => {
    tmpDir = resolve(await mkdtemp('causa-test-'));
    ({ context } = createContext({
      projectPath: tmpDir,
      configuration: {
        workspace: { name: '🏷️' },
        project: { name: '🏗️', type: 'infrastructure', language: 'terraform' },
      },
      functions: [ProjectLintForTerraform],
    }));
    terraformService = context.service(TerraformService);
    jest.spyOn(terraformService, 'fmt').mockResolvedValue({ code: 0 });
    validateMock = jest.spyOn(terraformService, 'validate').mockResolvedValue();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should not handle non-terraform projects', async () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: { name: '🏗️', type: 'infrastructure', language: 'python' },
      },
      functions: [ProjectLintForTerraform],
    }));

    expect(() => context.call(ProjectLint, {})).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should run terraform validate and fmt', async () => {
    await context.call(ProjectLint, {});

    expect(terraformService.validate).toHaveBeenCalledExactlyOnceWith({
      logging: { stdout: null, stderr: 'info' },
    });
    expect(terraformService.fmt).toHaveBeenCalledExactlyOnceWith({
      check: true,
      recursive: true,
      logging: 'info',
      targets: [context.projectPath],
    });
  });

  it('should call fmt with additional paths', async () => {
    const projectPath = join(tmpDir, 'project');
    await mkdir(projectPath, { recursive: true });
    await mkdir(join(tmpDir, 'other', 'sub', 'folder'), { recursive: true });
    await mkdir(join(tmpDir, 'not-this-one'), { recursive: true });
    ({ context } = createContext({
      rootPath: tmpDir,
      projectPath,
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: '🏗️',
          type: 'infrastructure',
          language: 'terraform',
          externalFiles: ['other/*'],
        },
      },
      functions: [ProjectLintForTerraform],
    }));
    terraformService = context.service(TerraformService);
    jest.spyOn(terraformService, 'fmt').mockResolvedValue({ code: 0 });
    jest.spyOn(terraformService, 'validate').mockResolvedValue();

    await context.call(ProjectLint, {});

    expect(terraformService.validate).toHaveBeenCalledExactlyOnceWith({
      logging: { stdout: null, stderr: 'info' },
    });
    expect(terraformService.fmt).toHaveBeenCalledExactlyOnceWith({
      check: true,
      recursive: true,
      logging: 'info',
      targets: expect.arrayContaining([
        projectPath,
        join(tmpDir, 'other', 'sub'),
      ]),
    });
  });

  it('should throw when one of the terraform commands fails', async () => {
    validateMock.mockRejectedValueOnce(
      new ProcessServiceExitCodeError('terraform', [], { code: 1 }),
    );

    const actualPromise = context.call(ProjectLint, {});

    await expect(actualPromise).rejects.toThrow(
      'Linting the Terraform project failed.',
    );
  });
});
