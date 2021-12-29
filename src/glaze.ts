import { Router } from 'html5-history-router';

export interface Options {
    debug?: boolean;
}

export interface App {
    type: 'react' | 'angular' | 'vue' | 'vanilla';
    externalLibs: {};
    name: string;
    url: string;
    container: HTMLElement;
    route?: string;
}

export interface Subscription {
    unsubscribe: () => void;
}

declare var System: any;
const appTypesImports = {
    react: {
        "react": "https://unpkg.com/react@17/umd/react.production.min.js",
        "react-dom": "https://unpkg.com/react-dom@17/umd/react-dom.production.min.js",
    },
    angular: {},
    vue: {},
    vanilla: {}
}


export class Glaze {
    protected options: Options;
    protected apps: Array<App>;
    protected router: Router;
    protected observers: Array<(message?: any) => void>;
    protected log: (message?: any, ...optionalParams: any[]) => void;

    constructor(options) {
        this.options = {
            debug: false,
            ...options
        }
        this.apps = [];
        this.observers = [];
        this.router = new Router();

        this.log = (message?, ...optionalParams) => {
            if (this.options.debug) console.log(message, ...optionalParams);
        }
    }

    bootstrap() : Promise<void> {
        return new Promise((resolve, _) => {
            var headEl = document.getElementsByTagName('head')[0];
            var bodyEl = document.getElementsByTagName('body')[0];
            var add = (tag, elName, opts, child?) => tag.appendChild(Object.keys(opts).reduce((el, attr) => el.setAttribute(attr, opts[attr]) || el, document.createElement(elName))).append(child || "");


            const appTypes = [...new Set(this.apps.map(x => x.type))];

            add(headEl, 'meta', { name: 'importmap-type', content: 'systemjs-importmap'});
            add(headEl, 'script', { type: 'systemjs-importmap' }, JSON.stringify({
                    "imports": {
                        ...appTypes.reduce((obj, type) => ({...obj, ...appTypesImports[type]}), {}),
                        ...this.apps.reduce((obj, item) => ({...obj, [item.name]: item.url}), {})
                    }
                })
            );
            add(headEl, 'script', { src: 'https://cdn.jsdelivr.net/npm/systemjs@6.8.3/dist/system.min.js'});
            add(headEl, 'script', { src: 'https://cdn.jsdelivr.net/npm/systemjs@6.8.3/dist/extras/amd.min.js'});
            add(headEl, 'script', { src: 'https://cdn.jsdelivr.net/npm/import-map-overrides@2.2.0/dist/import-map-overrides.js'});
            add(bodyEl, 'import-map-overrides-full', { "show-when-local-storage": "devtools", "dev-libs": "" });

            window.addEventListener('load', async () => {
                await this.start();
                resolve();
            });
        });
    }

    async start() {
        // push initial route
        this.router.pushState(location.pathname);

        [...document.getElementsByTagName("a")].forEach(a => {
            if (a.onclick) return;
            a.onclick = (e: any) => {
                var route = e.currentTarget.pathname;
                e.preventDefault();
                this.router.pushState(route);
            }
        });

        var routes = [null, null];
        this.router.always(async route => {
            routes.push(route);
            if (routes.length > 2) routes.shift();

            const [from, to] = routes;
            this.log('[router]', {from, to});

            if (from) {
                await Promise.all(this.getAppsByRoute(from).map(app => this.unloadApp(app)));
            }
            if (to) {
                await Promise.all(this.getAppsByRoute(to).map(app => this.loadApp(app)));
            }
        });
    }

    navigate(route) {
        this.router.pushState(route);
    }

    forward() {
        window.history.forward();
    }

    back() {
        this.router.popState();
    }

    dispatch(message?: any) : void {
        this.log('[glaze send]', message);
        this.observers.forEach(observer => {
            observer(message);
        });
    }

    subscribe(observer: (message?: any) => void) : Subscription {
        this.observers.push(observer);
        this.log('Subscribed');
        return {
            unsubscribe: () => {
                this.removeItem(this.observers, observer);
            }
        }
    }

    registerApp(app: App) : void {
        this.apps.push(app);
    }

    private async unloadApp(app) {
        if (!app) return;
        var module = await System.import(app.name);
        this.log('[app] Unmounting', app.name);
        app.container.setAttribute('display', 'none');
        module.default.unmount(app.container);
    }

    private async loadApp(app) {
        if (!app) return;
        var module = await System.import(app.name);
        this.log('[app] Mounting', app.name);
        module.default.mount(app.container, {name: app.name, glaze: this});
        app.container.setAttribute('display', 'block');
    }

    private getAppsByRoute(route) : App[] {
        return this.apps.filter(x => x.route == route);
    }

    private removeItem<T>(arr: Array<T>, value: T): Array<T> { 
        const index = arr.indexOf(value);
        if (index > -1) {
          arr.splice(index, 1);
        }
        return arr;
    }
}