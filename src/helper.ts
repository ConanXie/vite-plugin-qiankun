export interface QiankunProps {
  container?: HTMLElement
  [x: string]: any
}

export type QiankunLifeCycle = {
  bootstrap: (props: QiankunProps) => void | Promise<void>
  mount: (props: QiankunProps) => void | Promise<void>
  unmount: (props: QiankunProps) => void | Promise<void>
  update: (props: QiankunProps) => void | Promise<void>
}

export interface QiankunWindow {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __POWERED_BY_QIANKUN__?: boolean
  [x: string]: any
}

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    __SUB_APP_SANDBOXES__: Map<string, any>
    __QIANKUN_SUB_APP__: any
  }
}

export const qiankunWindow: () => QiankunWindow = () =>
  typeof window !== 'undefined'
    ? window.__SUB_APP_SANDBOXES__.get(window.__QIANKUN_SUB_APP__.name) ||
      window.proxy ||
      window
    : {}

export const renderWithQiankun = (qiankunLifeCycle: QiankunLifeCycle) => {
  // 函数只有一次执行机会，需要把生命周期赋值给全局
  const sandbox = qiankunWindow()
  if (sandbox?.__POWERED_BY_QIANKUN__) {
    if (!window.moudleQiankunAppLifeCycles) {
      window.moudleQiankunAppLifeCycles = {}
    }
    if (sandbox.qiankunName) {
      window.moudleQiankunAppLifeCycles[sandbox.qiankunName] = qiankunLifeCycle
    }
  }
}
