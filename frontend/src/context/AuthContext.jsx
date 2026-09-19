import React, { createContext, useContext, useEffect, useState } from "react";
import { auth as authApi, formatApiErrorDetail } from "@/lib/apiClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, false = logged out, obj = user
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    authApi
      .me()
      .then((r) => setUser(r.data.user))
      .catch(() => setUser(false))
      .finally(() => setChecking(false));
  }, []);

  const login = async (email, password) => {
    try {
      const { data } = await authApi.login(email, password);
      setUser(data.user);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: formatApiErrorDetail(e.response?.data?.detail) || e.message };
    }
  };

  const register = async (payload) => {
    try {
      const { data } = await authApi.register(payload);
      setUser(data.user);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: formatApiErrorDetail(e.response?.data?.detail) || e.message };
    }
  };

  const logout = async () => {
    try { await authApi.logout(); } catch (e) {}
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, checking, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
