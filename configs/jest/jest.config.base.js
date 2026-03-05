const tsJestPreset = require("./ts-jest.preset");

module.exports = {
  rootDir: process.cwd(),
  ...tsJestPreset,
  testPathIgnorePatterns: ["/node_modules/", "/dist/"]
};
