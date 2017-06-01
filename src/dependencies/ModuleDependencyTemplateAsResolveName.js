/**
 * 名称：webpack 模块引用标识符模板
 * 日期:2017-06-01
 * 描述：用于替换CommonJsRequireDependency.Template 
 *      从而实现 require(模块名称)  而不是require(模块id)
 */
var path = require('path')
var CommonJsRequireDependency = require('webpack/lib/dependencies/CommonJsRequireDependency.js')

/**
 * webpack require 使用模块名称作为模块标识
 * 用于替换 ModuleDependencyTemplateAsId 模板
 */
function ModuleDependencyTemplateAsResolveName () {
}

/**
 * 依赖模块引用替换处理
 */
ModuleDependencyTemplateAsResolveName.prototype.apply = function (dep, source, outputOptions, requestShortener) {
  if (!dep.range) return
  var module = dep.module
  var request = dep.userRequest
  var content = request
  var sourcePath = source._source._name
  var isRequirejs = (request.indexOf('./') > -1 || request.indexOf('../') > -1) || request.indexOf('image!') == 0
  sourcePath = (sourcePath.indexOf('babel!') > -1 ? sourcePath.split('babel!')[1] : sourcePath)
  sourcePath = path.dirname(sourcePath)
  if (module.resource && isRequirejs) {
    content = path.relative(sourcePath, module.resource)
    var extName = path.extname(content)
    if (extName && extName != '.js') {
      var info = path.parse(content)
      content = path.join(info.root, info.dir, info.name+'.js')
    }
    content = './' + content.replace(/\\/g, '/')
  }
  source.replace(dep.range[0], dep.range[1] - 1, '"' + content + '"')
}

// 覆盖默认模板
CommonJsRequireDependency.Template = ModuleDependencyTemplateAsResolveName