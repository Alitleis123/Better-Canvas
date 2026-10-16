const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { root } = require("./audit-helpers.cjs");

test("all manifest descriptions fit Chrome's limit, use plain text and omit unused permissions", () => {
  for (const file of fs.readdirSync(root).filter((file) => /^manifest.*\.json$/.test(file))) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
    assert.ok(manifest.description.length <= 132, file);
    assert.match(manifest.description, /^[\x20-\x7e]+$/, file);
    assert.equal(manifest.permissions.includes("alarms"), false);
    assert.equal(manifest.permissions.includes("notifications"), false);
  }
});
test("README, release notes, onboarding and About disclose image queries and third-party requests with no telemetry", () => {
  for (const file of ["README.md", "docs/release-3.3.1.txt", "src/content/features/onboarding.js", "src/shared/settings/index.js"]) {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    assert.match(text, /Image searches send your query to api\.openverse\.org/);
    assert.match(text, /Photo themes and previews (?:contact|load images from) third-party/);
    assert.match(text, /[Nn]o telemetry/);
    assert.doesNotMatch(text, /Everything stays on this device|never sends anything to another server/);
  }
});

test("documentation, manifests and UI omit blanket claims of no external requests", () => {
  const files = ["README.md", "docs/release-3.3.1.txt", ...fs.readdirSync(root).filter((name) => /^manifest.*\.json$/.test(name))];
  for (const file of fs.readdirSync(path.join(root, "src"), { recursive: true })) {
    if (/\.(js|html|css)$/.test(file)) files.push(path.join("src", file));
  }
  for (const file of files) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, file), "utf8"),
      /no (?:external )?network requests|no outbound requests|never sends anything to another server|everything stays on this device|100\s*%\s*local|entirely offline/i, file);
  }
});
