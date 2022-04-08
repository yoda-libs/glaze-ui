import { RouterBase } from './base-router';
import { Pipeline, Middleware } from './pipeline';
import { App, Context, Hooks } from './glaze';

interface RequestHandler {
    (params: ({[key : string]: string})) : Promise<boolean> | void;
}

export class Route {
    public layout: Layout;
    constructor(public path: string, appOrLayout?: App | Layout, public requestHander?: RequestHandler) {
        if (typeof appOrLayout === 'function') {
            this.requestHander = appOrLayout;
            this.layout = null;
            return;
        }
        if (appOrLayout instanceof App) {
            const app = document.createElement('div');
            app.setAttribute('id', appOrLayout.name);
            app.setAttribute('glaze', 'layout-auto-generated');
            this.layout = createLayout(app, {[appOrLayout.name]: appOrLayout});
        } else {
            this.layout = appOrLayout;
        }
    }
}

export type RouterOptions = {
    basePath?: string;
}
export class Router {
    protected router: RouterBase;
    public middlewares: Pipeline<Context>;
    protected prevMatch: any;
    protected routeChangeStack = [];
    protected cancelPrevRouteChange: boolean = false;
    protected prevState: any;
    public onRouteChange: (path: string, querystring?: any) => Promise<void> = null;
    constructor(middlewares: Middleware<Context>[], protected options?: RouterOptions) {
        this.options ={
            basePath: '',
            ...options
        };
        this.options.basePath = this.options.basePath.endsWith('/') ? this.options.basePath.substring(0, this.options.basePath.length-1) : this.options.basePath;

        this.router = new RouterBase();
        this.middlewares = Pipeline<Context>(...middlewares);
    }

    private addBaseUrl(path: string) {
        if (path.startsWith(this.options.basePath ?? '/')) {
            return path;
        }

        if (path === '/') return this.options.basePath;

        return this.options.basePath + path;
    }

    async navigate(path: string, state?: any) {
        console.log('🍩 [router]', 'navigate', {path, state});

        if (!path.startsWith('/')) throw new Error("Path must start with '/'");
        path = this.addBaseUrl(path);

        // prevent same route navigation
        if (this.prevState && path === this.prevState[0] && state === this.prevState[1]) return;

        this.prevState = [path, state];
        return await this.router.pushState(path, state);
    }

    async start() {
        return new Promise<void>(async (resolve) => {
            this.router.always(async (path, querystring) => {
                await this.onRouteChange(path, querystring);
                resolve();
            });
            // push initial route
            await this.navigate(location.pathname, location.search)
        });
    }

    forward() {
        console.log('🍩 [router]', 'forward');

        window.history.forward();
    }

    back() {
        console.log('🍩 [router]', 'back');
        
        this.router.popState();
    }

    public injectRouterInLinks() {
        [...document.getElementsByTagName("a")].forEach(a => {
            if (a.onclick && a.onclick.name !== 'noop') return;
            a.onclick = async (e: any) => {
                var route = e.currentTarget.pathname;
                e.preventDefault();
                await this.navigate(route);
            }
        });
    }
}
export class Layout {
    protected container: Element;
    constructor(public template: Element, public apps: {[key: string]: App}) { }

    async mount(container: Element, props: {[key:string]:any} = {}) {
        this.container = container;
        this.container.appendChild(this.template);
        var appsToLoad = [];
        var readyResolver;
        const ready = new Promise<void>(resolve => {
            readyResolver = resolve;
        });
        for (let key in this.apps) {
            const app = this.apps[key];
            if (!app) throw new Error(`App ${key} not found`);

            const el = container.querySelector(`#${key}`);
            if (!el) throw new Error(`Div ${key} not found in layout template`);

            appsToLoad.push(app.mount(el, props, ready));
        }
        await Promise.all(appsToLoad);
        readyResolver();
        // setTimeout(() => readyResolver(), 10000); //TODO: get back to this
    }

    async unmount() {
        var appsToUnload = [];
        for (let key in this.apps) {
            const app = this.apps[key];
            appsToUnload.push(app.unmount());
        }
        await Promise.all(appsToUnload);
        this.apps ? Object.keys(this.apps).forEach(key => {
            delete this.apps[key].renderedApp;
            delete this.apps[key].container;
        }) : null;
        this.container.removeChild(this.template);
        delete this.container;
    }
}

export const createLayout = (template: any, apps: { [name: string]: App } ) : Layout => {
    return new Layout(template, apps);
};

const mapAppToLayout = (appOrLayout: App | Layout) => {
    var layout;
        if (appOrLayout instanceof App) {
            const app = document.createElement('div');
            app.setAttribute('id', appOrLayout.name);
            app.setAttribute('glaze', 'layout-auto-generated');
            layout = createLayout(app, {[appOrLayout.name]: appOrLayout});
        } else {
            layout = appOrLayout;
        }
    return layout;
}

export const createRoutes = (middlewares: Middleware<Context>[], options?: RouterOptions) => {
    // check for single default route
    if(middlewares.filter(m => typeof m !== 'function').filter((m: any) => m.type === 'defaultRoute').length > 1) throw new Error('Only one default route is allowed');

    // move default route to the end
    const defaultRouteIndex = middlewares.filter(m => typeof m !== 'function').findIndex((m: any) => m.type === 'defaultRoute');
    if (defaultRouteIndex !== -1) {
        const defaultRoute = middlewares.splice(defaultRouteIndex, 1)[0];
        middlewares.push(defaultRoute);
    }

    return new Router(middlewares, options);
}

export const route = (
    path: string,
    appOrLayout?: App | Layout,
    props: { [key: string]: any } | (() => { [key: string]: any }) = () => ({}),
    hooks?: Hooks | (() => Hooks)
) => {
    if (!path.startsWith('/')) throw new Error("Route path must start with '/'");
    var _hooks: Hooks = {};
    if (hooks instanceof Function) _hooks = hooks() as Hooks;
        
    return {
        type: 'route',
        path,
        props,
        hooks: _hooks,
        executor: async (ctx: Context, next) => {
            const layout = mapAppToLayout(appOrLayout);
            if (path === '/' && ctx.path === '/') {
                ctx.matches.push({ score: 100, layout, props, hooks: _hooks });
            } else {
                if (path.substring(1) && ctx.path.toLocaleLowerCase().substring(1).startsWith(path.toLocaleLowerCase().substring(1))) {
                    ctx.matches.push({
                        score: path.length, 
                        layout,
                        props,
                        hooks: _hooks
                    });
                }
            }
            next();
        }
    } as Middleware<Context>;
}

export const defaultRoute = (
    appOrLayout?: App | Layout,
    props: { [key: string]: any } | (() => { [key: string]: any }) = () => ({}),
    hooks?: Hooks | (() => Hooks)
) => {
    var _hooks: Hooks = {};
    if (hooks instanceof Function) _hooks = hooks() as Hooks;
        
    return  {
        type: 'default',
        props,
        hooks: _hooks,
        executor: (ctx: Context, next) => {
            if (ctx.matches.length > 0) return next();

            const layout = mapAppToLayout(appOrLayout);

            ctx.matches.push({
                score: 100, 
                layout,
                props,
                hooks: _hooks
            });
            next();
        }
    } as Middleware<Context>;
}

export const redirectRoute = (
    from: string,
    to: string
) => {
    return {
        type: 'redirect',
        executor: async (ctx: Context, next) => {
            if (ctx.path !== from) return next();
            ctx.redirect(to);
        }
    } as Middleware<Context>;
}