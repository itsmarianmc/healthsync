import { createSerwistRoute } from '@serwist/turbopack';
import { APP_BUILD_ID } from '../../_lib/build';

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
    swSrc: 'src/app/sw.ts',
    useNativeEsbuild: true,
    esbuildOptions: { define: { 'process.env.NEXT_PUBLIC_HEALTHSYNC_BUILD_ID': JSON.stringify(APP_BUILD_ID) } },
});
