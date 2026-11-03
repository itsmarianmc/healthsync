import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const run = (args, env = process.env) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: 'inherit', windowsHide: true });
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Command failed (${code}): ${args.join(' ')}`)));
    child.once('error', reject);
});
const stamp = Date.now();
const builds = ['a', 'b'].map(name => ({ name, id: `update-test-${stamp}-${name}`, dir: `.update-test/${stamp}/${name}` }));
mkdirSync('.update-test', { recursive: true });
const originalTsconfig = readFileSync('tsconfig.json', 'utf8');
try {
    for (const build of builds) await run(['node_modules/next/dist/bin/next', 'build'], { ...process.env, HEALTHSYNC_DEPLOYMENT_ID: build.id, HEALTHSYNC_BUILD_DIR: build.dir });
} finally {
    // Undo Next's generated output paths only when no concurrent semantic tsconfig edit occurred.
    const current = JSON.parse(readFileSync('tsconfig.json', 'utf8'));
    current.include = current.include?.filter(path => !path.startsWith('.update-test/'));
    if (JSON.stringify(current) === JSON.stringify(JSON.parse(originalTsconfig))) writeFileSync('tsconfig.json', originalTsconfig);
}
writeFileSync('.update-test/builds.json', JSON.stringify(builds));
await run(['node_modules/@playwright/test/cli.js', 'test', '--config=e2e/update-manager.config.ts', '--reporter=line']);
