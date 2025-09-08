import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoadingSpinner from './components/LoadingSpinner';
import OfflineIndicator from './components/OfflineIndicator';
import ProtectedRoute from './components/ProtectedRoute';
import LoginForm from './components/LoginForm';
import Dashboard from './components/Dashboard';
import AttendanceManager from './components/AttendanceManager';
import ForemanMobileInterface from './components/ForemanMobileInterface';
import SiteInchargeApprovalInterface from './components/SiteInchargeApprovalInterface';
import AdminDashboard from './components/AdminDashboard';
import UserManagement from './components/UserManagement';
import SiteManagement from './components/SiteManagement';
import NotificationsPage from './components/NotificationsPage';
import AuditLog from './components/AuditLog';
import AuditReports from './components/AuditReports';
import AuditSchedule from './components/AuditSchedule';
import AuditAnalytics from './components/AuditAnalytics';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  // Initialize PWA on app start
  useEffect(() => {
    // Initialize PWA manager when app starts
    console.log('🚀 Initializing PWA Manager...');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className="App">
            {/* PWA Offline Indicator */}
            <OfflineIndicator />
            
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                <Route path="/login" element={<LoginForm />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Dashboard />} />
                  <Route path="attendance" element={<AttendanceManager />} />
                  <Route 
                    path="mobile-attendance" 
                    element={
                      <ProtectedRoute requiredRole="FOREMAN">
                        <ForemanMobileInterface />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="approvals" 
                    element={
                      <ProtectedRoute requiredRole="SITE_INCHARGE">
                        <SiteInchargeApprovalInterface />
                      </ProtectedRoute>
                    } 
                  />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route
                    path="audit"
                    element={
                      <ProtectedRoute requiredRole="ADMIN">
                        <AuditLog />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="reports"
                    element={
                      <ProtectedRoute requiredRole="ADMIN">
                        <AuditReports />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="schedules"
                    element={
                      <ProtectedRoute requiredRole="ADMIN">
                        <AuditSchedule />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="analytics"
                    element={
                      <ProtectedRoute requiredRole="ADMIN">
                        <AuditAnalytics />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="admin-dashboard"
                    element={
                      <ProtectedRoute requiredRole="ADMIN">
                        <AdminDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="user-management"
                    element={
                      <ProtectedRoute requiredRole="ADMIN">
                        <UserManagement />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="site-management"
                    element={
                      <ProtectedRoute requiredRole="ADMIN">
                        <SiteManagement />
                      </ProtectedRoute>
                    }
                  />
                  {/* Additional protected routes will be added here */}
                </Route>
              </Routes>
            </Suspense>
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;