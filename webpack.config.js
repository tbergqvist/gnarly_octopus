var webpack = require('webpack');
var path = require('path');
var fs = require('fs');

var nodeModules = {};
fs.readdirSync('node_modules')
  .filter(function(x) {
    return ['.bin'].indexOf(x) === -1;
  })
  .forEach(function(mod) {
    nodeModules[mod] = 'commonjs ' + mod;
});

module.exports = {
  target: "node",
  entry: "./src/main.ts",
  output: {
    filename: "./dist/bundle.js",
    devtoolModuleFilenameTemplate: '[absolute-resource-path]'
  },
  externals: nodeModules,
  // Enable sourcemaps for debugging webpack's output.
  devtool: "inline-source-map",
  resolve: {
    // Add '.ts' and '.tsx' as resolvable extensions.
    extensions: [".webpack.js", ".web.js", ".ts", ".js"]
  },
  
  module: {
    loaders: [
      // Handle .ts and .tsx file via ts-loader.
      { test: /\.tsx?$/, loader: "ts-loader" }
    ],
  },
};