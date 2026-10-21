// Explicit so jest-expo's babel-jest and Metro share one transform; required under pnpm isolated installs.
module.exports = function babelConfig(api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
