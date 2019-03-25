const path = require('path');
const webpack = require('webpack');
const merge = require('webpack-merge');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

const common = require('./webpack.common');

module.exports = merge(common, {
    mode: 'development',
    devtool: 'source-map',
    devServer: {
        contentBase: path.resolve(__dirname, 'public'),
        host: '0.0.0.0', // this allows VMs to access the server
        port: 3000,
        disableHostCheck: true
    }
});
