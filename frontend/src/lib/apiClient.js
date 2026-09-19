import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

export const auth = {
  login: (email, password) => api.post("/auth/login", { email, password }),
  register: (payload) => api.post("/auth/register", payload),
  logout: () => api.post("/auth/logout"),
  me: () => api.get("/auth/me"),
};

export const tasks = {
  create: (goal, model) => api.post("/tasks", { goal, model, auto_start: true }),
  list: () => api.get("/tasks"),
  get: (id) => api.get(`/tasks/${id}`),
  stop: (id) => api.post(`/tasks/${id}/stop`),
  approve: (id, decision) => api.post(`/tasks/${id}/approve`, { decision }),
  timeline: (id) => api.get(`/tasks/${id}/timeline`),
  fileUrl: (id, name) => `${API}/tasks/${id}/files/${encodeURIComponent(name)}`,
};

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}
