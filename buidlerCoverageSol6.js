module.exports = {
  solc: {
    version: "0.6.6",
    optimizer: require("./solcOptimiserSettings.js")
  },

  paths: {
    sources: "./contracts/sol6",
    artifacts: ".coverageArtifacts"
  }
};
