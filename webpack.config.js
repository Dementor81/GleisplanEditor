const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    entry: './app/code/start.ts',
    output: {
      filename: isProduction ? 'bundle.[contenthash].js' : 'bundle.js',
      path: path.resolve(__dirname, 'app', 'dist'),
      clean: true, // Clean dist folder before each build
    },
    resolve: {
      // Support TypeScript and JavaScript files
      extensions: ['.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'app/code'),
        '@managers': path.resolve(__dirname, 'app/code/managers'),
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: {
            loader: 'ts-loader',
            options: {
              transpileOnly: true, // Skip type checking, just transpile
            },
          },
          exclude: /node_modules/,
        },
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'ts-loader',
            options: {
              allowTsInNodeModules: false,
              transpileOnly: true, // Skip type checking, just transpile
            },
          },
        },
        {
          test: /\.css$/,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader',
          ],
        },
      ],
    },
    devServer: {
      static: {
        directory: path.join(__dirname, 'app'),
      },
      compress: false,
      port: 9000,
      hot: false, // Enable hot module replacement
      liveReload: false,
      
    },
    devtool: isProduction ? 'source-map' : 'eval-source-map',
    mode: argv.mode || 'development',
    plugins: [
      new HtmlWebpackPlugin({
        template: 'app/start.html',
        filename: 'start.html',
        inject: 'head',
        scriptLoading: 'blocking'
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'app',
            to: '',
            globOptions: {
              ignore: ['code/**', 'dist/**', '**/code/**', '**/dist/**', 'start.html', '**/start.html'],
            },
          },
        ],
      }),
      ...(isProduction ? [new MiniCssExtractPlugin({
        filename: 'styles.[contenthash].css',
      })] : []),
    ],
  };
}; 