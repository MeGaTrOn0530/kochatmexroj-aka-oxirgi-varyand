export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export type AppRole = "admin" | "bosh_agranom" | "agranom" | "bugalter" | "bosh_ofes";

export const getLoginUrl = () => "/login";

export const getDashboardPathByRole = (role?: AppRole | string | null) => {
  switch (role) {
    case "admin":
      return "/admin/dashboard";
    case "bosh_agranom":
      return "/bosh-agranom/dashboard";
    case "agranom":
      return "/agranom/dashboard";
    case "bugalter":
      return "/bugalter/dashboard";
    case "bosh_ofes":
      return "/bosh-ofes/dashboard";
    default:
      return "/";
  }
};
