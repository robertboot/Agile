#!/usr/bin/env node
// The monorepo root hoists React 18 for the Expo app; the Next apps use React
// 19. styled-jsx (a dependency of next) gets hoisted to the root, where it
// would resolve React 18 and crash Next's pages prerender with a useContext
// error. Keeping a copy under each app's node_modules makes it resolve React 19.
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const src = path.join(root, "node_modules", "styled-jsx");

for (const app of ["web", "rcm"]) {
  const dest = path.join(root, "apps", app, "node_modules", "styled-jsx");
  if (fs.existsSync(src) && !fs.existsSync(dest)) {
    fs.cpSync(src, dest, { recursive: true });
    console.log(`Copied styled-jsx into apps/${app}/node_modules (React 19 resolution).`);
  }
}
