const fs = require("node:fs");
const path = require("node:path");
const { buildView } = require("../../lib/view");

const read = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, f), "utf8"));

module.exports = () => buildView({
  messages: read("messages.json").items,
  gallery: read("gallery.json").items,
  books: read("books.json").items,
  testimonies: read("testimonies.json").items,
  home: read("home.json"),
});
