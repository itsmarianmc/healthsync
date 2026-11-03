import http from 'node:http';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const builds = JSON.parse(readFileSync('.update-test/builds.json', 'utf8'));
let selected = 0;
const children = builds.map((build, i) => spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(3211 + i), '-H', '127.0.0.1'], {
    env: { ...process.env, HEALTHSYNC_DEPLOYMENT_ID: build.id, HEALTHSYNC_BUILD_DIR: build.dir }, stdio: 'inherit', windowsHide: true,
}));
const server = http.createServer((request, response) => {
    if (request.url === '/__update_test/a' || request.url === '/__update_test/b') {
        selected = request.url.endsWith('/a') ? 0 : 1;
        response.end('ok'); return;
    }
    const upstream = http.request({ hostname: '127.0.0.1', port: 3211 + selected, path: request.url, method: request.method, headers: { ...request.headers, host: '127.0.0.1:3210' } }, result => {
        response.writeHead(result.statusCode, result.headers); result.pipe(response);
    });
    upstream.on('error', () => { response.writeHead(503); response.end('Starting'); });
    request.pipe(upstream);
});
server.listen(3210, '127.0.0.1');
function stop() { server.close(); for (const child of children) child.kill(); }
process.on('SIGTERM', () => { stop(); process.exit(); });
process.on('SIGINT', () => { stop(); process.exit(); });
process.on('exit', stop);
