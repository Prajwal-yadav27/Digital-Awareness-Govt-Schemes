import { useEffect, useRef, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Loader from './components/Loader';
const Landing = lazy(() => import('./pages/Landing'));
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Register = lazy(() => import('./pages/Register'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const SchemeDetails = lazy(() => import('./pages/SchemeDetails'));
const Bookmarks = lazy(() => import('./pages/Bookmarks'));
const Profile = lazy(() => import('./pages/Profile'));
const About = lazy(() => import('./pages/About'));
const Users = lazy(() => import('./pages/Users'));
const Events = lazy(() => import('./pages/Events'));
const EventDetails = lazy(() => import('./pages/EventDetails'));
const MyRegistrations = lazy(() => import('./pages/MyRegistrations'));
const RegistrationDetails = lazy(() => import('./pages/RegistrationDetails'));
const OrganizerDashboard = lazy(() => import('./pages/OrganizerDashboard'));
const EventRegistrations = lazy(() => import('./pages/EventRegistrations'));
const Ticket = lazy(() => import('./pages/Ticket'));
const TicketVerification = lazy(() => import('./pages/TicketVerification'));
const Notifications = lazy(() => import('./pages/Notifications'));

const RedirectWithToast = ({ to, message, type, state }) => {
  const { addToast } = useToast();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    if (message) addToast(message, type);
  }, [addToast, message, type]);

  return <Navigate to={to} replace state={state} />;
};

const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="page-wrapper">
        <Loader message="Loading..." />
      </div>
    );
  }

  if (!user) {
    return (
      <RedirectWithToast
        to={requireAdmin ? "/admin/login" : "/login"}
        message={requireAdmin ? "Please login as admin to access this page" : "Please login to access this page"}
        type="warning"
        state={{ from: location }}
      />
    );
  }

  if (requireAdmin && !isAdmin()) {
    return (
      <RedirectWithToast
        to="/"
        message="Admin access required"
        type="error"
      />
    );
  }

  return children;
};

const OrganizerRoute = ({ children }) => {
  const { user, loading, isOrganizer, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="page-wrapper">
        <Loader message="Loading..." />
      </div>
    );
  }

  if (!user) {
    return (
      <RedirectWithToast
        to="/login"
        message="Please login to access this page"
        type="warning"
        state={{ from: location }}
      />
    );
  }

  if (!isOrganizer() && !isAdmin()) {
    return (
      <RedirectWithToast
        to="/"
        message="Organizer access required"
        type="error"
      />
    );
  }

  return children;
};

const PublicOnlyRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  if (loading) {
    return (
      <div className="page-wrapper">
        <Loader message="Loading..." />
      </div>
    );
  }

  if (user) {
    return <Navigate to={from} replace />;
  }

  return children;
};

const AppRoutes = () => {
  return (
    <Router>
      <div className="app-shell">
        <div className="grid-pattern" aria-hidden="true" />
        <div className="orb orb-1" aria-hidden="true" />
        <div className="orb orb-2" aria-hidden="true" />
        <div className="orb orb-3" aria-hidden="true" />
        <Navbar />
        <main className="app-main">
          <Suspense fallback={<div className="page-wrapper"><Loader message="Loading..." /></div>}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/schemes" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:id" element={<EventDetails />} />
            <Route path="/schemes/:id" element={<SchemeDetails />} />
            <Route
              path="/bookmarks"
              element={
                <ProtectedRoute>
                  <Bookmarks />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  <Login />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/admin/login"
              element={
                <PublicOnlyRoute>
                  <AdminLogin />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicOnlyRoute>
                  <Register />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/forgot-password"
              element={
                <PublicOnlyRoute>
                  <ForgotPassword />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/reset-password/:token"
              element={
                <PublicOnlyRoute>
                  <ResetPassword />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/users" element={
              <ProtectedRoute requireAdmin={true}>
                <Users />
              </ProtectedRoute>
            }/>
            <Route
              path="/my-registrations"
              element={
                <ProtectedRoute>
                  <MyRegistrations />
                </ProtectedRoute>
              }
            />
            <Route
              path="/registrations/:id"
              element={
                <ProtectedRoute>
                  <RegistrationDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/registrations/:id/ticket"
              element={
                <ProtectedRoute>
                  <Ticket />
                </ProtectedRoute>
              }
            />
            <Route
              path="/organizer"
              element={
                <OrganizerRoute>
                  <OrganizerDashboard />
                </OrganizerRoute>
              }
            />
            <Route
              path="/organizer/events/:eventId/registrations"
              element={
                <OrganizerRoute>
                  <EventRegistrations />
                </OrganizerRoute>
              }
            />
            <Route
              path="/organizer/ticket-verification"
              element={
                <OrganizerRoute>
                  <TicketVerification />
                </OrganizerRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </main>
        <Footer />
      </div>
    </Router>
  );
};

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
