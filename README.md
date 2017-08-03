## webpack-node-module-plugin

### 一、简介

    react-native-web 同构模式下 服务端打包插件

    使用webpack打包服务端代码时，可以不进行文件合并，而是保留原始目录结构产出

    打包后的文件。


### 二、安装

    npm install webpack-node-module-plugin --save-dev
    
     
### 三、使用

Webpack config example:

```js
    var NodeModulePlugin  =require('webpack-node-module-plugin').NodeModulePlugin;
    // 静态资源url前是否添加一个全局变量进行拼接
    // 例如：require('./images/a.jpg') --> webpack --> __cdnurl+'/app/assets/sdf23422sssdf.jpg'
    var cdnVariableName= '__cdnurl__';
    // 发布目录根路径  copyNodeMoudles为false时可以不传递
    var targetRoot = 'd:/release/web';
    // 是否复制node_modules到发布目录下 默认: false
    var copyNodeMoudles = true;

    module.exports = {
      entry: {
        'server': ['./index.web.js']
      },
      output: {
        path: ...,
        filename:  'server/[name].js',
        publicPath: '/assets/',
        libraryTarget: 'commonjs2'
      },
      plugins:[
        ....
        new NodeModulePlugin('rootDir',cdnVariableName,targetRoot,copyNodeMoudles)
      ]
    }
```

### 四、开源许可
基于 [MIT License](http://zh.wikipedia.org/wiki/MIT_License) 开源，使用代码只需说明来源，或者引用 [license.txt](https://github.com/sofish/typo.css/blob/master/license.txt) 即可。
