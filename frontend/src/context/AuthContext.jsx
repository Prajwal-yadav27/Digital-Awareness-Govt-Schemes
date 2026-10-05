import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authService from '../services/authService';
import * as bookmarkService from '../services/bookmarkService';
import { clearAuth } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const TOKEN_THRESHOLD_MS = 29 * 24 * 60 * 60 * 1000;

const persistAuth = (token, user) => {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    bookmarks: [],
    createdAt: user.createdAt || null,
    formattedCreatedAt: user.formattedCreatedAt || null,
    phone: user.phone || null,
    phoneVerified: user.phoneVerified || false,
    notificationPreferences: user.notificationPreferences || { inApp: true, email: true, sms: false },
    isOrganizerVerified: user.isOrganizerVerified || false
  }));
  localStorage.setItem('authTimestamp', Date.now().toString());
};

const extractSchemeId = (entry) => {
  if (!entry) return null;
  if (typeof entry === 'object') {
    if (entry.scheme && typeof entry.scheme === 'object' && entry.scheme._id) {
      return String(entry.scheme._id);
    }
    if (entry.scheme) {
      return String(entry.scheme);
    }
    if (entry._id) {
      return String(entry._id);
    }
  }
  return String(entry);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookmarks, setBookmarks] = useState([]);

  const syncBookmarks = useCallback((rawBookmarks) => {
    const normalized = Array.isArray(rawBookmarks) ? rawBookmarks.filter(Boolean) : [];
    setBookmarks(normalized);
    setUser((currentUser) => {
      if (!currentUser) return currentUser;
      const schemeIds = normalized.map(extractSchemeId).filter(Boolean);
      const updatedUser = { ...currentUser, bookmarks: schemeIds };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      return updatedUser;
    });
    return normalized;
  }, []);

 const refreshBookmarks = useCallback(async () => {
  if (!token) return [];

  try {
    const data = await bookmarkService.getBookmarks();

    return syncBookmarks(data);
  } catch (err) {
    syncBookmarks([]);
    return [];
  }
}, [token, syncBookmarks]);

  const handleAuthExpired = useCallback((event) => {
    const message = event.detail?.message || 'Your session has expired. Please login again.';
    clearAuth();
    setToken(null);
    setUser(null);
    setBookmarks([]);
    window.dispatchEvent(new CustomEvent('toast:show', {
      detail: { message, type: 'warning' }
    }));
    if (window.location.pathname !== '/login') {
      window.location.href = '/login?expired=1';
    }
  }, []);

  useEffect(() => {
    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, [handleAuthExpired]);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    const savedTimestamp = localStorage.getItem('authTimestamp');

    if (savedToken && savedUser) {
      const age = savedTimestamp ? Date.now() - parseInt(savedTimestamp, 10) : 0;
      if (age > TOKEN_THRESHOLD_MS) {
        clearAuth();
      } else {
        try {
          const parsedUser = JSON.parse(savedUser);
          setToken(savedToken);
          setUser({
            ...parsedUser,
            phone: parsedUser.phone || null,
            phoneVerified: parsedUser.phoneVerified || false,
            notificationPreferences: parsedUser.notificationPreferences || { inApp: true, email: true, sms: false },
            isOrganizerVerified: parsedUser.isOrganizerVerified || false
          });
          setBookmarks([]);
        } catch (err) {
          clearAuth();
        }
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (token) {
      refreshBookmarks().catch(() => {});
    }
  }, [token, refreshBookmarks]);

  const register = async (userData) => {
    const data = await authService.register(userData);
    persistAuth(data.token, data);
    setToken(data.token);
    setUser({
      _id: data._id,
      name: data.name,
      email: data.email,
      role: data.role,
      bookmarks: [],
      createdAt: data.createdAt || null,
      formattedCreatedAt: data.formattedCreatedAt || null,
      phone: data.phone || null,
      phoneVerified: data.phoneVerified || false,
      notificationPreferences: data.notificationPreferences || { inApp: true, email: true, sms: false },
      isOrganizerVerified: data.isOrganizerVerified || false
    });
    setBookmarks([]);
    return data;
  };

  const login = async (credentials) => {
    const data = await authService.login(credentials);
    persistAuth(data.token, data);
    setToken(data.token);
    setUser({
      _id: data._id,
      name: data.name,
      email: data.email,
      role: data.role,
      bookmarks: [],
      createdAt: data.createdAt || null,
      formattedCreatedAt: data.formattedCreatedAt || null,
      phone: data.phone || null,
      phoneVerified: data.phoneVerified || false,
      notificationPreferences: data.notificationPreferences || { inApp: true, email: true, sms: false },
      isOrganizerVerified: data.isOrganizerVerified || false
    });
    setBookmarks([]);
    return data;
  };

  // Re-fetch the authenticated profile and sync React state + localStorage.
  // Used after phone verify/update/delete so Profile.jsx never shows stale data.
  const refreshUser = useCallback(async () => {
    if (!token) return null;
    try {
      const data = await authService.getMyProfile();
      if (!data) return null;
      let updated = null;
      setUser((currentUser) => {
        const base = currentUser || {};
        updated = {
          ...base,
          _id: data._id || base._id,
          name: data.name ?? base.name,
          email: data.email ?? base.email,
          role: data.role ?? base.role,
          bookmarks: base.bookmarks || [],
          createdAt: data.createdAt || base.createdAt || null,
          formattedCreatedAt: data.formattedCreatedAt || base.formattedCreatedAt || null,
          phone: data.phone || null,
          phoneVerified: data.phoneVerified || false,
          notificationPreferences: data.notificationPreferences || base.notificationPreferences || { inApp: true, email: true, sms: false },
          isOrganizerVerified: data.isOrganizerVerified || false
        };
        try {
          const stored = JSON.parse(localStorage.getItem('user') || '{}');
          localStorage.setItem('user', JSON.stringify({ ...stored, ...updated }));
        } catch (_) {}
        return updated;
      });
      return updated;
    } catch (_) {
      return null;
    }
  }, [token]);

  const completeOAuthLogin = async (token, user) => {
    persistAuth(token, user);
    setToken(token);
    setUser({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      bookmarks: user.bookmarks || [],
      createdAt: user.createdAt || null,
      formattedCreatedAt: user.formattedCreatedAt || null,
      phone: user.phone || null,
      phoneVerified: user.phoneVerified || false,
      notificationPreferences: user.notificationPreferences || { inApp: true, email: true, sms: false },
      isOrganizerVerified: user.isOrganizerVerified || false
    });
  };

  const logout = () => {
    clearAuth();
    setToken(null);
    setUser(null);
    setBookmarks([]);
  };

  const addBookmarkAction = async (schemeId) => {
    if (!token) throw new Error('Please login to bookmark schemes');
    if (!schemeId || String(schemeId).trim() === '') throw new Error('Invalid scheme ID');
    await bookmarkService.addBookmark(schemeId);
    await refreshBookmarks();
    return { bookmarked: true };
  };

 const removeBookmarkAction = async (schemeId) => {
  if (!token) {
    throw new Error('Please login to update bookmarks');
  }

  if (!schemeId || String(schemeId).trim() === '') {
    throw new Error('Invalid scheme ID');
  }

  const targetId = String(schemeId).trim();

  const found = bookmarks.find(
    (entry) => extractSchemeId(entry) === targetId
  );

  if (!found) {
    throw new Error('Bookmark not found');
  }

  await bookmarkService.deleteBookmark(targetId);

  await refreshBookmarks();

  return { bookmarked: false };
};
  const toggleBookmark = async (schemeId) => {
    if (!token) {
      throw new Error('Please login to bookmark schemes');
    }
    if (!schemeId || String(schemeId).trim() === '') {
      throw new Error('Invalid scheme ID');
    }
    const currentlyBookmarked = isBookmarked(schemeId);
    if (currentlyBookmarked) {
      const removed = await removeBookmarkAction(schemeId);
      return { ...removed, bookmarked: false };
    }
    const added = await addBookmarkAction(schemeId);
    return { ...added, bookmarked: true };
  };

  const isBookmarked = (schemeId) => {
    if (!schemeId) return false;
    const targetId = String(schemeId).trim();
    if (!targetId) return false;
    return bookmarks.some((entry) => extractSchemeId(entry) === targetId);
  };

  const isAdmin = () => user?.role === 'admin';
  const isOrganizer = () => user?.role === 'organizer';
  const isAuthenticated = () => !!user && !!token;

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      bookmarks,
      register,
      login,
      logout,
      toggleBookmark,
      addBookmarkAction,
      removeBookmarkAction,
      isBookmarked,
      refreshBookmarks,
      refreshUser,
      isAdmin,
      isOrganizer,
      isAuthenticated,
      completeOAuthLogin
    }}>
      {children}
    </AuthContext.Provider>
  );
};
