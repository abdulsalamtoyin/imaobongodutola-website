const path = require("node:path");
const Image = require("@11ty/eleventy-img");

const ROOT = path.join(__dirname, "..");
const UPLOADS = "assets/img/uploads/";
const URL_PATH = "assets/img/generated/";
const DEFAULTS = {
  inputDir: path.join(ROOT, "src"),
  outputDir: path.join(ROOT, "_site", "assets", "img", "generated"),
};

function isUpload(src) {
  return typeof src === "string" && src.replace(/^\//, "").startsWith(UPLOADS);
}

async function resize(src, width, opts = {}) {
  if (!isUpload(src)) return src;
  const { inputDir, outputDir } = { ...DEFAULTS, ...opts };
  let stats;
  try {
    stats = await Image(path.join(inputDir, src.replace(/^\//, "")), {
      widths: [width],
      formats: ["jpeg"],
      outputDir,
      urlPath: URL_PATH,
      sharpJpegOptions: { quality: 80, mozjpeg: true },
      // JPEG has no transparency; without this, transparent areas turn black.
      transform: (sharp) => sharp.flatten({ background: "#ffffff" }),
    });
  } catch (e) {
    throw new Error(`Image "${src}" could not be processed: ${e.message}`);
  }
  return stats.jpeg[0].url.replace(/^\//, "");
}

async function galleryVariants(src, opts) {
  if (!isUpload(src)) {
    return { full: src, thumb: src.replace("/gallery/full/", "/gallery/thumb/") };
  }
  return { full: await resize(src, 1600, opts), thumb: await resize(src, 700, opts) };
}

module.exports = { isUpload, resize, galleryVariants };
