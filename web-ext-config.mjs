export default {
  ignoreFiles: [
    "package.json",
    "package-lock.json",
    "web-ext-config.mjs",
    "README.md",
    "screenshots",
  ],
  run: {
    startUrl: ["https://music.youtube.com"],
  },
  build: {
    overwriteDest: true,
  },
};
