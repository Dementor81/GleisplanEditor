const path = require('path');

module.exports = {
  entry: './www/code/start.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'www', 'dist'),
  },
  devServer: {
    static: {
      directory: path.join(__dirname, 'www'),
    },
    compress: true,
    port: 9000,
    open: true,
  },
  devtool: 'source-map',
  mode: 'development'
}; 