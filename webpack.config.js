const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    entry: './www/code/start.js',
    output: {
      filename: isProduction ? 'bundle.[contenthash].js' : 'bundle.js',
      path: path.resolve(__dirname, 'www', 'dist'),
      clean: true, // Clean dist folder before each build
    },
    devServer: {
      static: {
        directory: path.join(__dirname, 'www'),
      },
      compress: true,
      port: 9000,
      open: {
        app: {
          name: 'google chrome', 
        },
      },
      hot: true, // Enable hot module replacement
    },
    devtool: isProduction ? 'source-map' : 'eval-source-map',
    mode: argv.mode || 'development',
    plugins: [
      new HtmlWebpackPlugin({
        template: 'www/start.html',
        filename: 'start.html',
        inject: 'head',
        scriptLoading: 'blocking'
      }),
    ],
  };
}; 