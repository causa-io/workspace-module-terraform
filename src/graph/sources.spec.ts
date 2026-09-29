import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { parseTerraformDirectory } from './sources.js';

describe('parseTerraformDirectory', () => {
  let rootPath: string;

  beforeEach(async () => {
    rootPath = await mkdtemp(join(tmpdir(), 'causa-graph-'));
  });

  afterEach(async () => {
    await rm(rootPath, { recursive: true, force: true });
  });

  async function write(files: Record<string, string>) {
    for (const [path, content] of Object.entries(files)) {
      await mkdir(join(rootPath, path, '..'), { recursive: true });
      await writeFile(join(rootPath, path), content);
    }
  }

  it('should parse the module and resource blocks of a directory and evaluate local-based expressions', async () => {
    await write({
      'infra/variables.tf': `
locals {
  causa_directory = "\${path.module}/../.causa"
  configurations  = "\${local.causa_directory}/project-configurations"
}`,
      'infra/service.tf': `
module "service_api" {
  source  = "causa-io/service-container-cloud-run/google"
  version = "1.1.0"

  configuration_file = "\${local.configurations}/my-service.json"
  enable_triggers    = true
  location           = var.location
}

resource "google_storage_bucket" "assets" {
  name = "assets"
}`,
      'infra/nested/ignored.tf': `
module "ignored" {
  source = "causa-io/ignored/google"
}`,
    });

    const actualDirectory = await parseTerraformDirectory(rootPath, 'infra');

    expect(actualDirectory?.moduleBlocks).toEqual([
      {
        name: 'service_api',
        address: 'module.service_api',
        declaration: {
          path: 'infra/service.tf',
          pointer: 'module.service_api',
          location: { start: { line: 2 } },
        },
        source: 'causa-io/service-container-cloud-run/google',
        version: '1.1.0',
        arguments: {
          configuration_file: {
            value: 'infra/../.causa/project-configurations/my-service.json',
          },
          enable_triggers: { value: true },
          location: { expression: '${var.location}' },
        },
      },
    ]);
    expect(actualDirectory?.resourceBlocks).toEqual([
      {
        type: 'google_storage_bucket',
        name: 'assets',
        address: 'google_storage_bucket.assets',
        declaration: {
          path: 'infra/service.tf',
          pointer: 'google_storage_bucket.assets',
          location: { start: { line: 11 } },
        },
        arguments: { name: { value: 'assets' } },
      },
    ]);
  });

  it('should only evaluate templates that can be evaluated correctly', async () => {
    await write({
      'infra/main.tf': `
locals {
  name  = "x"
  flag  = true
  items = ["a"]
}

module "templates" {
  source = "causa-io/templates/google"

  escaped          = "$\${local.name}"
  mixed            = "a $\${b} \${local.name}-\${local.flag}"
  directive        = "%{ if local.flag }yes%{ endif }"
  escaped_directive = "%%{ literal }"
  whole_list       = local.items
  list_in_template = "x-\${local.items}"
  object           = { name = local.name, other = "b" }
  literal_object   = { other = "b" }
  templated_set    = toset(["\${local.name}"])
  nested_braces    = "\${merge(local.items, { b = 1 })}"
}`,
    });

    const actualDirectory = await parseTerraformDirectory(rootPath, 'infra');

    expect(actualDirectory?.moduleBlocks[0].arguments).toEqual({
      escaped: { value: '${local.name}' },
      mixed: { value: 'a ${b} x-true' },
      directive: { expression: expect.stringContaining('%{') },
      escaped_directive: { value: '%{ literal }' },
      whole_list: { value: ['a'] },
      list_in_template: { expression: 'x-${local.items}' },
      object: { expression: '{"name":"${local.name}","other":"b"}' },
      literal_object: { value: { other: 'b' } },
      templated_set: { expression: expect.stringContaining('toset') },
      nested_braces: { expression: expect.stringContaining('merge') },
    });
  });

  it('should return undefined for a directory that does not exist', async () => {
    const actualDirectory = await parseTerraformDirectory(rootPath, 'missing');

    expect(actualDirectory).toBeUndefined();
  });
});
