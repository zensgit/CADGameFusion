const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const {
  extractCadOpenPathsFromCommandLine,
  isCadOpenablePath,
  normalizeCadOpenPath,
} = require("../open_file_handoff");

test("normalizeCadOpenPath resolves plain and file URLs", () => {
  const cwd = "/tmp/vemcad-open";
  assert.equal(normalizeCadOpenPath("sample.dwg", cwd), path.join(cwd, "sample.dwg"));
  assert.equal(normalizeCadOpenPath("file:///tmp/test%20cad/sample.dwg"), "/tmp/test cad/sample.dwg");
  assert.equal(normalizeCadOpenPath("--router-url", cwd), "");
});

test("isCadOpenablePath only accepts supported CAD-like extensions", () => {
  const cwd = "/tmp/vemcad-open";
  assert.equal(isCadOpenablePath("sample.dwg", cwd), true);
  assert.equal(isCadOpenablePath("sample.DXF", cwd), true);
  assert.equal(isCadOpenablePath("manifest.json", cwd), true);
  assert.equal(isCadOpenablePath("notes.txt", cwd), false);
  assert.equal(isCadOpenablePath("--manifest", cwd), false);
});

test("extractCadOpenPathsFromCommandLine ignores known flag values", () => {
  const cwd = "/tmp/vemcad-open";
  assert.deepEqual(
    extractCadOpenPathsFromCommandLine([
      "/Applications/VemCAD.app/Contents/MacOS/VemCAD",
      "--manifest",
      "build/output/manifest.json",
      "--router-url",
      "http://127.0.0.1:9000",
      "samples/cover.dwg",
    ], cwd),
    [path.join(cwd, "samples/cover.dwg")]
  );
});

test("extractCadOpenPathsFromCommandLine keeps multiple CAD file args and de-dupes them", () => {
  const cwd = "/tmp/vemcad-open";
  assert.deepEqual(
    extractCadOpenPathsFromCommandLine([
      "samples/part_a.dwg",
      "--user-data-dir=/tmp/profile",
      "samples/part_a.dwg",
      "samples/part_b.dxf",
    ], cwd),
    [
      path.join(cwd, "samples/part_a.dwg"),
      path.join(cwd, "samples/part_b.dxf"),
    ]
  );
});
