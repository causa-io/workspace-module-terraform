import { WorkspaceContext } from '@causa/workspace';
import { GraphContext } from '@causa/workspace-core/graph';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import 'jest-extended';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { pino } from 'pino';
import { TerraformProjectsFact } from './projects.js';

const FIXTURE: Record<string, string> = {
  'causa.yaml': 'workspace:\n  name: shop\n',
  'domains/ordering/causa.yaml': 'domain:\n  name: Ordering\n',
  'infrastructure/backend/causa.yaml':
    'project:\n  name: backend\n  type: infrastructure\n  language: terraform\n',
  'infrastructure/backend/main.tf': `module "ordering" {
  source = "../../domains/ordering/infrastructure"
}

module "missing" {
  source = "./missing"
}

resource "google_storage_bucket" "assets" {
  name = "assets"
}
`,
  'infrastructure/backend/nested/main.tf': `module "nested" {
  source = "causa-io/nested/google"
}
`,
  'domains/ordering/infrastructure/main.tf': `locals {
  topic = "orders"
}

module "topics" {
  source  = "causa-io/event-topics-pubsub/google"
  version = "1.0.0"

  name     = local.topic
  location = var.location
}
`,
  'tools/causa.yaml':
    'project:\n  name: tools\n  type: package\n  language: typescript\n',
  'tools/main.tf': `module "tool" {
  source = "causa-io/tool/google"
}
`,
};

describe('Terraform projects', () => {
  let rootPath: string;
  let graph: GraphContext;

  beforeEach(async () => {
    rootPath = resolve(await mkdtemp(join(tmpdir(), 'causa-tests-')));
    for (const [file, content] of Object.entries(FIXTURE)) {
      await mkdir(dirname(join(rootPath, file)), { recursive: true });
      await writeFile(join(rootPath, file), content);
    }

    const context = await WorkspaceContext.init({
      workingDirectory: rootPath,
      logger: pino({ level: 'silent' }),
    });
    graph = new GraphContext(context);
  });

  afterEach(async () => {
    await rm(rootPath, { recursive: true, force: true });
  });

  describe('TerraformProjectsFact', () => {
    it('should read the configuration of each Terraform project from its root module', async () => {
      const actualProjects = await graph.get(TerraformProjectsFact);

      const project = expect.objectContaining({
        directory: 'infrastructure/backend',
      });
      const root = {
        project,
        directory: 'infrastructure/backend',
        domain: undefined,
        address: '',
        via: [],
      };
      const orderingBlock = {
        name: 'ordering',
        address: 'module.ordering',
        declaration: {
          path: 'infrastructure/backend/main.tf',
          pointer: 'module.ordering',
          location: { start: { line: 1 } },
        },
        source: '../../domains/ordering/infrastructure',
        module: root,
        arguments: {},
      };
      const missingBlock = {
        name: 'missing',
        address: 'module.missing',
        declaration: {
          path: 'infrastructure/backend/main.tf',
          pointer: 'module.missing',
          location: { start: { line: 5 } },
        },
        source: './missing',
        module: root,
        arguments: {},
      };
      const included = {
        project,
        directory: 'domains/ordering/infrastructure',
        domain: expect.objectContaining({ directory: 'domains/ordering' }),
        address: 'module.ordering',
        via: [orderingBlock],
      };
      expect(actualProjects).toEqual([
        {
          project,
          modules: [root, included],
          moduleBlocks: [
            orderingBlock,
            missingBlock,
            {
              name: 'topics',
              address: 'module.topics',
              declaration: {
                path: 'domains/ordering/infrastructure/main.tf',
                pointer: 'module.topics',
                location: { start: { line: 5 } },
              },
              source: 'causa-io/event-topics-pubsub/google',
              version: '1.0.0',
              module: included,
              arguments: {
                name: { value: 'orders' },
                location: { expression: '${var.location}' },
              },
            },
          ],
          resourceBlocks: [
            {
              type: 'google_storage_bucket',
              name: 'assets',
              address: 'google_storage_bucket.assets',
              declaration: {
                path: 'infrastructure/backend/main.tf',
                pointer: 'google_storage_bucket.assets',
                location: { start: { line: 9 } },
              },
              module: root,
              arguments: { name: { value: 'assets' } },
            },
          ],
          missingModules: [missingBlock],
        },
      ]);
    });
  });
});
