declare var System: any;

export interface Options {
    debug?: boolean;
    baseUrl?: string;
}

export interface Subscription {
    unsubscribe: () => void;
}

class Glaze {
    public readyToDispatch: Promise<void> = null;
    protected readyToDispatchResolver: () => void = null;

    protected options?: Options;
    protected observers: Array<(message?: any) => void>;
    public log: (message?: any, ...optionalParams: any[]) => void;
    public router: any;

    constructor() {
        this.observers = [];
        this.readyToDispatch = new Promise(resolve => {
            this.readyToDispatchResolver = resolve;
        });

        this.log = (message?, ...optionalParams) => {
            if (this.options.debug) console.log('[glaze]', message, ...optionalParams);
        }
    }

    setOptions(options?: Options) {
        this.options = {
            debug: false,
            ...options
        }
    }

    async start(container: Element, resolve: (Glaze) => void, router?, options?: Options) {
        if (!router) return resolve(this);
        this.router = router;
        await router.start(container, options);

        resolve(this);
        this.readyToDispatchResolver();
    }

    getLazyDispatch(ready: Promise<void> = Promise.resolve()) {
        return message => {
            ready.then(() => {
                this.observers.forEach(observer => {
                    observer(message);
                });
            });
        };
    }

    dispatch(message?: any) : void {
        this.log('[glaze send]', message);
        this.readyToDispatch.then(() => {
            this.observers.forEach(observer => {
                observer(message);
            });
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
    public renderedApp: Element;;
    constructor(public name: string, public bootstrap: Bootstrap | string) { }

    public async mount(container: Element, props?: any, ready?: Promise<void>) {
        await this.checkInstance();
        var dispatch = glaze.getLazyDispatch(ready);
        return this.instance.mount(container, {...props, name: this.name, glaze, dispatch});
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
        add(headEl, 'script', { src: 'https://cdn.jsdelivr.net/npm/import-map-overrides@2.2.0/dist/import-map-overrides.js'});
        add(bodyEl, 'import-map-overrides-full', { "show-when-local-storage": "devtools", "dev-libs": "" });

        const pageLoaded = async () => {
            window.removeEventListener('load', pageLoaded);
            try {
                await glaze.start(container, resolve, router, options);
                glaze.log('Framework started');
            } catch (e) {
                reject(e);
            }
        };
        window.addEventListener('load', pageLoaded);
    });
}