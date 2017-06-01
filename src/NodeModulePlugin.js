/**
 * 名称：webpack node服务端代码打包插件
 * 日期:2017-06-01
 * 描述：
 *  由于webpack打包会将相关依赖文件合并到一个文件，在服务端使用时追踪堆栈，以及调试不是很方便
 *  所以使用当前插件可以将入口文件使用webpack处理后，不再合并成同一个文件
 *  而是保留原始目录结构输出到output目录下
 */

require('./dependencies/NodeRequireHeaderDependencyTemplate.js')
require('./dependencies/ModuleDependencyTemplateAsResolveName.js')

var path = require('path')
var fs = require('fs')
var Entrypoint = require('webpack/lib/Entrypoint')
var ConcatSource = require('webpack-sources').ConcatSource

/**
 * 服务端打包插件
 * @param {String} contextPath 工程目录
 */
function NodeModulePlugin (contextPath) {
  this.extraChunks = {}
  this.contextPath = contextPath
}

NodeModulePlugin.prototype.apply = function (compiler) {
  var thisContext = this
  compiler.plugin('this-compilation', function (compilation) {
    // 自定义服务端js打包模板渲染 取消webpackrequire机制，改成纯require
    thisContext.registerNodeEntry(compilation)
    // 服务端代码打包，不再合并成一个文件，而是改成每个es6模块文件文件打包到目标目录
    thisContext.registerNodeTemplate(compilation)
  })
}

/**
 * 自定义webpack entry 
 * 目标：实现打包服务端代码，entry不再合并成一个文件，而是保留原始目录结构到目标目录
 */
NodeModulePlugin.prototype.registerNodeEntry = function (compilation) {
  var thisContext = this
  compilation.plugin('optimize-chunks', function (chunks) {
    this.chunks = []
    var outputOptions = this.outputOptions
    var addChunk = this.addChunk.bind(this)
    var entryChunks = chunks
      .filter(function (chunk) {
        return chunk.hasRuntime() && chunk.name
      }).map(function (chunk) {
      chunk.modules
        .slice()
        .filter(function (mod) {
          return (mod.userRequest)
        })
        .forEach(function (mod) {
          thisContext.handleAddChunk(addChunk, mod, chunk, outputOptions)
        })
    })
  })
}

/**
 * 处理文件输出
 */
NodeModulePlugin.prototype.handleAddChunk = function (addChunk, mod, chunk, outputOptions) {
  var info = path.parse(path.relative(this.contextPath, mod.userRequest))
  var name = path.join(info.root, info.dir, info.name)
  var newChunk = this.extraChunks[name]
  if (!newChunk) {
    newChunk = this.extraChunks[name] = addChunk(name)
    var entrypoint = new Entrypoint(name)
    entrypoint.chunks.push(newChunk)
    newChunk.entrypoints = [entrypoint]
  }
  newChunk.addModule(mod)
  mod.addChunk(newChunk)
  mod.removeChunk(chunk)
}

/**
 * 自定义webpack ModuleTemplate.render 
 * 改成打包目标文件保留原生nodejs风格
 */
NodeModulePlugin.prototype.registerNodeTemplate = function (compilation) {
  compilation.mainTemplate.plugin('render', function (bootstrapSource, chunk, hash, moduleTemplate, dependencyTemplates) {
    var source = new ConcatSource()
    chunk.modules.map(function (module) {
      var ext = path.extname(module.userRequest)
      var moduleSource = null
      switch (ext) {
        case '.json':
          moduleSource = module._source
          break
        default:
          moduleSource = module.source(dependencyTemplates, moduleTemplate.outputOptions, moduleTemplate.requestShortener)
          break
      }
      source.add(moduleSource)
    })
    return source
  })
}

module.exports = NodeModulePlugin;