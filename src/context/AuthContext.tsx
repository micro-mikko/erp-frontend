import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '../api/client';
import type { User } from '../api/types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, companyName: string) => Promise<void>;
  logout: () => void;
  switchCompany: (companyId: string) => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem('token');
    const done = () => setLoading(false);
    if (t) {
      setToken(t);
      const timeout = setTimeout(done, 8000);
      api.get<{ user: User }>('/auth/me')
        .then(d => setUser(d.user))
        .catch(() => { localStorage.removeItem('token'); setToken(null); })
        .finally(() => { clearTimeout(timeout); done(); });
    } else {
      done();
    }
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const register = async (name: string, email: string, password: string, companyName: string) => {
    const data = await api.post<{ token: string; user: User }>('/auth/register', {
      name, email, password, companyName,
    });
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const switchCompany = async (companyId: string) => {
    const data = await api.post<{ token: string }>('/auth/switch-company', { companyId });
    localStorage.setItem('token', data.token);
    setToken(data.token);
    const me = await api.get<{ user: User }>('/auth/me');
    setUser(me.user);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, switchCompany, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
