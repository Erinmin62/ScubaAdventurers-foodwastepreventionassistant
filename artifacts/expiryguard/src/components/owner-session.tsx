import { useEffect, useState, type ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp, useAuth } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation } from 'wouter';
import { guardianSrc } from './bits';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const stripBase = (path: string) => basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;

function PrivateCache({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  useEffect(() => () => { void client.cancelQueries(); client.clear(); }, [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function AuthRoutes({ children }: { children: ReactNode }) {
  const { isLoaded, userId, sessionId } = useAuth();
  if (!isLoaded) return <div className="p-8" role="status">Checking your sign-in…</div>;
  if (userId) return <PrivateCache key={`${userId}:${sessionId}`}>{children}</PrivateCache>;
  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center gap-5 p-6 bg-background">
      <img src={guardianSrc} alt="Yuzu, the pantry guardian" className="w-28" />
      <h1 className="text-3xl font-bold">ExpiryGuardAI</h1>
      <p className="text-center text-muted-foreground max-w-md">Your business records, decisions and alerts belong to you. Sign in to open your private workspace, starting with clearly labelled synthetic sample data.</p>
      <Switch>
        <Route path="/sign-in/*?">
          <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
        </Route>
        <Route path="/sign-up/*?">
          <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
        </Route>
        <Route>
          <div className="flex gap-4">
            <Link className="rounded-xl bg-primary text-primary-foreground px-5 py-3 font-semibold" href={`/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`}>Owner sign in</Link>
            <Link className="rounded-xl border px-5 py-3 font-semibold" href="/sign-up">Create account</Link>
          </div>
        </Route>
      </Switch>
      <p className="text-xs text-muted-foreground text-center">Nothing is approved or ordered automatically. Real messaging remains separate from sample notification previews.</p>
    </main>
  );
}

export function OwnerSession({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      signInFallbackRedirectUrl={basePath || '/'}
      signUpFallbackRedirectUrl={basePath || '/'}
      routerPush={to => setLocation(stripBase(to))}
      routerReplace={to => setLocation(stripBase(to), { replace: true })}
      appearance={{
        options: { logoImageUrl: `${window.location.origin}${basePath}/logo.svg`, logoLinkUrl: basePath || '/' },
        variables: { colorPrimary: '#2d7057', colorForeground: '#263b32', colorBackground: '#fffdf8', fontFamily: 'Figtree, sans-serif', borderRadius: '0.75rem' },
        elements: { cardBox: { width: '440px', maxWidth: '100%', background: '#fffdf8' } },
      }}
    >
      <AuthRoutes>{children}</AuthRoutes>
    </ClerkProvider>
  );
}
