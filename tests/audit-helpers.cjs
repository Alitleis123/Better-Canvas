const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "..");
const copy = (value) => JSON.parse(JSON.stringify(value));
const settle = () => new Promise((resolve) => setImmediate(resolve));
function load(context, ...files) {
  for (const file of files) vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}
function domContext(html = "", extra = {}) {
  const dom = new JSDOM(html, { url: "http://bc-test.instructure.com/", runScripts: "outside-only", pretendToBeVisual: true });
  Object.assign(dom.window, { structuredClone, ...extra });
  return { dom, context: dom.getInternalVMContext() };
}
// Files the background injects when the settings workspace first opens.
function settingsUIFiles() {
  const source = fs.readFileSync(path.join(root, "src/background/service-worker.js"), "utf8");
  return vm.runInNewContext(/const SETTINGS_UI_JS = (\[[^\]]*\]);/.exec(source)[1]);
}
module.exports = { root, copy, settle, load, domContext, settingsUIFiles };
