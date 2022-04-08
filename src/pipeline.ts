type Next = () => Promise<void> | void

export type Middleware<T> = {
  type: 'custom' | 'route' | 'default' | 'redirect',
  executor: (context: T, next: Next) => Promise<void> | void
} | ((any, Next) => Promise<void> | void);

export type Pipeline<T> = {
  push: (...middlewares: Middleware<T>[]) => void
  execute: (context: T) => Promise<void>
  middlewares: Middleware<T>[]
}

export function Pipeline<T>(...middlewares: Middleware<T>[]): Pipeline<T> {
  const stack: Middleware<T>[] = middlewares

  const push: Pipeline<T>['push'] = (...middlewares) => {
    stack.push(...middlewares.map(middleware => (typeof middleware === 'function' ? { name: 'custom', executor: middleware } : middleware) as Middleware<T>));
  }

  const execute: Pipeline<T>['execute'] = async (context) => {
    let prevIndex = -1

    const runner = async (index: number): Promise<void> => {
      if (index === prevIndex) {
        throw new Error('next() called multiple times')
      }

      prevIndex = index

      const middleware = stack[index]

      if (middleware) {
        await (middleware as { executor }).executor(context, () => {
          return runner(index + 1)
        })
      }
    }

    await runner(0)
  }

  return { push, execute, middlewares: stack }
}