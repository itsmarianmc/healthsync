import { withSerwist } from "@serwist/turbopack";
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Production instances must share one immutable deployment ID; local builds use a source fingerprint.
const fingerprint = createHash('sha256');
function hashDirectory(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) hashDirectory(path);
    else { fingerprint.update(path); fingerprint.update(readFileSync(path)); }
  }
}
hashDirectory('src');
hashDirectory('public');
fingerprint.update(readFileSync('package-lock.json'));
fingerprint.update(readFileSync('next.config.ts'));
const deploymentId = process.env.HEALTHSYNC_DEPLOYMENT_ID || process.env.VERCEL_DEPLOYMENT_ID || process.env.NEXT_DEPLOYMENT_ID || fingerprint.digest('hex').slice(0, 24);

const nextConfig = withSerwist({
  distDir: process.env.HEALTHSYNC_BUILD_DIR || '.next',
  deploymentId,
  env: { NEXT_PUBLIC_HEALTHSYNC_BUILD_ID: deploymentId },
  async headers() {
    return [{ source: '/serwist/:path*', headers: [
      { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
      { key: 'Service-Worker-Allowed', value: '/' },
    ] }];
  },
  turbopack: {
    root: __dirname,
  },
});

export default nextConfig;
