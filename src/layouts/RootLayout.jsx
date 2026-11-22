import { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { Outlet, useLocation, useMatches, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { sdk } from '@/services/sdk';
import { setUser, clearUser, setInitialized } from '@/store/userSlice';
import { verifyRouteAccess } from '@/router/route.utils';
import { APP_CONFIG, GENERIC_AUTH } from '@/config/app.config';
import AppLoader from '@/components/AppLoader';
import { ErrorBoundary } from '@/components/ui/error-boundary';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within RootLayout');
  return ctx;
}

const AUTH_PAGE_PATTERN = /^\/(login|forgot-password)/;

export default function RootLayout() {
  const dispatch = useDispatch();
  const { user, isAuthenticated, isInitialized } = useSelector((state) => state.user);
  const location = useLocation();
  const navigate = useNavigate();
  const matches = useMatches();

  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const hasInitRef = useRef(false);

  useEffect(() => {
    if (hasInitRef.current) return;
    hasInitRef.current = true;

    let isMounted = true;
    sdk.session
      .init()
      .then((currentUser) => {
        if (!isMounted) return;
        if (currentUser) dispatch(setUser(currentUser));
        else dispatch(setInitialized());
      })
      .catch(() => isMounted && dispatch(setInitialized()));

    const unsub = sdk.session.subscribe((state) => {
      if (state.status === 'authenticated' && state.user) dispatch(setUser(state.user));
      else dispatch(clearUser());
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, [dispatch]);

  // A signed-in user who lands on the sign-in page goes to the app.
  useEffect(() => {
    if (user && AUTH_PAGE_PATTERN.test(location.pathname)) {
      const redirectPath = new URLSearchParams(location.search).get('redirect');
      navigateRef.current(redirectPath || GENERIC_AUTH?.redirectAfterAuth || '/', { replace: true });
    }
  }, [user, location.pathname, location.search]);

  const deepestMatch = matches[matches.length - 1];
  const accessRule = deepestMatch?.handle?.access ?? 'public';
  // Decided during render, not after it: a route this session may not open never paints.
  const allowed = isInitialized && verifyRouteAccess(accessRule, user);

  useEffect(() => {
    if (!isInitialized) return;
    if (!allowed) {
      const loginRoute = APP_CONFIG.defaultLoginRoute ?? '/login';
      if (user) {
        navigateRef.current('/access-denied', { replace: true });
      } else {
        const currentPath = location.pathname + location.search;
        navigateRef.current(`${loginRoute}?redirect=${encodeURIComponent(currentPath)}`, { replace: true });
      }
    }
  }, [location.pathname, isInitialized, allowed, user]);

  const handleLogout = useCallback(async () => {
    await sdk.session.logout();
    dispatch(clearUser());
    navigateRef.current(APP_CONFIG.defaultLoginRoute ?? '/login', { replace: true });
  }, [dispatch]);

  // Loader while the session resolves AND while a denied route redirects — the shell, the page
  // and its data fetches never mount for a visitor who may not see them.
  if (!isInitialized || !allowed) return <AppLoader fullScreen />;

  return (
    <AuthContext.Provider value={{ logout: handleLogout, user, isAuthenticated }}>
      <ErrorBoundary fullPage>
        <Outlet />
      </ErrorBoundary>
    </AuthContext.Provider>
  );
}
