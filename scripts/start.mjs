import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const frontendDir = path.join(root, "frontend");

const children = [];

function runProcess(name, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    stdio: "inherit",
    shell: false
  });

  child.on("exit", (code) => {
    const exitCode = code ?? 0;
    process.stderr.write(`\n[${name}] exited with code ${exitCode}\n`);
    shutdown(exitCode);
  });

  child.on("error", (error) => {
    process.stderr.write(`\n[${name}] failed to start: ${error.message}\n`);
    shutdown(1);
  });

  children.push(child);
  return child;
}

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

runProcess("backend", "python", ["backend/app.py"], root);
runProcess(
  "frontend",
  "node",
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5173",
    "--strictPort"
  ],
  frontendDir
);

