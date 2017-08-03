/**
 * 名称：webpack node服务端代码打包插件
 * 日期:2017-06-01
 * 描述：
 *  由于webpack打包会将相关依赖文件合并到一个文件，在服务端使用时追踪堆栈，以及调试不是很方便
 *  所以使用当前插件可以将入口文件使用webpack处理后，不再合并成同一个文件
 *  而是保留原始目录结构输出到output目录下
 */

var path = require('path')
var fse = require('fs-extra');
var Entrypoint = require('webpack/lib/Entrypoint')
var NormalModule = require('webpack/lib/NormalModule.js')
var AMDPlugin = require('webpack/lib/dependencies/AMDPlugin.js')
var ConcatSource = require('webpack-sources').ConcatSource

//取消AMD模式
AMDPlugin.prototype.apply = function () {

}

/**
 * 服务端打包插件
 * @param {String} contextPath 工程目录
 */
function NodeModulePlugin(contextPath, cdnName, targetRoot) {
  this.extraChunks = {}
  this.extraPackage = {};
  this.contextPath = contextPath
  this.targetRoot = targetRoot;
  this.cdnName = cdnName;
  this.Resolve = require('./dependencies/ModuleDependencyTemplateAsResolveName.js');
  this.Template = require('./dependencies/NodeRequireHeaderDependencyTemplate.js')
}

NodeModulePlugin.prototype.apply = function (compiler) {
  var thisContext = this
  this.Resolve.setOptions(compiler.options);
  compiler.plugin('this-compilation', function (compilation) {
    // 自定义服务端js打包模板渲染 取消webpackrequire机制，改成纯require
    thisContext.registerNodeEntry(compilation)
    // 服务端代码打包，不再合并成一个文件，而是改成每个es6模块文件文件打包到目标目录
    thisContext.registerNodeTemplate(compilation)
    //输出package assets
    thisContext.registerNodePackage(compiler, compilation);
    //注册 normal-module-loader
    thisContext.registerNodeNormalModuleLoader(compilation);
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
        chunk.forEachModule(function (mod) {
          if (mod.userRequest) {
            thisContext.handleAddChunk(addChunk, mod, chunk, compilation)
          }
        })
      })
  })
}

/**
 * 处理文件输出
 */
NodeModulePlugin.prototype.handleAddChunk = function (addChunk, mod, chunk, compilation) {
  var info = path.parse(path.relative(this.contextPath, mod.userRequest))
  var name = path.join(info.root, info.dir, info.name)
  var nameWith = name + info.ext;
  var newChunk = this.extraChunks[nameWith]
  if (info.ext !== '.js') {
    name = name + info.ext;
  }
  if (!newChunk) {
    mod.variables = [];
    var entrypoint = new Entrypoint(name)
    newChunk = this.extraChunks[nameWith] = addChunk(name)
    entrypoint.chunks.push(newChunk)
    newChunk.entrypoints = [entrypoint]
    if (info.dir.indexOf("node_modules") > -1) {
      this.handlePackage(newChunk, mod, addChunk)
    }
  }
  newChunk.addModule(mod)
  mod.addChunk(newChunk)
  mod.removeChunk(chunk)
}

/**
 * 处理模块package.json
 */
NodeModulePlugin.prototype.handlePackage = function (chunk, mod, addChunk) {
  var request = mod.resource;
  var resource = mod.resource;
  request = path.dirname(request);
  var lastNodeIndex = request.lastIndexOf('node_modules');
  var firstNodeIndex = request.indexOf('node_modules');
  var packageName = request.substring(lastNodeIndex).split(path.sep)[1] || '';
  var baseDir = request.substring(0, lastNodeIndex) + 'node_modules/' + packageName;
  var pgk = path.join(baseDir, 'package.json');
  var main = resource.substring(lastNodeIndex).replace(/\\/g, '/').split('node_modules/' + packageName + '/').pop();
  if (!this.extraPackage[pgk] && fse.existsSync(pgk)) {
    this.extraPackage[pgk] = {
      file: pgk,
      main: main,
      packageName: packageName,
      name: request.substring(firstNodeIndex, lastNodeIndex) + 'node_modules/' + packageName + '/package.json',
      chunk: chunk
    }
  }
}

/**
 * 输出package.json处理
 */
NodeModulePlugin.prototype.registerNodePackage = function (compiler) {
  var thisContext = this;
  compiler.plugin('emit', function (compilation, cb) {
    var chunkPackageKeys = Object.keys(thisContext.extraPackage);
    var chunkTemplate = compilation.outputOptions.chunkFilename;
    var chunkModuleNames = [];
    chunkPackageKeys.forEach(function (key) {
      var chunkPackage = thisContext.extraPackage[key];
      var pgk = chunkPackage.file;
      var file = compilation.getPath(chunkTemplate, { chunk: chunkPackage.chunk })
      var outputPath = path.dirname(file);
      var copyTo = outputPath + '/' + chunkPackage.name;
      var package = fse.readJsonSync(pgk);
      package.main = chunkPackage.main;
      var content = JSON.stringify(package, null, 4);
      var size = content.length;
      chunkModuleNames.push(chunkPackage.packageName)
      compilation.assets[copyTo] = {
        size: function () {
          return size;
        },
        source: function () {
          return content;
        }
      };
    })
    thisContext.copyEntryNodeModules(compilation, chunkModuleNames);
    cb();
  });
}

/**
 * 自定义webpack ModuleTemplate.render 
 * 改成打包目标文件保留原生nodejs风格
 */
NodeModulePlugin.prototype.registerNodeTemplate = function (compilation) {
  var cdnName = this.cdnName;
  var outputOptions = compilation.outputOptions;
  var publicPath = outputOptions.publicPath;
  var replacement = this.replacement.bind(this);
  compilation.mainTemplate.plugin('render', function (bootstrapSource, chunk, hash, moduleTemplate, dependencyTemplates) {
    var source = new ConcatSource()
    chunk.forEachModule(function (module) {
      var ext = path.extname(module.userRequest)
      var assets = Object.keys(module.assets || {});
      var moduleSource = null
      switch (ext) {
        case '.json':
          moduleSource = module._source
          break
        default:
          if (assets.length > 0) {
            var url = assets[0];
            url = cdnName ? cdnName + " + '" + url + "'" : "'" + publicPath + url + "'";
            moduleSource = 'module.exports= ' + url;
          } else {
            moduleSource = module.source(dependencyTemplates, moduleTemplate.outputOptions, moduleTemplate.requestShortener)
          }
          break
      }
      replacement(moduleSource);
      source.add(moduleSource)
    })
    return source
  })
}

/**
 * 注册normal module loader
 */
NodeModulePlugin.prototype.registerNodeNormalModuleLoader = function (compilation) {
  compilation.plugin("normal-module-loader", function (loaderContext, module) {
    var exec = loaderContext.exec.bind(loaderContext)
    loaderContext.exec = function (code, filename) {
      return exec(code, filename.split('!').pop());
    }
  });
}

/**
 * 替换 __webpack_require
 */
NodeModulePlugin.prototype.replacement = function (moduleSource) {
  var replacements = moduleSource.replacements || [];
  replacements.forEach(function (rep) {
    var v = rep[2] || "";
    var isVar = v.indexOf("WEBPACK VAR INJECTION") > -1;
    v = isVar ? "" : v.replace(/__webpack_require__/g, 'require');
    if (v.indexOf("AMD") > -1) {
      v = "";
    }
    rep[2] = v;
  })
}

/**
 * 复制服务端node_modules代码e
 */
NodeModulePlugin.prototype.copyEntryNodeModules = function (compilation, chunkNodeModuleNames) {
  var targetRoot = this.targetRoot;
  var projectRoot = process.cwd();
  var allModules = this.getDependencyNodeModules(projectRoot);
  var allModulesKeys = Object.keys(allModules);
  var bin = 'node_modules/.bin';
  fse.copySync(path.join(projectRoot, bin), path.join(targetRoot, bin));
  allModulesKeys.forEach(function (key) {
    var src = allModules[key];
    var dest = path.join(targetRoot, 'node_modules', src.split('node_modules')[1]);
    fse.copySync(src, dest);
  })
}

/**
 * 获取工程目录下需要复制的node_modules
 */
NodeModulePlugin.prototype.getDependencyNodeModules = function (projectRoot) {
  var package = path.join(projectRoot, 'package.json');
  return this.findPackageDependencies(package, projectRoot);
}

/**
 * 获取当前项目下需要复制的node_modules列表
 * @param file 项目package.json路径
 * @param projectRoot 项目根目录
 * @param allModules 默认不用传递
 * @returns {Object} 所有依赖模块
 */
NodeModulePlugin.prototype.findPackageDependencies = function (file, projectRoot, allModules) {
  var thisContext = this;
  var package = require(file);
  var dependencies = Object.keys(package.dependencies || {});
  var selfRoot = path.dirname(file);
  allModules = allModules || {};
  dependencies.forEach(function (dependency) {
    if (!allModules[dependency]) {
      var dpfile = thisContext.getPackagePath(selfRoot, projectRoot, dependency);
      if (dpfile) {
        allModules[dependency] = path.dirname(dpfile);
        thisContext.findPackageDependencies(dpfile, projectRoot, allModules);
      }
    }
  })
  return allModules;
}

/**
 * 查找依赖模块路径
 * @param parentDir 父级目录路径
 * @param projectRoot 项目根目录
 * @param name 依赖模块名称
 */
NodeModulePlugin.prototype.getPackagePath = function (parentDir, projectRoot, name) {
  var projectNodeModule = null;
  var pathRoot = path.parse(projectRoot).root;
  for (
    var currentRoot = projectRoot;
    currentRoot != pathRoot;
    currentRoot = path.dirname(currentRoot)
  ) {
    var package = path.join(currentRoot, 'node_modules', name, 'package.json');
    if (fse.existsSync(package)) {
      projectNodeModule = package;
      break;
    }
  }
  return projectNodeModule;
}

module.exports = NodeModulePlugin;