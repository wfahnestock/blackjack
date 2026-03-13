import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  route("settings", "routes/settings.tsx"),
  route("leaderboard", "routes/leaderboard.tsx"),
  route("lobby/:code", "routes/lobby.tsx"),
  route("room/:code", "routes/room.$code.tsx"),
] satisfies RouteConfig;
