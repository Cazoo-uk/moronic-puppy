const base = require("./jest.base.js");

module.exports = {
  ...base,
  projects: ["<rootDir>/packages/moronic-puppy/jest.config.js"],
  coverageDirectory: "<rootDir>/coverage/",
};
