import module from 'module';

const require = module.createRequire(import.meta.url);

const heavyModules = ['@cdktf/hcl2json'];

describe('registerModule', () => {
  function getLoadedModules(): string[] {
    return [
      // ECMAScript modules.
      ...Object.keys((module as any)._cache),
      // CommonJS modules.
      ...Object.keys(require.cache),
    ];
  }

  it('should not import heavy modules during function registration', async () => {
    const { default: registerModule } = await import('./index.js');
    await registerModule({ registerFunctionImplementations: () => {} });

    const actualModules = getLoadedModules();

    const actualHeavyModules = actualModules.filter((m) =>
      heavyModules.some((fm) => m.includes(fm)),
    );
    expect(actualHeavyModules).toBeEmpty();
  });
});
