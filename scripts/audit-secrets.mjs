import fs from "node:fs";
import path from "node:path";
const ignored = new Set([
  "node_modules",
  ".git",
  ".wrangler",
  "dist",
  "site-dist",
  "output",
]);
const patterns = [
  /gh[pousr]_[A-Za-z0-9]{20,}/,
  /github_pat_[A-Za-z0-9_]{30,}/,
  /sk-proj-[A-Za-z0-9_-]{20,}/,
  /AKIA[A-Z0-9]{16}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
const failures = [];
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scan(p);
      continue;
    }
    if (/^\.env|^\.dev\.vars/.test(entry.name)) failures.push(p);
    if (
      !/\.(ttf|pdf|png|jpg)$/.test(p) &&
      patterns.some((re) => re.test(fs.readFileSync(p, "utf8")))
    )
      failures.push(p);
  }
}
scan(".");
if (failures.length) {
  console.error("Potential secrets in files:", failures);
  process.exit(1);
}
console.log(
  "Source secret signature check passed. This is not a complete secret detector.",
);
