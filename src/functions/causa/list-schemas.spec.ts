import { CausaListConfigurationSchemas } from '@causa/workspace-core';
import { createContext } from '@causa/workspace/testing';
import 'jest-extended';
import { basename } from 'path';
import { CausaListConfigurationSchemasForTerraform } from './list-schemas.js';

describe('CausaListConfigurationSchemasForTerraform', () => {
  it('should return the configuration schemas for the Terraform module', async () => {
    const { context } = createContext({
      configuration: { workspace: { name: 'test' } },
      functions: [CausaListConfigurationSchemasForTerraform],
    });

    const actualSchemas = await context.call(CausaListConfigurationSchemas, {});

    const actualBaseNames = actualSchemas.map((s) => basename(s));
    expect(actualBaseNames).toIncludeSameMembers([
      'project.yaml',
      'terraform.yaml',
    ]);
  });
});
