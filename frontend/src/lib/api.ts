import axios from 'axios';
import { getAuth } from 'firebase/auth';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://191.252.100.195:3001',
  timeout: 15000,
  headers: {
    // Resolve tenant quando não há subdomínio (acesso por IP)
    'X-Tenant-Slug': process.env.NEXT_PUBLIC_TENANT_SLUG ?? 'demo',
  },
});

api.interceptors.request.use(async (config) => {
  const auth = getAuth();
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export default api;
