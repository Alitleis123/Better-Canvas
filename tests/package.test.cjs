const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { root } = require("./audit-helpers.cjs");

// Names from the zip's central directory.
function zipEntries(file) {
  const buf = fs.readFileSync(file);
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(end >= 0, file + " has no end of central directory");
  const count = buf.readUInt16LE(end + 10);
  let at = buf.readUInt32LE(end + 16);
  const names = [];
  for (let i = 0; i < count; i++) {
    assert.equal(buf.readUInt32LE(at), 0x02014b50, file + " central directory entry " + i);
    const nameLen = buf.readUInt16LE(at + 28), extraLen = buf.readUInt16LE(at + 30), commentLen = buf.readUInt16LE(at + 32);
    names.push(buf.toString("utf8", at + 46, at + 46 + nameLen));
    at += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}

function filesUnder(dir, prefix = "") {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? filesUnder(path.join(dir, d.name), prefix + d.name + "/") : [prefix + d.name]);
}

// Only the current version's packages: older zips left in dist won't match the folders.
const dist = path.join(root, "dist");
const version = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8")).version;
const archives = [
  "Better-Canvas-" + version("manifest.json") + "-Chromium.zip",
  "Better-Canvas-" + version("manifest.firefox.json") + "-Firefox.zip",
].filter((f) => fs.existsSync(path.join(dist, f)));

test("built packages use forward-slash paths and match their unpacked folders", { skip: !archives.length && "run build.ps1 first" }, () => {
  for (const archive of archives) {
    const names = zipEntries(path.join(dist, archive));
    assert.deepEqual(names.filter((n) => n.includes("\\")), [], archive);
    const folder = path.join(dist, /-Chromium\.zip$/.test(archive) ? "chrome" : "firefox");
    assert.deepEqual([...names].sort(), filesUnder(folder).sort(), archive);
    assert.ok(names.includes("manifest.json"), archive);
  }
});
