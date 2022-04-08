declare var System: any;

export interface Options {
    debug?: boolean;
    baseUrl?: string;
    manuallyStartRouter?: boolean;
    warnings?: {
        subscriptions?: boolean;
    };
}

export interface Subscription {
    unsubscribe: () => void;
}

interface Observer {
    (message?: any): void;
}

export type Hooks = {
    beforeMount?: (props: any) => Promise<void> | void;
    afterMount?: (props: any) => Promise<void> | void;
    beforeUnmount?: () => Promise<void> | void;
    afterUnmount?: () => Promise<void> | void;
}

export type Context = {
    path: string;
    state?: any;
    redirect: (path: string, state?: any) => Promise<boolean | void>;
    matches: {score: number, layout: any, props: any | Promise<any>, hooks?: Hooks}[];
}

function getFullTimestamp(date) {
    const pad = (n,s=2) => (`${new Array(s).fill(0)}${n}`).slice(-s);
    const d = new Date(date);
    
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(),3)}`;
}

function arraysEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;
  
    // If you don't care about the order of the elements inside
    // the array, you should sort both arrays here.
    // Please note that calling sort on an array will modify that array.
    // you might want to clone your array first.
  
    for (var i = 0; i < a.length; ++i) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

class CancellableRouteChange {
    private cancelRoute = false;
    public run: (path: string, state?: any) => Promise<void>;
    constructor(
        routeChangeStack: any[], 
        func: (
                cancelPrevRouteChange: () => void, 
                shouldCancelThisRoute: () => boolean
            ) => (path: string, state?: any) => Promise<void>
        ) {
                this.run = func(() => {
                            // cancel previous route change
                            while (routeChangeStack.length > 1) {
                                const routeChange = routeChangeStack.shift();
                                routeChange.cancel();
                            }
                    }, () => this.cancelRoute);
            routeChangeStack.push(this);
    }

    public cancel() {
        this.cancelRoute = true;
    }
}

class Glaze {
    public readyToDispatch: Promise<void> = null;
    protected readyToDispatchResolver: () => void = null;

    protected container: Element;
    protected options?: Options;
    protected subs: {app: string, observer: Observer}[];
    protected log: (message?: any, ...optionalParams: any[]) => void;
    protected warn: (message?: any, ...optionalParams: any[]) => void;
    protected grouped: (label, func, options?) => void;
    public router: any;
    protected prevMatch: any;
    protected routeChangeStack = [];
    public stack = [];

    constructor() {
        this.subs = [];
        this.readyToDispatch = new Promise(resolve => {
            this.readyToDispatchResolver = resolve;
        });

        this.log = (message?, ...optionalParams) => {
            if (this.options.debug) console.log('🍩', message, ...optionalParams);
        }

        this.warn = (message?, ...optionalParams) => {
            if (this.options.debug) console.warn('🍩', message, ...optionalParams);
        }

        this.grouped = (label, func, options = { collapsed: true }) => {
            if (!this.options.debug) return;
            options.collapsed ? console.groupCollapsed('🍩 ' + label) : console.group('🍩 ' + label);
            func();
            console.groupEnd();
        }
    }

    setOptions(container: Element, options?: Options) {
        this.container = container;
        const defaultOptions = {
            debug: false,
            baseUrl: '',
            warnings: {
                subscriptions: true
            }
        };
        this.options = {
            ...defaultOptions,
            ...options,
            warnings: {
                ...defaultOptions.warnings,
                ...options?.warnings
            }
        }
    }

    private onRouteChange = new CancellableRouteChange(this.routeChangeStack, (cancelPrevRouteChange: () => void, shouldCancelThisRoute: () => boolean) => async (path: string, querystring?: any) => {
        path = path.replace(this.router.options.basePath, '');
        if (path === '') path = '/';
        
        const urlSearchParams = new URLSearchParams(querystring);
        const state = querystring ? Object.fromEntries(urlSearchParams.entries()) : {};        
        var context: Context = { path, state, matches: [], redirect: (path: string, state?: any) => this.router.navigate(path, state) };
        await this.router.middlewares.execute(context);

        if (shouldCancelThisRoute()) return;

        context.matches.sort((a,b) => (a.score > b.score) ? -1 : ((b.score > a.score) ? 1 : 0))
        const match = context.matches[0];
        if (!match) return;
        let { layout, hooks, props } = match;

        props = typeof props === 'function' ? await props() : props;

        // ignore if we are already in the same route
        // this allows apps to implement their own sub routing
        if (this.prevMatch && arraysEqual(
            Object.keys(this.prevMatch.layout.apps).sort(), 
            Object.keys(layout.apps).sort())) return;

        // unload previous layout
        if (this.prevMatch) {
            if (this.prevMatch?.hooks?.beforeUnmount) await this.prevMatch.hooks.beforeUnmount();
            await this.prevMatch.layout.unmount(this.container);
            // await Promise.all(this.stack.map(([_, {app}]) => {
            //     app.unmount();
            // }));    
            if (this.prevMatch?.hooks?.afterUnmount) await this.prevMatch.hooks.afterUnmount();
            this.prevMatch = null;
        }

        // load new layout
        if (layout) {
            // cancel previous route change
            cancelPrevRouteChange();
            if (hooks?.beforeMount) await hooks.beforeMount(props);
            await layout.mount(this.container, props);
            if (hooks?.afterMount) await hooks.afterMount(props)
            this.prevMatch = match;
            this.routeChangeStack = [];
            this.router.injectRouterInLinks();
        }
    }).run.bind(this);

    async start(options: Options, router?) {
        if (!router) return;
        this.router = router;
        this.router.onRouteChange = this.onRouteChange;
        if (!options.manuallyStartRouter) await router.start(this.readyToDispatchResolver);

        this.log('[framework] started succesfully ✅');
    }

    getLazyDispatch(app: string, ready: Promise<void> = Promise.resolve()) {
        return message => {
            ready.then(() => {
                this.log(`[${app}] 📭 send`, message);
                this.subs.forEach(sub => {
                    // send messages without blocking
                    setTimeout(() => {
                        try {
                            sub.observer({ app, message });
                            this.log(`[${sub.app}] 📬 recv`, message);
                        } catch (error) {
                            this.warn(`[${sub.app}] 📭 recv error`, error.message, {error});
                        }
                    });
                });
            });
        };
    }

    dispatch(message?: any) : void {
        this.getLazyDispatch('glaze')(message);
    }

    public subscribe(observer: Observer) : Subscription {
        return this._subscribe('glaze', observer);
    }

    getSubscribe(app: string) {
        return (observer: Observer) => {
            this.log('[events]', {app}, 'subscribed');
            return this._subscribe(app, observer);
        }
    }

    private unsubscribe(app: string, observer: Observer) {
        this.log('[events]', {app}, 'unsubscribed');
        this.removeObserver(this.subs, observer);
    }

    private _subscribe(app: string, observer: Observer) : Subscription {
        this.subs.push({app, observer});
        
        // warn for possible memory leak
        if (this.options.warnings.subscriptions) {
            this.subs.filter(x => x.app === app).length > 20 && this.warn('[events]', {app}, `🚨warning🚨: possible memory leak. Did you forget to unsubscribe?\nGlaze has noticed that '${app}' app has more than 20 subscriptions.`);
        }

        return {
            unsubscribe: () => this.unsubscribe(app, observer)
        };
    }

    private removeObserver(arr: Array<{app: string, observer: Observer}>, observer: Observer): Array<{app: string, observer: Observer}> {
        const index = arr.findIndex(item => item.observer === observer);
        if (index > -1) {
          arr.splice(index, 1);
        }
        return arr;
    }
}

const glaze = new Glaze();
export interface BootstrapConfig {
    container: Element, 
    apps: Apps, 
    router?, 
    sharedLibs?: { [name: string]: string }, 
    options?: Options
}

interface Dictionary<T> {
    [Key: string]: T;
}

interface Bootstrap {
        mount: (container: Element, props?: any) => Element,
        unmount: (container: Element, app: Element) => void
}
class Apps implements Dictionary<App> {
    [Key: string]: App;
    constructor(...apps: App[]) {
        apps.forEach(app => {
            if (this[app.name]) throw new Error(`App ${app.name} already exists`);
            this[app.name] = app;
        });
    }
}

export const blankApp = {
    mount: () => {},
    unmount: () => {},
};

export class App {
    protected instance: Bootstrap;
    public container: Element;
    public renderedApp: Element;
    constructor(public name: string, public bootstrap: Bootstrap | string, public data: any = {}) {}

    public async mount(container: Element, props?: any, ready?: Promise<void>) {
        if (!container) throw new Error('Container is not defined');
        await this.checkInstance();
        const [ router, dispatch, subscribe ] = [glaze.router, glaze.getLazyDispatch.bind(glaze)(this.name, ready), glaze.getSubscribe.bind(glaze)(this.name)];
        const newGlaze = {router, dispatch, subscribe};
        this.container = container;
        this.renderedApp = this.instance.mount(container, {...props, name: this.name, glaze: newGlaze});
        glaze.stack.push([Date.now(), { app: this, container }]);
        glaze['grouped'](`[${this.name}] mounted - App Stack (${glaze.stack.length}) ⤵️`, () => {
            glaze.stack.sort(([a, _], [b, __]) => b - a).forEach(([ts, {app: { name }, container}]) => console.log(getFullTimestamp(ts), {app: name, container}));
        });
    }

    public async unmount() {
        await this.checkInstance();
        await this.instance.unmount(this.container, this.renderedApp);
        glaze.stack = glaze.stack.filter(([_, stack]) => stack.app.name !== this.name);
        glaze['grouped'](`[${this.name}] unmounted - App Stack (${glaze.stack.length}) ⤵️`, () => {
            glaze.stack.sort(([a, _], [b, __]) => b - a).forEach(([ts, {app: { name }, container}]) => console.log(getFullTimestamp(ts), {app: name, container}));
        });
    }

    private async checkInstance() {
        if (this.instance) return this.instance;

        if (typeof this.bootstrap === 'string') {
            this.bootstrap = await System.import(`@glaze/${this.name}`);
        } else if (typeof this.bootstrap === 'function') {
            this.bootstrap = (this.bootstrap as () => Bootstrap)();
        } else {
            this.bootstrap = this.bootstrap;
        }
        if (this.bootstrap instanceof Promise) this.bootstrap = await this.bootstrap;
        this.instance = this.bootstrap as Bootstrap;
    }
}

export function createApps(apps: App[]) : Apps {
    return new Apps(...apps);
}

export function app(name: string, bootstrap: Bootstrap | string, data?: any) : App {
    return new App(name, bootstrap, data);
}

export function bootstrap(config: BootstrapConfig) : Promise<Glaze> {
    const { container, apps, router, sharedLibs, options = { } } = config;
    if (!container) throw new Error('Container is required');
    glaze.setOptions(container, options);
    return new Promise(async (resolve, reject) => {
        var headEl = document.getElementsByTagName('head')[0];
        var bodyEl = document.getElementsByTagName('body')[0];
        var add = (tag, elName, opts, child?) => tag.appendChild(Object.keys(opts).reduce((el, attr) => el.setAttribute(attr, opts[attr]) || el, document.createElement(elName))).append(child || "");

        add(headEl, 'script', { src: 'https://cdn.jsdelivr.net/npm/import-map-overrides@2.2.0/dist/import-map-overrides.js', async: '' });
        add(headEl, 'meta', { name: 'importmap-type', content: 'systemjs-importmap'});
        add(headEl, 'script', { type: 'systemjs-importmap' }, JSON.stringify({
                "imports": {
                    ...sharedLibs,
                    ...Object.keys(apps)
                        .filter(key => typeof apps[key].bootstrap === 'string')
                        .reduce((obj, key) => ({...obj, [`@glaze/${apps[key].name}`]: apps[key].bootstrap || "#"}), {}),
                }
            })
        );

        add(headEl, 'script', { src: 'https://cdn.jsdelivr.net/npm/systemjs@6.8.3/dist/system.min.js', async: ''});
        add(bodyEl, 'import-map-overrides-full', { "show-when-local-storage": "devtools", "dev-libs": "" });

        // hack to wait for systemjs to load
        console.time('🍩 Loading SystemJS');
        while(!(window as any).System) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        console.timeEnd('🍩 Loading SystemJS');
        try {
            await glaze.start(options, router);
            resolve(glaze);
        } catch (e) {
            reject(e);
        }
    });
}