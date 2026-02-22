/**
 * Shim for troika-worker-utils that always executes on the main thread.
 *
 * Chrome Manifest V3 extensions block blob: URLs in both script-src and
 * worker-src CSP directives. Troika's default implementation creates
 * inline workers via blob: URLs, which silently fail — the Worker
 * constructor succeeds but internal importScripts(blob:...) calls are
 * blocked, corrupting the init chain.
 *
 * This shim replaces defineWorkerModule with the main-thread fallback
 * so all text layout runs synchronously on the main thread.
 */

/**
 * Main-thread implementation. Resolves dependencies and calls init
 * synchronously (well, via microtask). Raw function dependencies are
 * passed through as-is — exactly what the caller's init() expects.
 */
function defineMainThreadModule(options: any) {
  const moduleFunc: any = function (...args: any[]) {
    return moduleFunc._getInitResult().then((initResult: any) => {
      if (typeof initResult === 'function') {
        return initResult(...args);
      } else {
        throw new Error(
          'Worker module function was called but `init` did not return a callable function'
        );
      }
    });
  };

  moduleFunc._getInitResult = function () {
    const { dependencies, init } = options;

    // Resolve dependencies:
    // - Worker modules → use their .onMainThread fallback
    // - Raw functions → pass through as-is (the caller's init expects them)
    // - Primitives → pass through
    const resolved = Array.isArray(dependencies)
      ? dependencies.map((dep: any) => {
          if (dep) {
            dep = dep.onMainThread || dep;
            if (dep._getInitResult) {
              dep = dep._getInitResult();
            }
          }
          return dep;
        })
      : [];

    const initPromise = Promise.all(resolved).then((deps) => {
      return init.apply(null, deps);
    });

    // Cache for subsequent calls
    moduleFunc._getInitResult = () => initPromise;
    return initPromise;
  };

  return moduleFunc;
}

export function defineWorkerModule(options: any) {
  if (!options || typeof options.init !== 'function') {
    throw new Error('requires `options.init` function');
  }

  const mainThread = defineMainThreadModule(options);

  const moduleFunc: any = function (...args: any[]) {
    return mainThread(...args);
  };

  moduleFunc.onMainThread = mainThread;
  moduleFunc._getInitResult = mainThread._getInitResult;
  moduleFunc.workerModuleData = {
    isWorkerModule: true,
    id: `shim_${Math.random().toString(36).slice(2)}`,
    name: options.name || 'unnamed',
  };

  return moduleFunc;
}

export function stringifyFunction(fn: Function): string {
  let str = fn.toString();
  if (!/^function/.test(str) && /^\w+\s*\(/.test(str)) {
    str = 'function ' + str;
  }
  return str;
}

export function terminateWorker(_workerId?: string): void {
  // No-op: no workers to terminate
}
