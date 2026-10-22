import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Redirect, Route, Router, Switch } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { Shell } from '../src/components/shell';
import BusinessProfilePage from '../src/pages/business-profile';
import '../src/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

function BrowserTestApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <Shell>
          <Switch>
            <Route path="/business-profile" component={BusinessProfilePage} />
            <Route path="/menu">
              <h1>Menu workspace</h1>
            </Route>
            <Route>
              <Redirect to="/business-profile" />
            </Route>
          </Switch>
        </Shell>
      </Router>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById('root')!).render(<BrowserTestApp />);
