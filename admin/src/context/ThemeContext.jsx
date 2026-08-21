import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [glassIntensity, setGlassIntensity] = useState(() => {
    return localStorage.getItem('vip_admin_glass_level') || 'high';
  });

  const [accentColor, setAccentColor] = useState('#e50914');

  useEffect(() => {
    localStorage.setItem('vip_admin_glass_level', glassIntensity);
  }, [glassIntensity]);

  return (
    <ThemeContext.Provider value={{ glassIntensity, setGlassIntensity, accentColor, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
