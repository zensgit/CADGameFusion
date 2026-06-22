#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath handles the Windows drive letter; new URL(import.meta.url).pathname
// yields "/D:/..." which path.resolve(..., "..") mangles to "D:\D:\..." (ENOENT on mkdir).
const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(desktopDir, "dist");

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

console.log(`cleaned_dist=${distDir}`);
