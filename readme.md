# 简介

> @c0nanxie/vite-plugin-qiankun: 帮助应用快速接入 qiankun 的 vite 插件，解决了原插件切换多个子应用后无法渲染的问题  
> Fork from [vite-plugin-qiankun](https://github.com/tengmaoqing/vite-plugin-qiankun)

## 特性

- 保留 vite 构建 es 模块的优势
- 一键配置，不影响已有的 vite 配置
- 支持 vite 开发环境

## 快速开始

### 1. 在 `vite.config.ts` 中安装插件

```typescript
// vite.config.ts

import qiankun from '@c0nanxie/vite-plugin-qiankun'

export default {
  // 这里的 'myMicroAppName' 是子应用名，主应用注册时AppName需保持一致
  plugins: [
    default('myMicroAppName', {
      // 用于 qiankun 沙盒替换和其他代码注入
      entryMatcher: /\/src\/main\.js/,
    })
  ],
  // 生产环境需要指定运行域名作为base
  base: 'http://xxx.com/'
}
```

### 2. 插件已经自动注入代码，只需指定入口

为了避免侵入式修改以及兼容 webpack 生产打包，插件会自动在入口文件中注入兼容 vite 的代码，所以需要指定入口文件

### 3. dev 下作为子应用调试

> 因为开发环境作为子应用时与热更新插件（可能与其他修改 html 的插件也会存在冲突）有冲突，所以需要额外的调试配置

```typescript
// useDevMode 开启时与热更新插件冲突,使用变量切换
const useDevMode = true

const baseConfig: UserConfig = {
  plugins: [
    ...(useDevMode ? [] : [reactRefresh()]),
    qiankun('viteapp', {
      useDevMode,
    }),
  ],
}
```

上面例子中 `useDevMode = true` 则不使用热更新插件，`useDevMode = false` 则能使用热更新，但无法作为子应用加载。

### 4. 主应用配置

主应用中注册微应用时，在生命周期里保存子应用实例，用于加载子应用时取得对应的沙盒

```typescript
registerMicroApps(childApp, {
  beforeLoad: [
    (app) => {
      window.__QIANKUN_SUB_APP__ = app
    },
  ],
  beforeMount: [
    (app) => {
      window.__QIANKUN_SUB_APP__ = app
    },
  ],
  afterUnmount: [
    (app) => {
      window.__QIANKUN_SUB_APP__ = null
    },
  ],
})
```

### 5. 其它使用注意点 `qiankunWindow`

因为 es 模块加载与 `qiankun` 的实现方式有些冲突，所以使用本插件实现的 `qiankun` 微应用里面没有运行在 js 沙盒中。所以在不可避免需要设置 window 上的属性时，尽量显示的操作 js 沙盒，否则可能会对其它子应用产生副作用。qiankun 沙盒使用方式

```typescript
import { qiankunWindow } from '@c0nanxie/vite-plugin-qiankun/dist/helper'

qiankunWindow().customxxx = 'ssss'

if (qiankunWindow().__POWERED_BY_QIANKUN__) {
  console.log('我正在作为子应用运行')
}
```

## API

### Config

```typescript
{
  /**
   * 是否开发模式
   */
  useDevMode?: boolean

  /**
   * 匹配入口 js，用于 qiankun 沙盒替换和其他代码注入
   */
  entryMatcher?: RegExp | string

  /**
   * 入口 js 里的附加代码
   * 
   * e.g.
   * import Quill from 'quill'; window.Quill = Quill;
   */
  appended?: string

  /**
   * 自动将指定变量移动到 qiankun 沙盒
   * ⚠️ 确保变量名在入口 js 里是唯一的，因为只是简单的字符串替换，没有分析语法树
   */
  moveToSandboxVariables?: string[]

  /**
   * 子应用静态资源路径重写，默认为 true，会在前面拼接子应用的服务地址，防止 404
   */
  rewriteAssetsPath?: boolean

  /**
   * 子应用静态资源路径重写函数，可自定义重写逻辑
   */
  assetsPathReplacer?: (path: string) => string
}
```

## 例子（暂未修改，不可用）

详细的信息可以参考例子里面的使用方式

```
git clone xx
npm install
npm run example:install
# 生产环境调试demo
npm run example:start
# vite开发环境demo, demo中热更新已经关闭
npm run example:start-vite-dev
```
