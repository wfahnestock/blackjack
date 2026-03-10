// Wrapper to start the React Router dev server with the correct Node version
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const child = spawn(
  process.execPath,
  [join(__dirname, "node_modules/@react-router/dev/bin.js"), "dev"],
  {
    cwd: __dirname,
    stdio: "inherit",
    env: { ...process.env },
  }
);

child.on("error", (err) => {
  console.error("Failed to start dev server:", err);
  process.exit(1);
});
