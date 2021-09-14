// packages/package-a/jest.config.js
// Jest configuration for api
const base = require("../../jest.base.js");
const tsconfig = require("./tsconfig");
const moduleNameMapper = require("tsconfig-paths-jest")(tsconfig);
module.exports = {
  ...base,
  name: "@moronic-puppy/moronic-puppy",
  displayName: "moronic-puppy",
  moduleNameMapper,
};
