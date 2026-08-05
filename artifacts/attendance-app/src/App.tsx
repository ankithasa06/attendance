import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter, Redirect, useLocation } from 'wouter';
import { useGetMe } from '@workspace/api-client-react';

import Login from './pages/login';
import Dashboard from './pages/dashboard';
import MarkAttendance from './pages/mark-attendance';
import Employees from './pages/employees';
import EmployeeDetail from './pages/employee-detail';
import Locations from './pages/locations';
import AttendanceRecords from './pages/attendance';
import Layout from './components/layout';
import NotFound from './pages/not-found';
import Leaves from './pages/leaves';
import AdminLeaves from './pages/admin-leaves';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

function ProtectedRoute({ component: Component, adminOnly = false }: { component: any, adminOnly?: boolean }) {
  const { data: user, isLoading, isError } = useGetMe({ query: { retry: false } as any });

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="h-8 w-8 rounded-full border-4 border-primary border-r-transparent animate-spin"></div></div>;
  }

  if (isError || !user) {
    return <Redirect to="/login" />;
  }

  if (adminOnly && user.role !== 'admin') {
    return <Redirect to="/" />;
  }

  return (
    <Layout user={user}>
      <Component />
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      <Route path="/">
        <ProtectedRoute component={Dashboard} />
      </Route>
      
      <Route path="/mark-attendance">
        <ProtectedRoute component={MarkAttendance} />
      </Route>

      <Route path="/leaves">
        <ProtectedRoute component={Leaves} />
      </Route>

      <Route path="/admin-leaves">
        <ProtectedRoute component={AdminLeaves} adminOnly />
      </Route>

      <Route path="/employees">
        <ProtectedRoute component={Employees} adminOnly />
      </Route>

      <Route path="/employees/:id">
        <ProtectedRoute component={EmployeeDetail} adminOnly />
      </Route>

      <Route path="/locations">
        <ProtectedRoute component={Locations} adminOnly />
      </Route>

      <Route path="/attendance">
        <ProtectedRoute component={AttendanceRecords} adminOnly />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
