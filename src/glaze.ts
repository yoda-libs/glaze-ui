import { createLayout, route } from ".";

declare var System: any;

export interface Options {
    debug?: boolean;
}

export interface Subscription {
    unsubscribe: () => void;
}

class Glaze {
    protected options?: Options;
    protected observers: Array<(message?: any) => void>;
    protected log: (message?: any, ...optionalParams: any[]) => void;
    public router: any;

    constructor() {
        this.observers = [];

        this.log = (message?, ...optionalParams) => {
            if (this.options.debug) console.log(message, ...optionalParams);
        }
    }

    setOptions(options?: Options) {
        this.options = {
            debug: false,
            ...options
        }
    }
    
    private async loadApps(container: Element, layout: any, params?: any) {
        if (!layout) return;
        for (let key in layout.apps) {
            const app = layout.apps[key];
            const el = container.querySelector(`#${key}`);
            app.renderedApp = await app.mount(el, {name: app.name, glaze: this, ...params});
        }
    }

    private async unloadApps(container: Element, layout: any) {
        if (!layout) return;
        for (let key in layout.apps) {
            const app = layout.apps[key];
            const el = container.querySelector(`#${key}`);
            await app.unmount(el, app.renderedApp);
            delete app.renderedApp;
        }
    }

    private injectRouterInLinks(router: any) {
        [...document.getElementsByTagName("a")].forEach(a => {
            if (a.onclick && a.onclick.name !== 'noop') return;
            a.onclick = (e: any) => {
                var route = e.currentTarget.pathname;
                e.preventDefault();
                router.navigate(route);
            }
        });
    }

    async start(container: Element, resolve: (Glaze) => void, router?) {
        if (!router) return resolve(this);
        this.router = router;
        await router.start(container);

        // push initial route
        await router.navigate(location.pathname, location.search)
        resolve(this);
    }

    dispatch(message?: any) : void {
        this.log('[glaze send]', message);
        this.observers.forEach(observer => {
            observer(message);
        });
    }

    subscribe(observer: (message?: any) => void) : Subscription {
        this.observers.push(observer);
        return {
            unsubscribe: () => {
                this.removeItem(this.observers, observer);
            }
        }
    }

    private removeItem<T>(arr: Array<T>, value: T): Array<T> { 
        const index = arr.indexOf(value);
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
        mount: (container: Element, props?) => Element,
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

export class App {
    protected instance: Bootstrap;
    public renderedApp: Element;;
    constructor(public name: string, public bootstrap: Bootstrap | string) { }

    public async mount(container: Element, props?: any) {
        await this.checkInstance();
        return this.instance.mount(container, {...props, name: this.name, glaze});
    }

    public async unmount(container: Element, app: Element) {
        return this.instance.unmount(container, app);
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

export function app(name: string, bootstrap: Bootstrap | string) : App {
    return new App(name, bootstrap);
}

export function bootstrap(config: BootstrapConfig) : Promise<Glaze> {
    const { container, apps, router, sharedLibs, options } = config;
    if (!container) throw new Error('Container is required');
    glaze.setOptions(options);
    return new Promise((resolve, reject) => {
        var headEl = document.getElementsByTagName('head')[0];
        var bodyEl = document.getElementsByTagName('body')[0];
        var add = (tag, elName, opts, child?) => tag.appendChild(Object.keys(opts).reduce((el, attr) => el.setAttribute(attr, opts[attr]) || el, document.createElement(elName))).append(child || "");

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

        add(headEl, 'script', { src: 'https://cdn.jsdelivr.net/npm/systemjs@6.8.3/dist/system.min.js'});
        // add(headEl, 'script', { src: 'https://cdn.jsdelivr.net/npm/systemjs@6.8.3/dist/extras/amd.min.js'});
        add(headEl, 'script', { src: 'https://cdn.jsdelivr.net/npm/import-map-overrides@2.2.0/dist/import-map-overrides.js'});
        add(bodyEl, 'import-map-overrides-full', { "show-when-local-storage": "devtools", "dev-libs": "" });

        const pageLoaded = async () => {
            try {
                await glaze.start(container, resolve, router);
            } catch (e) {
                reject(e);
            }
            window.removeEventListener('load', pageLoaded);
        };
        window.addEventListener('load', pageLoaded);
    });
}