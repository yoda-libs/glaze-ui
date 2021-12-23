import { Router } from 'html5-history-router';

export interface Options {
    debug?: boolean;
}

export interface App {
    name: string;
    url: string;
    route: string;
    container: HTMLElement;
}

export interface Subscription {
    unsubscribe: () => void;
}

declare var System: any;

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
            console.time('bootstrap');
            var headEl = document.getElementsByTagName('head')[0];
            var bodyEl = document.getElementsByTagName('body')[0];
            var add = (tag, elName, opts, child?) => tag.appendChild(Object.keys(opts).reduce((el, attr) => el.setAttribute(attr, opts[attr]) || el, document.createElement(elName))).append(child || "");

            add(headEl, 'meta', { name: 'importmap-type', content: 'systemjs-importmap'});
            add(headEl, 'script', { type: 'systemjs-importmap' }, JSON.stringify({
                "imports": {
                    "react": "https://cdn.jsdelivr.net/npm/react@16.13.1/umd/react.production.min.js",
                    "react-dom": "https://cdn.jsdelivr.net/npm/react-dom@16.13.1/umd/react-dom.production.min.js",
                    ...this.apps.reduce((acc, curr) => ({...acc, [curr.name]: curr.url}), {})
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
            console.timeEnd('bootstrap');
        });
    }

    private async domLoaded() {
        await this.start();
    }

    async start() {
        // deep linking
        if (location.pathname !== '/') {
            await this.loadApp(this.getAppByRoute(location.pathname));
        }

        [...document.getElementsByTagName("a")].forEach(a => {
            a.onclick = (e: any) => {
                var route = e.currentTarget.pathname;
                e.preventDefault();
                this.router.pushState(route);
            }
        });

        var routes = [null, null];
        this.router.always(route => {
            routes.push(route);
            if (routes.length > 2) routes.shift();

            const [from, to] = routes;
            this.log('[router]', {from, to});

            if (from) {
                this.unloadApp(this.getAppByRoute(from));
            }
            if (to) {
                this.loadApp(this.getAppByRoute(to));
            }
        });
    }

    registerApp(name: string, url: string, route: string, container: HTMLElement) : void {
        this.apps.push({ name, url, route, container });
    }

    async unloadApp(app) {
        if (!app) return;
        var module = await System.import(app.name);
        this.log('[app] Unmounting', app.name);
        module.default.unmount(app.container);
    }

    async loadApp(app) {
        if (!app) return;
        var module = await System.import(app.name);
        this.log('[app] Mounting', app.name);
        module.default.mount(app.container, {name: app.name, glaze: this});
    }

    getAppByRoute(route) : App {
        return this.apps.filter(x => x.route == route)[0];
    }

    private removeItem<T>(arr: Array<T>, value: T): Array<T> { 
        const index = arr.indexOf(value);
        if (index > -1) {
          arr.splice(index, 1);
        }
        return arr;
    }

    dispatch(message?: any) : void {
        this.log('Dispatching', message);
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
}
