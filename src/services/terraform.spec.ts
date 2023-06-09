import { WorkspaceContext } from '@causa/workspace';
import { ProcessServiceExitCodeError } from '@causa/workspace-core';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
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

      await expect(actualPromise).rejects.toThrowError(expectedError);
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
  });
});
