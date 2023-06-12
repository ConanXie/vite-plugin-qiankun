import cheerio, { CheerioAPI, Element } from 'cheerio'
import { PluginOption, ResolvedConfig } from 'vite'
import { name as packageName } from '../package.json'

const createQiankunHelper = (qiankunName: string) => `
  const createDeffer = (hookName) => {
    const mainWindow = (0, eval)('window');
    if (mainWindow.__QIANKUN_SUB_APP__) {
      ;(mainWindow.__SUB_APP_SANDBOXES__ = mainWindow.__SUB_APP_SANDBOXES__ || new Map()).set(mainWindow.__QIANKUN_SUB_APP__.name, window);
    } else {
      throw new Error('please assign [app] param to window.__QIANKUN_SUB_APP__ in main project\\'s qiankun life cycle \\'beforeLoad\\' and \\'beforeMount\\'')
    }

    const d = new Promise((resolve, reject) => {
      window.proxy && (window.proxy[\`vite\${hookName}\`] = resolve)
    })
    return props => d.then(fn => fn(props));
  }
  const bootstrap = createDeffer('bootstrap');
  const mount = createDeffer('mount');
  const unmount = createDeffer('unmount');
  const update = createDeffer('update');

  ;(global => {
    global.qiankunName = '${qiankunName}';
    global['${qiankunName}'] = {
      bootstrap,
      mount,
      unmount,
      update
    };
  })(window);
`

// eslint-disable-next-line no-unused-vars
const replaceSomeScript = (
  $: CheerioAPI,
  findStr: string,
  replaceStr: string = '',
) => {
  $('script').each((i, el) => {
    if ($(el).html()?.includes(findStr)) {
      $(el).html(replaceStr)
    }
  })
}

const createImportFinallyResolve = (qiankunName: string) => {
  return `
    const qiankunLifeCycle = window.moudleQiankunAppLifeCycles && window.moudleQiankunAppLifeCycles['${qiankunName}'];
    if (qiankunLifeCycle) {
      window.proxy.vitemount((props) => qiankunLifeCycle.mount(props));
      window.proxy.viteunmount((props) => qiankunLifeCycle.unmount(props));
      window.proxy.vitebootstrap((props) => qiankunLifeCycle.bootstrap(props));
      window.proxy.viteupdate((props) => qiankunLifeCycle.update(props));
    }
  `
}

export type MicroOption = {
  useDevMode?: boolean
  entryMatcher?: RegExp | string
  appended?: string
  moveToSandboxVariables?: string[]
  rewriteAssetsPath?: boolean
  assetsPathReplacer?: (path: string) => string
}
type PluginFn = (qiankunName: string, microOption?: MicroOption) => PluginOption

const htmlPlugin: PluginFn = (qiankunName, microOption = {}) => {
  let isProduction: boolean
  let base = ''
  let resolvedConfig: ResolvedConfig

  const module2DynamicImport = ($: CheerioAPI, scriptTag: Element) => {
    if (!scriptTag) {
      return
    }
    const script$ = $(scriptTag)
    const moduleSrc = script$.attr('src')
    let appendBase = ''
    if (microOption.useDevMode && !isProduction) {
      appendBase =
        "(window.proxy ? (window.proxy.__INJECTED_PUBLIC_PATH_BY_QIANKUN__ + '..') : '') + "
    }
    script$.removeAttr('src')
    script$.removeAttr('type')
    script$.html(`import(${appendBase}'${moduleSrc}')`)
    return script$
  }

  return {
    name: 'qiankun-html-transform',
    configResolved(config) {
      isProduction = config.command === 'build' || config.isProduction
      base = config.base
      resolvedConfig = config
    },

    configureServer(server) {
      return () => {
        server.middlewares.use((req, res, next) => {
          if (isProduction || !microOption.useDevMode) {
            next()
            return
          }
          const end = res.end.bind(res)
          res.end = (...args: any[]) => {
            let [htmlStr, ...rest] = args
            if (typeof htmlStr === 'string') {
              const $ = cheerio.load(htmlStr)
              module2DynamicImport(
                $,
                $(`script[src=${base}@vite/client]`).get(0),
              )
              htmlStr = $.html()
            }
            end(htmlStr, ...rest)
          }
          next()
        })
      }
    },
    transformIndexHtml(html: string) {
      const $ = cheerio.load(html)
      const moduleTags = $(
        'body script[type=module], head script[crossorigin=""]',
      )
      if (!moduleTags || !moduleTags.length) {
        return
      }
      const len = moduleTags.length
      moduleTags.each((i, moduleTag) => {
        const script$ = module2DynamicImport($, moduleTag)
        if (len - 1 === i) {
          script$?.html(`${script$.html()}.finally(() => {
            ${createImportFinallyResolve(qiankunName)}
          })`)
        }
      })

      $('body').append(`<script>${createQiankunHelper(qiankunName)}</script>`)
      const output = $.html()
      return output
    },
    transform(code, id) {
      const { entryMatcher, rewriteAssetsPath, assetsPathReplacer } =
        microOption
      if (
        (typeof entryMatcher === 'string' &&
          entryMatcher &&
          id.includes(entryMatcher)) ||
        (entryMatcher instanceof RegExp && entryMatcher.test(id))
      ) {
        const { moveToSandboxVariables, appended } = microOption

        // import vite-plugin-qiankun helper
        code =
          `import { renderWithQiankun, qiankunWindow } from '${packageName}/dist/helper';\n` +
          code

        // prevent webpack public path error
        code = code.replace(/\b(__webpack_public_path__)\b/, 'window.$1')

        // replace top level variables to window
        moveToSandboxVariables?.forEach((variable) => {
          code = code
            .replace(
              new RegExp(`(var|let|const)?\\s*\\b${variable}\\b[^\n;]+(\n|;)?`),
              '',
            )
            .replace(new RegExp(`\\b(${variable})\\b`, 'g'), 'window.$1')
        })

        // replace window to qiankunWindow (sandbox)
        code = code.replace(/\bwindow\b/g, 'qiankunWindow()')

        // inject renderWithQiankun to export lifecycles to sandbox
        code = code + 'renderWithQiankun({ mount, bootstrap, unmount });\n'

        // inject appended code
        code = code + (appended || '')

        return code
      }

      if (rewriteAssetsPath) {
        if (assetsPathReplacer) {
          code = assetsPathReplacer(code)
        } else {
          // replace assets path with dev server
          code = code.replace(
            /\/src\/(.*)\.(svg|jp?g|png|webp|gif|ttf|heic|av1|mp4|webm|ogg|mp3|wav|flac|aac|woff2?|eot|ttf|otf)/g,
            isProduction
              ? qiankunName
              : `http://${resolvedConfig.server.host || '127.0.0.1'}:${
                  resolvedConfig.server.port
                }` + '/src/$1.$2',
          )
        }
        return code
      }
    },
  }
}

export default htmlPlugin
