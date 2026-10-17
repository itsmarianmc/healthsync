import { readFileSync } from 'node:fs';
import ts from 'typescript';

export function moduleLoader(mocks = {}) {
  const cache = new Map();
  return function load(name) {
    if (name in mocks) return mocks[name];
    if (cache.has(name)) return cache.get(name).exports;
    const js = ts.transpileModule(readFileSync(`src/app/_lib/${name.replace('./', '')}.ts`, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const loaded = { exports: {} };
    cache.set(name, loaded);
    new Function('require', 'module', 'exports', js)(load, loaded, loaded.exports);
    return loaded.exports;
  };
}

export function storageFixture() {
  const items = new Map();
  globalThis.localStorage = {
    getItem: key => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: key => items.delete(key),
  };
  globalThis.window = new EventTarget();
}

export function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
