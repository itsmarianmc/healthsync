import { withSerwist } from "@serwist/turbopack";

const nextConfig = withSerwist({
  turbopack: {
    root: __dirname,
  },
});

export default nextConfig;
