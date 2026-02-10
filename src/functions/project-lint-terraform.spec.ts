import { WorkspaceContext } from '@causa/workspace';
import { ProjectLint } from '@causa/workspace-core';
import { ProcessServiceExitCodeError } from '@causa/workspace-core/services';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import 'jest-extended';
import { join, resolve } from 'path';
import { TerraformService } from '../services/index.js';
import { ProjectLintForTerraform } from './project-lint-terraform.js';

describe('ProjectLintForTerraform', () => {
  let tmpDir: string;
  let context: WorkspaceContext;
  let terraformService: TerraformService;
  let fmtSpy: jest.SpiedFunction<TerraformService['fmt']>;

  beforeEach(async () => {
    tmpDir = resolve(await mkdtemp('causa-test-'));
    initContext();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  function initContext(options: Parameters<typeof createContext>[0] = {}) {
    ({ context } = createContext({
      projectPath: tmpDir,
      configuration: {
        workspace: { name: '🏷️' },
        project: { name: '🏗️', type: 'infrastructure', language: 'terraform' },
      },
      functions: [ProjectLintForTerraform],
      ...options,
    }));
    terraformService = context.service(TerraformService);
    fmtSpy = jest.spyOn(terraformService, 'fmt').mockResolvedValue({ code: 0 });
  }

  it('should not handle non-terraform projects', async () => {
    initContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: { name: '🏗️', type: 'infrastructure', language: 'python' },
      },
    });

    expect(() => context.call(ProjectLint, {})).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should run terraform fmt', async () => {
    await context.call(ProjectLint, {});

    expect(terraformService.fmt).toHaveBeenCalledExactlyOnceWith({
      check: true,
      recursive: true,
      logging: 'info',
      targets: [context.projectPath],
    });
  });

  it('should call fmt with additional targets', async () => {
    const projectPath = join(tmpDir, 'project');
    const matchingFolder = join(tmpDir, 'other', 'sub', 'folder');
    const matchingFile = join(tmpDir, 'other', 'sub', 'file.tf');
    const notMatchingFolder = join(tmpDir, 'not-this-one');
    await mkdir(projectPath, { recursive: true });
    await mkdir(matchingFolder, { recursive: true });
    await mkdir(notMatchingFolder, { recursive: true });
    await writeFile(matchingFile, '📄');
    await writeFile(join(matchingFolder, 'other.nope'), '📄');
    await writeFile(join(notMatchingFolder, 'file.tf'), '📄');
    initContext({
      rootPath: tmpDir,
      projectPath,
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: '🏗️',
          type: 'infrastructure',
          language: 'terraform',
          externalFiles: ['other/'],
        },
      },
    });

    await context.call(ProjectLint, {});

    expect(terraformService.fmt).toHaveBeenCalledExactlyOnceWith({
      check: true,
      recursive: true,
      logging: 'info',
      targets: expect.toIncludeSameMembers([projectPath, matchingFile]),
    });
  });

  it('should throw when one of the terraform commands fails', async () => {
    fmtSpy.mockRejectedValueOnce(
      new ProcessServiceExitCodeError('terraform', [], { code: 1 }),
    );

    const actualPromise = context.call(ProjectLint, {});

    await expect(actualPromise).rejects.toThrow(
      'Linting the Terraform project failed.',
    );
  });
});
