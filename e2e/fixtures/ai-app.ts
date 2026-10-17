import { build } from 'esbuild';
import { resolve } from 'node:path';

// Real application providers, login, shell and sheets; only Next navigation and
// the Supabase transport are replaced. No session cookies or real services.
export async function aiAppFixture() {
  const result = await build({
    stdin: {
      contents: `
        import React from 'react';
        import { createRoot } from 'react-dom/client';
        import { usePathname } from 'next/navigation';
        import { AuthProvider } from './src/app/_context/AuthContext';
        import { AppShellProvider } from './src/app/_context/AppShellContext';
        import AppShell from './src/app/_components/AppShell';
        import Login from './src/app/login/page';
        import Dashboard from './src/app/dash/page';
        import Food from './src/app/food/page';
        import './src/app/styles.css';
        function App() {
          const path = usePathname();
          return <AuthProvider><AppShellProvider><AppShell>
            {path === '/login' ? <Login/> : path === '/food' ? <Food/> : <Dashboard/>}
          </AppShell></AppShellProvider></AuthProvider>;
        }
        createRoot(document.getElementById('root')).render(<App/>);
      `,
      resolveDir: resolve('.'), loader: 'tsx',
    },
    bundle: true, write: false, outfile: 'fixture.js', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"test"' },
    plugins: [{
      name: 'isolated-app-transports',
      setup(plugin) {
        plugin.onResolve({ filter: /^next\/(navigation|link)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
        plugin.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path: 'supabase', namespace: 'fixture' }));
        plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ resolveDir: resolve('.'), loader: 'jsx', contents: args.path === 'next/link' ? `
          import React from 'react';
          import { useRouter } from 'next/navigation';
          export default function Link({href, children, ...props}) {
            const router = useRouter();
            return <a {...props} href={href} onClick={event => { event.preventDefault(); router.push(href); }}>{children}</a>;
          }
        ` : args.path === 'next/navigation' ? `
          import { useMemo, useSyncExternalStore } from 'react';
          const listeners = new Set();
          window.addEventListener('popstate', () => listeners.forEach(callback => callback()));
          const subscribe = callback => { listeners.add(callback); return () => listeners.delete(callback); };
          const navigate = path => { history.pushState({}, '', path); listeners.forEach(callback => callback()); };
          const router = { push: navigate, replace: navigate, refresh: () => {} };
          export const useRouter = () => router;
          export const usePathname = () => useSyncExternalStore(subscribe, () => location.pathname);
          export const useSearchParams = () => {
            const search = useSyncExternalStore(subscribe, () => location.search);
            return useMemo(() => new URLSearchParams(search), [search]);
          };
        ` : `
          let session = JSON.parse(sessionStorage.getItem('fixture-session') || 'null');
          const listeners = new Set();
          const settings = () => ({ user_id: session?.user.id, calorie_goal: 2000, protein_goal: 100, carbs_goal: 100, fat_goal: 50, goal_ml: 2500, workout_routines: null, data_reset_at: sessionStorage.getItem('fixture-reset') });
          function query(table) {
            const result = () => ({ data: table === 'user_settings' ? [settings()] : [], error: null, count: table === 'user_settings' ? 1 : 0 });
            const chain = {
              select: () => chain, eq: () => chain, order: () => chain, range: () => chain,
              maybeSingle: async () => ({ data: table === 'user_settings' ? settings() : null, error: null }),
              single: async () => ({ data: null, error: null }),
              upsert: async () => ({ error: null }), insert: async () => ({ error: null }),
              then: (yes, no) => Promise.resolve(result()).then(yes, no),
            };
            return chain;
          }
          export const supabase = { from: query, auth: {
            getSession: async () => ({ data: { session } }),
            onAuthStateChange: callback => { listeners.add(callback); return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } }; },
            signInWithPassword: async ({email}) => {
              session = { access_token: 'fixture-token', expires_at: Date.now()/1000 + 3600, user: { id: email.startsWith('B') ? '22222222-2222-4222-8222-222222222222' : '11111111-1111-4111-8111-111111111111', email, user_metadata: {} } };
              sessionStorage.setItem('fixture-session', JSON.stringify(session));
              listeners.forEach(callback => callback('SIGNED_IN', session));
              return { data: session, error: null };
            },
            signOut: async () => { session = null; sessionStorage.removeItem('fixture-session'); listeners.forEach(callback => callback('SIGNED_OUT', null)); return { error: null }; },
            mfa: {
              getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal1' }, error: null }),
              listFactors: async () => ({ data: { all: [] }, error: null }),
            },
          } };
        ` }));
      },
    }],
  });
  return {
    html: '<!doctype html><html><head><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>',
    js: result.outputFiles.find(file => file.path.endsWith('.js'))!.text,
    css: result.outputFiles.find(file => file.path.endsWith('.css'))!.text,
  };
}

