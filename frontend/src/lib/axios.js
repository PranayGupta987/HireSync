import axios from "axios";

let getToken = null;

export const setTokenProvider = (provider) => {
  getToken = provider;
};

function apiBaseUrl() {
  const fromEnv = String(import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");

  if (import.meta.env.DEV) {
    return fromEnv || "http://localhost:3000/api";
  }

  // Deployed builds must not call the developer's machine. That is what
  // produced the localhost CORS errors on Render.
  if (!fromEnv || /localhost|127\.0\.0\.1/i.test(fromEnv)) {
    return "/api";
  }

  return fromEnv;
}

const axiosInstance = axios.create({
  baseURL: apiBaseUrl(),
  withCredentials: true,
});

axiosInstance.interceptors.request.use(async (config) => {
  const token = await getToken?.();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default axiosInstance;
