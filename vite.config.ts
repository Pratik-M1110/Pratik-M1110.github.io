import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// import.meta.env.BASE_URL is exactly what is configured, and the host appends paths to it, so it has to
// end in a slash however BASE_PATH is typed (/portfolio, portfolio/, ./ or a full URL).
function normalizeBase(value: string | undefined) {
  if (!value || value === "/") return "/";
  if (value.startsWith(".") || /^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return value.endsWith("/") ? value : `${value}/`;
  const trimmed = value.replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}/` : "/";
}

// BASE_PATH lets the same build be hosted at a sub-path, e.g. BASE_PATH=/portfolio/ npm run build
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    base: normalizeBase(env.BASE_PATH),
    plugins: [react()],
  };
});
