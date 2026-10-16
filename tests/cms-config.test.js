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

const fieldsOf = (collection) => config.collections.find((c) => c.name === collection).files[0].fields;
const patternOf = (field) => new RegExp(field.pattern[0]);

test("the CMS YouTube check agrees with the build's parser, so a bad paste can't break publishing", () => {
  const { youtubeId } = require("../lib/youtube");
  const re = patternOf(fieldsOf("messages")[0].fields.find((x) => x.name === "youtube"));
  for (const ok of ["2xz-IM-QyTA", "https://youtu.be/2xz-IM-QyTA?si=abc", "https://www.youtube.com/watch?feature=share&v=2xz-IM-QyTA&t=42s",
    "https://www.youtube.com/shorts/2xz-IM-QyTA", "https://www.youtube.com/live/2xz-IM-QyTA?si=x", " https://youtu.be/2xz-IM-QyTA "]) {
    assert.ok(re.test(ok), `CMS should accept ${ok}`);
    assert.doesNotThrow(() => youtubeId(ok));
  }
  for (const bad of ["https://www.youtube.com/@imaobongodutola", "https://www.youtube.com/playlist?list=PL123", "https://youtu.be/x", "https://vimeo.com/123456789"]) {
    assert.ok(!re.test(bad), `CMS should reject ${bad}`);
    assert.throws(() => youtubeId(bad));
  }
});

test("social links must be full https:// links (a bare domain would 404 on every page)", () => {
  for (const name of ["instagram", "facebook", "tiktok", "youtube"]) {
    const field = fieldsOf("contact").find((x) => x.name === name);
    assert.ok(field.pattern, `${name} has a pattern`);
    assert.ok(patternOf(field).test("https://www.instagram.com/imaobongodutola/"), name);
    assert.ok(!patternOf(field).test("instagram.com/imaobongodutola"), name);
  }
});
