import { WorkspaceContext } from '@causa/workspace';
import { ProjectInit } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'fs/promises';
import 'jest-extended';
import { join, resolve } from 'path';
import { TerraformService } from '../services/index.js';
import { ProjectInitForTerraform } from './project-init-terraform.js';

describe('ProjectInitForTerraform', () => {
  let tmpDir: string;
  let context: WorkspaceContext;
  let terraformService: TerraformService;

  beforeEach(async () => {
    tmpDir = resolve(await mkdtemp('causa-test-'));
    ({ context } = createContext({
      projectPath: tmpDir,
      configuration: {
        workspace: { name: '🏷️' },
        project: { name: '🏗️', type: 'infrastructure', language: 'terraform' },
      },
      functions: [ProjectInitForTerraform],
    }));
    terraformService = context.service(TerraformService);
    jest.spyOn(terraformService, 'init').mockResolvedValue();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should not support the workspace option', () => {
    expect(() => context.call(ProjectInit, { workspace: true })).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should not handle non-terraform projects', async () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: { name: '🏗️', type: 'infrastructure', language: 'python' },
      },
      functions: [ProjectInitForTerraform],
    }));

    expect(() => context.call(ProjectInit, {})).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should run terraform init', async () => {
    await context.call(ProjectInit, {});

    expect(terraformService.init).toHaveBeenCalledExactlyOnceWith({
      logging: 'debug',
    });
  });

  it('should clean the terraform folder before running terraform init', async () => {
    const terraformDir = join(tmpDir, '.terraform');
    const filePath = join(terraformDir, 'some-module');
    await mkdir(terraformDir, { recursive: true });
    await writeFile(filePath, '🍱');

    await context.call(ProjectInit, { force: true });

    expect(terraformService.init).toHaveBeenCalledExactlyOnceWith({
      logging: 'debug',
    });
    await expect(stat(filePath)).rejects.toThrow('ENOENT');
  });
});
