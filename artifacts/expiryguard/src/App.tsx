import { type ReactNode } from 'react';
import { OwnerSession } from '@/components/owner-session';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { Shell } from '@/components/shell';
import Dashboard from '@/pages/dashboard';
import Inventory from '@/pages/inventory';
import Sales from '@/pages/sales';
import Forecast from '@/pages/forecast';
import Recommendations from '@/pages/recommendations';
import Impact from '@/pages/impact';
import Activity from '@/pages/activity';
import Automation from '@/pages/automation';
import Reordering from '@/pages/reordering';
import Notifications from '@/pages/notifications';
import NotificationReview from '@/pages/notification-review';
import Menu from '@/pages/menu';

function Router() {
  return (
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/sign-in/*?"><Redirect to="/" /></Route>
          <Route path="/sign-up/*?"><Redirect to="/" /></Route>
          <Route path="/" component={Dashboard} />
          <Route path="/inventory" component={Inventory} />
          <Route path="/menu" component={Menu} />
          <Route path="/sales" component={Sales} />
          <Route path="/forecast" component={Forecast} />
          <Route path="/recommendations" component={Recommendations} />
          <Route path="/impact" component={Impact} />
          <Route path="/reordering" component={Reordering} />
          <Route path="/automation" component={Automation} />
          <Route path="/notifications" component={Notifications} />
          <Route path="/notification-review" component={NotificationReview} />
          <Route path="/activity" component={Activity} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <OwnerSession>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </OwnerSession>
    </WouterRouter>
  );
}

export default App;
