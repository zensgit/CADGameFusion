const test = require("node:test");
const assert = require("node:assert/strict");

const {
  canRegisterMacFileAssociations,
  resolveLaunchServicesRegisterTool,
  resolveMacAppBundlePath,
} = require("../launch_services_registration");

test("resolveMacAppBundlePath returns bundle root for packaged macOS exec path", () => {
  assert.equal(
    resolveMacAppBundlePath("/Applications/VemCAD.app/Contents/MacOS/VemCAD"),
    "/Applications/VemCAD.app"
  );
  assert.equal(
    resolveMacAppBundlePath("/tmp/VemCAD.app/Contents/MacOS/VemCAD Helper"),
    "/tmp/VemCAD.app"
  );
});

test("resolveMacAppBundlePath returns empty for non-bundle paths", () => {
  assert.equal(resolveMacAppBundlePath("/usr/local/bin/node"), "");
  assert.equal(resolveMacAppBundlePath(""), "");
});

test("resolveLaunchServicesRegisterTool only returns existing paths", () => {
  assert.equal(resolveLaunchServicesRegisterTool("/definitely/missing/lsregister"), "");
  assert.ok(resolveLaunchServicesRegisterTool("/bin/sh").endsWith("/bin/sh"));
});

test("canRegisterMacFileAssociations requires bundle path and register tool", () => {
  assert.equal(
    canRegisterMacFileAssociations(
      "/Applications/VemCAD.app/Contents/MacOS/VemCAD",
      "/bin/sh"
    ),
    true
  );
  assert.equal(
    canRegisterMacFileAssociations(
      "/usr/local/bin/node",
      "/bin/sh"
    ),
    false
  );
  assert.equal(
    canRegisterMacFileAssociations(
      "/Applications/VemCAD.app/Contents/MacOS/VemCAD",
      "/definitely/missing/lsregister"
    ),
    false
  );
});
