/**
 * @name 复制服务端
 * @date 2018-04-24
 * @description 复制与编译服务端非React部分代码
 */
var path = require('path');
var fse = require('fs-extra');
var CopyWebpackPlugin = require('copy-webpack-plugin');
var babel = require('babel-core');

function NodeModuleAssetsDependency(project, targetRoot, babelRc, ignores) {
  this.project = project;
  this.babelRc = babelRc;
  this.targetRoot = targetRoot;
  this.dependencies = [];
  this.ignores = ignores || [];
  this.babelRc.ignore = this.babelRc.ignore || function () { return false; };
  this.transformCode = this.transformCode.bind(this);
  this.initRules(ignores);
  this.applyDependencies();
}

/**
 * 初始化忽略项
 */
NodeModuleAssetsDependency.prototype.initRules = function (ignores) {
  var subRlease = path.relative(this.project, this.targetRoot);
  this.ignores = [
    (
      subRlease.indexOf('..') > -1 ?
        '.git/**/*' :
        subRlease.replace(/\\/g, '/') + '/**/*'
    ),
    '.gitignore',
    '.eslintrc.js',
    '.git/**/*',
    'logs/**/*',
    '.vscode/**/*',
    '.happypack/**/*',
    'node_modules/**/*'
  ].concat(ignores || []);
}

/**
 * 添加忽略项
 */
NodeModuleAssetsDependency.prototype.applyRule = function(ignore){
  this.ignores.push(ignore);
}

/**
 * 初始化服务端需要复制的代码
 */
NodeModuleAssetsDependency.prototype.applyDependencies = function () {
  fse.readdirSync(this.project).forEach(this.applyDepencency.bind(this));
  this.copyWebpackPlugin = new CopyWebpackPlugin(this.dependencies, {
    context: this.project,
  });
}

/**
 * 添加复制目录
 */
NodeModuleAssetsDependency.prototype.applyDepencency = function (name) {
  if (name.indexOf('node_modules') < 0) {
    var isDir = fse.lstatSync(path.join(this.project, name)).isDirectory();
    this.dependencies.push({
      from: isDir ? name + '/**/*' : name,
      to: this.targetRoot,
      ignore: this.ignores,
      fromArgs: { dot: true },
      transform: this.transformCode,
    })
  }
}

/**
 * 转换服务端代码
 */
NodeModuleAssetsDependency.prototype.transformCode = function (content, path) {
  var babelRc = this.babelRc;
  if (!/\.js$/.test(path) || babelRc.ignore(path)) {
    return content;
  }
  return babel.transform(String(content).toString(), {
    babelrc: false,
    filename: path,
    compact: babelRc.compact,
    presets: babelRc.presets,
    plugins: babelRc.plugins,
  }).code;
}


NodeModuleAssetsDependency.prototype.apply = function (compiler) {
  this.copyWebpackPlugin.apply(compiler);
}

module.exports = NodeModuleAssetsDependency;