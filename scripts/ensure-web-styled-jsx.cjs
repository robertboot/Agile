#!/usr/bin/env node
// The monorepo root hoists React 18 for the Expo app; apps/web uses React 19.
// styled-jsx (a dependency of next) gets hoisted to the root, where it would
// resolve React 18 and crash Next's pages prerender with a useContext error.
// Keeping a copy under apps/web/node_modules makes it resolve React 19.
const fs = require("node:fs");
const path = require("node:path");

const src = path.join(__dirname, "..", "node_modules", "styled-jsx");
const dest = path.join(__dirname, "..", "apps", "web", "node_modules", "styled-jsx");

if (fs.existsSync(src) && !fs.existsSync(dest)) {
  fs.cpSync(src, dest, { recursive: true });
  console.log("Copied styled-jsx into apps/web/node_modules (React 19 resolution).");
}
