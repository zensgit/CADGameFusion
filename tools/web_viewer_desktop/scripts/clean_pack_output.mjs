#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const desktopDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const distDir = path.join(desktopDir, "dist");

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

console.log(`cleaned_dist=${distDir}`);
