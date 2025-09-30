import * as log from '../lib/log/logger';

export const projectsAPI = {
  list: async () => {
    try {
      const fn = window?.tm?.projects?.list;
      if (typeof fn !== "function") return [];   // <- safe fallback
      const res = await fn();
      return Array.isArray(res) ? res : [];
    } catch (e) {
      console.warn("projects.list failed:", e);
      log.warn("projects.list failed:", e);
      return [];
    }
  },
  ensure: async (name) => {
    try {
      const fn = window?.tm?.projects?.ensure;
      if (typeof fn !== "function") return null; // <- safe fallback
      const n = String(name || "").trim();
      if (!n) return null;
      const id = await fn(n);
      return Number.isFinite(Number(id)) ? Number(id) : null;
    } catch (e) {
      console.warn("projects.ensure failed:", e);
      log.error("projects.ensure failed:", e);
      return null;
    }
  },
};
