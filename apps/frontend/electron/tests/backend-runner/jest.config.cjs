/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/specs"],
  setupFilesAfterEnv: ["<rootDir>/setup/perTestDb.js"],
  testTimeout: 20000,
};
