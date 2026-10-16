const BARE_ID = /^[\w-]{11}$/;
const IN_URL = /(?:youtu\.be\/|[?&]v=|\/(?:embed|shorts|live)\/)([\w-]{11})(?![\w-])/;

function youtubeId(input) {
  const s = String(input ?? "").trim();
  if (BARE_ID.test(s)) return s;
  const m = s.match(IN_URL);
  if (!m) throw new Error(`Not a YouTube link: "${s}"`);
  return m[1];
}

module.exports = { youtubeId };
