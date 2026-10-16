const test = require("node:test");
const assert = require("node:assert/strict");
const { youtubeId } = require("../lib/youtube");

test("accepts every common YouTube link form", () => {
  for (const input of [
    "2xz-IM-QyTA",
    "https://youtu.be/2xz-IM-QyTA",
    "https://youtu.be/2xz-IM-QyTA?si=abc123",
    "https://www.youtube.com/watch?v=2xz-IM-QyTA",
    "https://www.youtube.com/watch?feature=share&v=2xz-IM-QyTA&t=42s",
    "https://m.youtube.com/watch?v=2xz-IM-QyTA",
    "https://www.youtube.com/shorts/2xz-IM-QyTA",
    "https://www.youtube.com/embed/2xz-IM-QyTA",
    "https://www.youtube.com/live/2xz-IM-QyTA?si=x",
    "  https://youtu.be/2xz-IM-QyTA  ",
  ]) {
    assert.equal(youtubeId(input), "2xz-IM-QyTA", input);
  }
});

test("rejects anything that is not a YouTube video", () => {
  for (const input of ["", "hello", "https://vimeo.com/123456789", "https://www.youtube.com/@imaobongodutola"]) {
    assert.throws(() => youtubeId(input), /Not a YouTube link/, input);
  }
});
