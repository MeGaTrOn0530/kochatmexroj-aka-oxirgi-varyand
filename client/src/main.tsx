import { ApiError } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import App from "./App";
import { getLoginUrl } from "./const";
import { ThemeProvider } from "./contexts/ThemeContext";
import "./index.css";

const queryClient = new QueryClient();
const analyticsEndpoint = (import.meta.env.VITE_ANALYTICS_ENDPOINT || "").trim().replace(/\/$/, "");
const analyticsWebsiteId = (import.meta.env.VITE_ANALYTICS_WEBSITE_ID || "").trim();
const publicPaths = new Set(["/", "/login", "/404"]);

const mountAnalyticsIfConfigured = () => {
  if (typeof document === "undefined") return;
  if (!analyticsEndpoint || !analyticsWebsiteId) return;
  if (document.querySelector('script[data-kochat-analytics="umami"]')) return;

  const script = document.createElement("script");
  script.defer = true;
  script.src = `${analyticsEndpoint}/umami`;
  script.setAttribute("data-website-id", analyticsWebsiteId);
  script.setAttribute("data-kochat-analytics", "umami");
  document.body.appendChild(script);
};

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof ApiError)) return;
  if (typeof window === "undefined") return;
  if (error.status !== 401) return;

  const loginPath = getLoginUrl();
  const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";

  if (currentPath === loginPath || publicPaths.has(currentPath)) return;

  window.location.replace(loginPath);
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

mountAnalyticsIfConfigured();

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <ThemeProvider switchable={true} defaultTheme="light">
      <App />
    </ThemeProvider>
  </QueryClientProvider>
);