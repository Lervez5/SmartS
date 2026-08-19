import fs from "fs";
import path from "path";

const SECRET_PATTERNS = [
  { pattern: /(?:jwt|token|secret|password|api_key|apikey|access_key|auth_token)\s*[:=]\s*['"][^'"]{8,}['"]/gi, label: "generic-secret" },
  { pattern: /(?:mongodb|postgres|mysql|redis):\/\/[^\s]+/gi, label: "database-url" },
  { pattern: /(?:sk|pk|AKIA|ASIA)[A-Z0-9]{16,}/gi, label: "cloud-key" },
  { pattern: /(?:xox[baprs]-|glpat-|ghp-|github_pat_)[A-Za-z0-9_-]{20,}/gi, label: "integration-token" },
];

const ALLOWED_FILES = [".env.example", "package.json", "pnpm-lock.yaml", "package-lock.json"];
const ALLOWED_EXTENSIONS = [".md", ".txt", ".lock"];
const IGNORED_DIRS = ["node_modules", ".git", "__pycache__", ".venv", "venv", "dist", "build", ".next", "out", "coverage"];
const IGNORED_FILES = [".env", ".env.local", ".env.development", ".env.production"];

function isAllowed(filePath) {
  const basename = path.basename(filePath);
  if (ALLOWED_FILES.includes(basename)) return true;
  if (IGNORED_FILES.includes(basename)) return true;
  const ext = path.extname(filePath);
  if (ALLOWED_EXTENSIONS.includes(ext)) return true;
  return false;
}

function isIgnoredDir(dirPath) {
  const basename = path.basename(dirPath);
  if (IGNORED_DIRS.includes(basename)) return true;
  return false;
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const findings = [];
  for (const { pattern, label } of SECRET_PATTERNS) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      findings.push({ file: filePath, label, match: match[0].slice(0, 60) + "..." });
    }
  }
  return findings;
}

function walk(dir) {
  let results = [];
  let items;
  try {
    items = fs.readdirSync(dir);
  } catch {
    return results;
  }
  for (const item of items) {
    const full = path.join(dir, item);
    let stat;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      if (isIgnoredDir(full)) continue;
      results = results.concat(walk(full));
    } else {
      if (isAllowed(full)) continue;
      try {
        results = results.concat(scanFile(full));
      } catch {
        continue;
      }
    }
  }
  return results;
}

const findings = walk(".");
if (findings.length > 0) {
  console.error(`Found ${findings.length} potential secret(s):`);
  for (const f of findings) {
    console.error(`  ${f.file}: ${f.label} -> ${f.match}`);
  }
  process.exit(1);
} else {
  console.log("No obvious secrets detected.");
}
