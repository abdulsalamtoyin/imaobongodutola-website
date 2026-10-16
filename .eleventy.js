module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({
    "src/assets": "assets",
    "src/admin": "admin",
    "src/robots.txt": "robots.txt",
    "src/sitemap.xml": "sitemap.xml",
  });
  eleventyConfig.ignores.add("src/admin/**");
  eleventyConfig.ignores.add("src/assets/**");
  // Her text must never be able to break the markup.
  eleventyConfig.setNunjucksEnvironmentOptions({ autoescape: true });

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    templateFormats: ["njk"],
  };
};
