/**
 * 名称：webpack 模块引用标识符模板
 * 日期:2017-06-01
 * 描述：用于替换CommonJsRequireDependency.Template 
 *      从而实现 require(模块名称)  而不是require(模块id)
 */
var path = require('path')
var NameResolve = require('./NameResolve');
var CommonJsRequireDependency = require('webpack/lib/dependencies/CommonJsRequireDependency.js')

var resolveExtensions = [];
var resolveAlias = {};
var ProjectRoot = null;
var ORIGINAL_REQUIRE_JS = require.extensions['.js'];

/**
 * webpack require 使用模块名称作为模块标识
 * 用于替换 ModuleDependencyTemplateAsId 模板
 */
function ModuleDependencyTemplateAsResolveName() {
}

/**
 * 依赖模块引用替换处理
 */
ModuleDependencyTemplateAsResolveName.prototype.apply = function (dep, source) {
  if (!dep.range) return
  var module = dep.module
  var request = dep.userRequest
  var content = request
  var resource = module.resource;
  var sourcePath = source._source._name
  var isRequirejs = (request.indexOf('./') > -1 || request.indexOf('../') > -1) || request.indexOf('image!') == 0;
  var cExtName = path.extname(content);
  var extName = path.extname(resource || content)
  var hasAssets = Object.keys(module.assets || {}).length > 0;
  if(path.extname(sourcePath)==='.css'){
    return;
  }
  if (path.isAbsolute(content)) {
    content = this.absoluteResolve(content, sourcePath);
  } else if (resource && isRequirejs) {
    content = this.relativeResolve(sourcePath, resource);
  } else if (hasAssets && extName && extName != '.js') {
    content = this.assetsResolve(content, extName);
  } else if (content.indexOf('/') > -1 && cExtName !== extName && cExtName !== '.js') {
    content = this.moduleFileResolve(content, resource, extName);
  } else if (extName !== '' && extName !== '.js') {
    var info = path.parse(content)
    content = path.join(info.dir, info.name + extName + '.js').replace(/\\/g, '/');
  }
  content = resolveAlias[content] || content;
  source.replace(dep.range[0], dep.range[1] - 1, '\'' + content + '\'');
}

/**
 * 绝对路径引用处理 require('d:/as/aa.js')
 */
ModuleDependencyTemplateAsResolveName.prototype.absoluteResolve = function (content, sourcePath) {
  var holder = "node_modules/";
  var index = content.indexOf(holder);
  if (index > -1) {
    return content.substring(index + holder.length);
  } else {
    return this.relativeResolve(sourcePath, content)
  }
}

/**
 * 相对require处理 例如: require('./xxx')
 */
ModuleDependencyTemplateAsResolveName.prototype.relativeResolve = function (sourcePath, resource) {
  sourcePath = sourcePath.split('!').pop();
  sourcePath = path.dirname(sourcePath)
  var movedSourcePath = NameResolve.moveToProjectRoot(ProjectRoot, sourcePath);
  var movedSource = NameResolve.moveToProjectRoot(ProjectRoot,resource);
  var content = path.relative(movedSourcePath, movedSource)
  var extName = path.extname(resource).replace(/\s/g, '')
  var info = path.parse(content)
  extName = !extName ? extName + '.js' : extName;
  content = path.join(info.dir, info.name + extName)
  content = './' + content.replace(/\\/g, '/')
  return content;
}

/**
 * 静态资源 require require('./a.jpg')
 */
ModuleDependencyTemplateAsResolveName.prototype.assetsResolve = function (request, extName) {
  var info = path.parse(request)
  request = path.join(info.dir, info.name + extName + '.js')
  return request.replace(/\\/g, '/')
}

/**
 * 模块下文件引用处理 require('webpack/lib/NormalModule.js')
 */
ModuleDependencyTemplateAsResolveName.prototype.moduleFileResolve = function (content, resource, extName) {
  var resolve = (extName == '.js' ? resource : require.resolve(content)).replace(/\\/g, '/');
  var usePath = resolve.split('node_modules/').pop()
  return usePath;
}

// 覆盖默认模板
CommonJsRequireDependency.Template = ModuleDependencyTemplateAsResolveName

module.exports.setOptions = function (options,projectRoot) {
  var resolve = options.resolve || {};
  ProjectRoot = projectRoot;
  resolveExtensions = resolve.extensions || [];
  resolveAlias = resolve.alias;
  resolveExtensions.forEach(function (ext) {
    require.extensions[ext] = ORIGINAL_REQUIRE_JS;
  })
}