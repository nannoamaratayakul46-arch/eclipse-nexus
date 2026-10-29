const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("public/index.html", "utf8");
if (/^(<<<<<<<|=======|>>>>>>>)(?: .*|)$/m.test(html)) {
  throw new Error("Unresolved Git conflict marker found in public/index.html.");
}
const match = html.match(/<script>([\s\S]*?)<\/script>/i);
if (!match) throw new Error("No inline dashboard script found.");
new vm.Script(match[1], { filename: "public/index.html:inline-script" });

if (!html.includes("function setNexusView(view)")) {
  throw new Error("Panel-first navigation router is missing.");
}
if (!html.includes('setNexusView(b.dataset.target)')) {
  throw new Error("Navigation buttons are not wired to the panel router.");
}
if (html.includes("#d7e3e8tureControls")) {
  throw new Error("Malformed featureControls CSS selector found.");
}

console.log("NEXUS browser script syntax and conflict regression checks: OK");
