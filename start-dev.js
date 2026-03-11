// Wrapper to start both the React Router dev server and Socket.io server
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const appServer = spawn(
  process.execPath,
  [join(__dirname, "node_modules/@react-router/dev/bin.js"), "dev", "--host"],
  { cwd: __dirname, stdio: "inherit", env: { ...process.env } }
);

const tsxCli = join(__dirname, "node_modules/tsx/dist/cli.mjs");
const socketServer = spawn(
  process.execPath,
  [tsxCli, "watch", "server/index.ts"],
  { cwd: __dirname, stdio: "inherit", env: { ...process.env, HOST: "0.0.0.0", PORT: "3001" } }
);

for (const child of [appServer, socketServer]) {
  child.on("error", (err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}

process.on("SIGINT", () => {
  appServer.kill();
  socketServer.kill();
  process.exit(0);
});
