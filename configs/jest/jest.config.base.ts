import tsJestPreset from "./ts-jest.preset";

export default {
  ...tsJestPreset,
  testPathIgnorePatterns: ["/node_modules/", "/dist/"]
};
