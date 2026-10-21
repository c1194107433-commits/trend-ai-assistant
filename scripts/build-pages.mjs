import { cp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Build a separate static demo, leaving the full app and its API intact.
const root = fileURLToPath(new URL("../", import.meta.url));
const stage = path.join(root, ".pages-build");
const basePath = "/trend-ai-assistant";
await rm(stage, { recursive: true, force: true });
await mkdir(stage);
for (const file of ["app", "lib", "public", "package.json", "tsconfig.json", "next-env.d.ts"]) {
  await cp(path.join(root, file), path.join(stage, file), { recursive: true });
}
await rm(path.join(stage, "app/api"), { recursive: true, force: true });
await symlink(path.join(root, "node_modules"), path.join(stage, "node_modules"), "dir");
await writeFile(path.join(stage, "next.config.mjs"), `export default ${JSON.stringify({ output: "export", basePath, trailingSlash: true, images: { unoptimized: true } })};\n`);
const result = spawnSync(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "build", "--webpack"], {
  cwd: stage,
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_DEMO_ONLY: "true", NEXT_PUBLIC_BASE_PATH: basePath },
});
if (result.status !== 0) process.exit(result.status ?? 1);
await writeFile(path.join(stage, "out/.nojekyll"), "");
console.log(`GitHub Pages demo ready: ${stage}/out`);
