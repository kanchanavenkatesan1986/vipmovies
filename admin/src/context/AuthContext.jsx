import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('vip_admin_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [role, setRole] = useState(() => {
    return user?.role || 'Super Admin';
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem('vip_admin_jwt') || null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('vip_admin_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('vip_admin_user');
    }
  }, [user]);

  useEffect(() => {
    if (token) {
      localStorage.setItem('vip_admin_jwt', token);
    } else {
      localStorage.removeItem('vip_admin_jwt');
    }
  }, [token]);

  const login = async (email, password, rememberMe = true) => {
    // Simulated JWT login verification
    if (!email || !password) {
      throw new Error('Please fill in both email and password');
    }

    const mockToken = `jwt_${btoa(email + ':' + Date.now())}`;
    const userData = {
      name: email.split('@')[0].toUpperCase(),
      email: email,
      role: 'Super Admin',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
      loggedInAt: new Date().toISOString()
    };

    setToken(mockToken);
    setUser(userData);
    setRole(userData.role);
    return true;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('vip_admin_jwt');
    localStorage.removeItem('vip_admin_user');
  };

  const switchRole = (newRole) => {
    setRole(newRole);
    if (user) {
      const updated = { ...user, role: newRole };
      setUser(updated);
    }
  };

  // Role Permission Matrix
  const permissions = {
    canEdit: ['Super Admin', 'Editor'].includes(role),
    canDelete: ['Super Admin'].includes(role),
    canAdd: ['Super Admin', 'Editor', 'Uploader'].includes(role),
    canManageSettings: ['Super Admin'].includes(role),
    canManageUsers: ['Super Admin'].includes(role),
    canScanLinks: ['Super Admin', 'Editor'].includes(role),
    canSendNotifications: ['Super Admin', 'Editor'].includes(role)
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      role,
      permissions,
      isAuthenticated: !!token,
      login,
      logout,
      switchRole
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
