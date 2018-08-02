/**
 * @name NormalPathResolve
 * @description 解决webpack的loader 在nodejs环境下包含 !xxx/xx!xx的路径问题
 */

function NormalPathResolve() {

}

/**
 * 设置解决方案
 */
NormalPathResolve.makeResolve = function () {
  const originalResolveFileName = module.constructor._resolveFilename;
  module.constructor._resolveFilename = function (name, mod, isMain) {
    if (mod.filename.indexOf("!") > -1) {
      mod.filename = mod.filename.split('!').pop();
    }
    return originalResolveFileName(name, mod, isMain);
  }
}

module.exports = NormalPathResolve