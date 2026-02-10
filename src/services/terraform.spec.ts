import { WorkspaceContext } from '@causa/workspace';
import {
  ProcessService,
  ProcessServiceExitCodeError,
} from '@causa/workspace-core/services';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { major } from 'semver';
import { IncompatibleTerraformVersionError } from './terraform.errors.js';
import { TerraformService } from './terraform.js';

describe('TerraformService', () => {
  let context: WorkspaceContext;
  let service: TerraformService;
  let terraformSpy: jest.SpiedFunction<TerraformService['terraform']>;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: { terraform: { workspace: 'dev' } },
    }));
    service = context.service(TerraformService);
    terraformSpy = jest.spyOn(service, 'terraform');
  });

  describe('terraform', () => {
    it('should spawn a terraform process', async () => {
      const actualResult = await service.terraform('--version', [], {
        capture: { stdout: true },
      });

      expect(actualResult.code).toEqual(0);
      expect(actualResult.stdout).toStartWith('Terraform v');
    });

    it('should throw if the configured Terraform version is not compatible', async () => {
      ({ context } = createContext({
        configuration: {
          workspace: { name: '🏷️' },
          terraform: { version: '9999.0.0' },
        },
      }));
      service = context.service(TerraformService);

      const actualPromise = service.terraform('-version', [], {});

      await expect(actualPromise).rejects.toThrow(
        IncompatibleTerraformVersionError,
      );
      expect(service.requiredVersion).toEqual('9999.0.0');
    });

    it('should validate a compatible Terraform version', async () => {
      const terraformVersionResult = await context
        .service(ProcessService)
        .spawn('terraform', ['-version', '-json'], {
          capture: { stdout: true },
        }).result;
      const currentTerraformVersion = JSON.parse(
        terraformVersionResult.stdout ?? '',
      ).terraform_version;
      ({ context } = createContext({
        configuration: {
          workspace: { name: '🏷️' },
          terraform: { version: `${major(currentTerraformVersion)}.0.0` },
        },
      }));
      service = context.service(TerraformService);

      const actualPromise = service.terraform('-version', [], {});

      await expect(actualPromise).toResolve();
      expect((service as any).terraformVersionCheck).toBeDefined();
      expect((service as any).hasCompatibleTerraformVersion).toBeTrue();
    });
  });

  describe('init', () => {
    it('should run the init command', async () => {
      terraformSpy.mockResolvedValueOnce({ code: 0 });

      await service.init();

      expect(service.terraform).toHaveBeenCalledOnce();
      const [actualCommand, args] = terraformSpy.mock.calls[0];
      const actualArgs = args.join(' ');
      expect(actualCommand).toEqual('init');
      expect(actualArgs).toContain('-input=false');
    });

    it('should set the upgrade option', async () => {
      terraformSpy.mockResolvedValueOnce({ code: 0 });

      await service.init({ upgrade: true });

      expect(service.terraform).toHaveBeenCalledOnce();
      const [actualCommand, args] = terraformSpy.mock.calls[0];
      const actualArgs = args.join(' ');
      expect(actualCommand).toEqual('init');
      expect(actualArgs).toContain('-upgrade');
      expect(actualArgs).toContain('-input=false');
    });
  });

  describe('workspaceShow', () => {
    it('should run the workspace show command', async () => {
      terraformSpy.mockResolvedValueOnce({ code: 0, stdout: ' 🗺️  ' });

      const actualPlan = await service.workspaceShow();

      expect(actualPlan).toEqual('🗺️');
      expect(service.terraform).toHaveBeenCalledOnce();
      const [actualCommand, args, options] = terraformSpy.mock.calls[0];
      expect(options).toMatchObject({ capture: { stdout: true } });
      const actualArgs = args.join(' ');
      expect(actualCommand).toEqual('workspace');
      expect(actualArgs).toStartWith('show');
    });
  });

  describe('workspaceSelect', () => {
    it('should run the workspace select command', async () => {
      terraformSpy.mockResolvedValueOnce({ code: 0 });

      await service.workspaceSelect('test');

      expect(service.terraform).toHaveBeenCalledOnce();
      const [actualCommand, args] = terraformSpy.mock.calls[0];
      const actualArgs = args.join(' ');
      expect(actualCommand).toEqual('workspace');
      expect(actualArgs).toStartWith('select');
      expect(actualArgs).toContain('test');
    });

    it('should run the workspace select command with -or-create=true', async () => {
      terraformSpy.mockResolvedValueOnce({ code: 0 });

      await service.workspaceSelect('test', { orCreate: true });

      expect(service.terraform).toHaveBeenCalledOnce();
      const [actualCommand, args] = terraformSpy.mock.calls[0];
      const actualArgs = args.join(' ');
      expect(actualCommand).toEqual('workspace');
      expect(actualArgs).toStartWith('select');
      expect(actualArgs).toContain('test');
      expect(actualArgs).toContain('-or-create=true');
    });
  });

  describe('plan', () => {
    it('should run the plan command', async () => {
      terraformSpy.mockResolvedValueOnce({ code: 0 });
      const expectedPath = 'test.tfplan';

      const actualHasChanges = await service.plan(expectedPath, {
        destroy: true,
        variables: { some_tf_var: '🏗️' },
      });

      expect(actualHasChanges).toBeFalse();
      expect(service.terraform).toHaveBeenCalledOnce();
      const [actualCommand, args] = terraformSpy.mock.calls[0];
      const actualArgs = args.join(' ');
      expect(actualCommand).toEqual('plan');
      expect(actualArgs).toContain('-input=false');
      expect(actualArgs).toContain('-out=test.tfplan');
      expect(actualArgs).toContain('-destroy');
      expect(actualArgs).toContain('-detailed-exitcode');
      expect(actualArgs).toContain('-var some_tf_var=🏗️');
    });

    it('should return true if the plan has changes', async () => {
      terraformSpy.mockRejectedValueOnce(
        new ProcessServiceExitCodeError('terraform', ['plan'], { code: 2 }),
      );
      const expectedPath = 'test.tfplan';

      const actualHasChanges = await service.plan(expectedPath);

      expect(actualHasChanges).toBeTrue();
    });
  });

  describe('apply', () => {
    it('should run the apply command', async () => {
      terraformSpy.mockResolvedValueOnce({ code: 0 });
      const expectedPath = 'test.tfplan';

      await service.apply(expectedPath);

      expect(service.terraform).toHaveBeenCalledOnce();
      const [actualCommand, args] = terraformSpy.mock.calls[0];
      const actualArgs = args.join(' ');
      expect(actualCommand).toEqual('apply');
      expect(actualArgs).toContain('-input=false');
      expect(actualArgs).toContain('test.tfplan');
    });
  });

  describe('show', () => {
    it('should run the show command', async () => {
      terraformSpy.mockResolvedValueOnce({ code: 0, stdout: '🏗️' });
      const expectedPath = 'test.tfplan';

      const actualPlan = await service.show(expectedPath);

      expect(actualPlan).toEqual('🏗️');
      expect(service.terraform).toHaveBeenCalledOnce();
      const [actualCommand, args, options] = terraformSpy.mock.calls[0];
      expect(options).toMatchObject({
        capture: { stdout: true, stderr: true },
      });
      const actualArgs = args.join(' ');
      expect(actualCommand).toEqual('show');
      expect(actualArgs).toContain('test.tfplan');
    });
  });

  describe('validate', () => {
    it('should run the validate command', async () => {
      terraformSpy.mockResolvedValueOnce({ code: 0 });

      await service.validate();

      expect(service.terraform).toHaveBeenCalledExactlyOnceWith(
        'validate',
        [],
        {},
      );
    });
  });

  describe('fmt', () => {
    it('should run the fmt command', async () => {
      const expectedResult = { code: 0 };
      terraformSpy.mockResolvedValueOnce(expectedResult);

      const actualResult = await service.fmt();

      expect(actualResult).toEqual(expectedResult);
      expect(service.terraform).toHaveBeenCalledExactlyOnceWith('fmt', [], {});
    });

    it('should run the fmt command with arguments', async () => {
      const expectedResult = { code: 0 };
      terraformSpy.mockResolvedValueOnce(expectedResult);

      const actualResult = await service.fmt({
        check: true,
        recursive: true,
        targets: ['file1.tf', 'folder/'],
      });

      expect(actualResult).toEqual(expectedResult);
      expect(service.terraform).toHaveBeenCalledOnce();
      const [actualCommand, args] = terraformSpy.mock.calls[0];
      const actualArgs = args.join(' ');
      expect(actualCommand).toEqual('fmt');
      expect(actualArgs).toContain('-check');
      expect(actualArgs).toContain('-recursive');
      expect(actualArgs).toEndWith('file1.tf folder/');
    });
  });

  describe('wrapWorkspaceOperation', () => {
    it('should select the workspace before running the function', async () => {
      const expectedResult = '✨';
      const expectedSpawnOptions = { workingDirectory: '📂' };
      const fn = jest.fn(async () => expectedResult);
      jest.spyOn(service, 'init').mockResolvedValueOnce();
      jest.spyOn(service, 'workspaceShow').mockResolvedValueOnce('other');
      jest.spyOn(service, 'workspaceSelect').mockResolvedValue();

      const actualResult = await service.wrapWorkspaceOperation(
        {
          workspace: 'new',
          createWorkspaceIfNeeded: true,
          ...expectedSpawnOptions,
        },
        fn,
      );

      expect(actualResult).toEqual(expectedResult);
      expect(service.init).toHaveBeenCalledExactlyOnceWith(
        expectedSpawnOptions,
      );
      expect(service.workspaceShow).toHaveBeenCalledExactlyOnceWith(
        expectedSpawnOptions,
      );
      expect(service.workspaceSelect).toHaveBeenCalledWith('new', {
        orCreate: true,
        ...expectedSpawnOptions,
      });
      expect(fn).toHaveBeenCalledOnce();
      expect(service.workspaceSelect).toHaveBeenCalledWith(
        'other',
        expectedSpawnOptions,
      );
    });

    it('should not select the workspace if it is already selected', async () => {
      const expectedResult = '✨';
      const expectedSpawnOptions = { workingDirectory: '📂' };
      const fn = jest.fn(async () => expectedResult);
      jest.spyOn(service, 'init').mockResolvedValueOnce();
      jest.spyOn(service, 'workspaceShow').mockResolvedValueOnce('existing');
      jest.spyOn(service, 'workspaceSelect').mockResolvedValue();

      const actualResult = await service.wrapWorkspaceOperation(
        { workspace: 'existing', ...expectedSpawnOptions },
        fn,
      );

      expect(actualResult).toEqual(expectedResult);
      expect(service.init).toHaveBeenCalledExactlyOnceWith(
        expectedSpawnOptions,
      );
      expect(service.workspaceShow).toHaveBeenCalledExactlyOnceWith(
        expectedSpawnOptions,
      );
      expect(service.workspaceSelect).not.toHaveBeenCalled();
      expect(fn).toHaveBeenCalledOnce();
    });

    it('should select back the workspace if the function throws', async () => {
      const expectedError = new Error('💥');
      const expectedSpawnOptions = { workingDirectory: '📂' };
      const fn = jest.fn(async () => {
        throw expectedError;
      });
      jest.spyOn(service, 'init').mockResolvedValueOnce();
      jest.spyOn(service, 'workspaceShow').mockResolvedValueOnce('other');
      jest.spyOn(service, 'workspaceSelect').mockResolvedValue();

      const actualPromise = service.wrapWorkspaceOperation(
        { ...expectedSpawnOptions },
        fn,
      );

      await expect(actualPromise).rejects.toThrow(expectedError);
      expect(service.init).toHaveBeenCalledExactlyOnceWith(
        expectedSpawnOptions,
      );
      expect(service.workspaceShow).toHaveBeenCalledExactlyOnceWith(
        expectedSpawnOptions,
      );
      expect(service.workspaceSelect).toHaveBeenCalledWith('dev', {
        orCreate: undefined,
        ...expectedSpawnOptions,
      });
      expect(fn).toHaveBeenCalledOnce();
      expect(service.workspaceSelect).toHaveBeenCalledWith(
        'other',
        expectedSpawnOptions,
      );
    });

    it('should throw if no workspace is configured', async () => {
      ({ context } = createContext({}));
      service = context.service(TerraformService);
      terraformSpy = jest
        .spyOn(service, 'terraform')
        .mockResolvedValue({ code: 0 });
      const fn = jest.fn(() => Promise.resolve());

      const actualPromise = service.wrapWorkspaceOperation({}, fn);

      await expect(actualPromise).rejects.toThrow(
        'The Terraform workspace for the operation is not configured.',
      );
      expect(fn).not.toHaveBeenCalled();
      expect(service.terraform).not.toHaveBeenCalled();
    });
  });
});
