const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");

const ROOT = path.join(__dirname, "..");
const config = yaml.load(fs.readFileSync(path.join(ROOT, "src/admin/config.yml"), "utf8"));

test("media goes to the uploads folder with relative public paths, via the built-in library", () => {
  assert.equal(config.media_folder, "src/assets/img/uploads");
  assert.equal(config.public_folder, "assets/img/uploads");
  // Decap 3.17 rejects a media_library block without a registered external library.
  assert.equal(config.media_library, undefined);
  assert.equal(config.publish_mode, "editorial_workflow");
});

test("every CMS file exists and its fields match the JSON exactly", () => {
  for (const coll of config.collections) {
    for (const f of coll.files) {
      const data = JSON.parse(fs.readFileSync(path.join(ROOT, f.file), "utf8"));
      const names = f.fields.map((x) => x.name).sort();
      assert.deepEqual(Object.keys(data).sort(), names, `${f.file} top-level keys`);
      for (const field of f.fields.filter((x) => x.widget === "list" && x.fields)) {
        const sub = field.fields.map((x) => x.name);
        const required = field.fields.filter((x) => x.required !== false).map((x) => x.name);
        for (const [i, item] of data[field.name].entries()) {
          for (const k of Object.keys(item)) assert.ok(sub.includes(k), `${f.file} item ${i}: unknown key ${k}`);
          for (const k of required) assert.ok(item[k] !== undefined && item[k] !== "", `${f.file} item ${i}: missing ${k}`);
        }
      }
    }
  }
});

test("gallery categories match the filter buttons", () => {
  const gallery = config.collections.find((c) => c.name === "gallery").files[0];
  const cat = gallery.fields[0].fields.find((x) => x.name === "category");
  assert.deepEqual(cat.options.map((o) => o.value).sort(), ["conferences", "crusades", "ministry"]);
});
