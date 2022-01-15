import { RouterBase } from './base-router';
import { Pipeline, Middleware } from './pipeline';
import { App, Options } from './glaze';

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

export class Router {
    protected router: RouterBase;
    protected pipeline: Pipeline<Context>;
    protected prevLayout: Layout;
    protected routeChangeStack = [];
    protected cancelPrevRouteChange: boolean = false;
    protected baseUrl: string;
    constructor(middlewares: Middleware<Context>[]) {
        this.router = new RouterBase();
        this.pipeline = Pipeline<Context>(...middlewares);
    }

    private addBaseUrl(path: string) {
        if (!path.startsWith('/')) return path;
        return this.baseUrl + path;
    }

    async navigate(path: string, state?: any) {
        path = this.addBaseUrl(path);
        return await this.router.pushState(path, state);
    }

    async start(container: Element, options?: Options) {
        this.baseUrl = options?.baseUrl || '';
        this.baseUrl.endsWith('/') ? this.baseUrl.substring(this.baseUrl.length-1) : this.baseUrl;
        this.router.always(async (path, querystring) => await this.onRouteChange(container)(path, querystring));
    }

    forward() {
        window.history.forward();
    }

    back() {
        this.router.popState();
    }

    private injectRouterInLinks() {
        [...document.getElementsByTagName("a")].forEach(a => {
            if (a.onclick && a.onclick.name !== 'noop') return;
            a.onclick = async (e: any) => {
                var route = e.currentTarget.pathname;
                e.preventDefault();
                await this.navigate(route);
            }
        });
    }
    
    private onRouteChange(container: Element) : (path: string, querystring?: any) => Promise<void> {
        const func = (cancelPrevRouteChange: () => void, shouldCancelThisRoute: () => boolean) => async (path: string, querystring?: any) => {    
            const urlSearchParams = new URLSearchParams(querystring);
            const state = querystring ? Object.fromEntries(urlSearchParams.entries()) : {};        
            var context: Context = { path, state, matches: [] };
            await this.pipeline.execute(context);

            if (shouldCancelThisRoute()) return;

            context.matches.sort((a,b) => (a.score > b.score) ? -1 : ((b.score > a.score) ? 1 : 0))
            const match = context.matches[0];
            const { layout } = match;

            // unload previous layout
            if (this.prevLayout) {
                await this.prevLayout.unloadApps(container);
                this.prevLayout = null;
            }

            // load new layout
            if (layout) {
                // cancel previous route change
                cancelPrevRouteChange();
                await layout.loadApps(container);
                this.prevLayout = layout;
                this.routeChangeStack = [];
                this.injectRouterInLinks();
            }
        };
        
        return new RouteChange(this.routeChangeStack, func).run;
    }
}

class RouteChange {
    private cancelRoute = false;
    public run: (path: string, state?: any) => Promise<void>;
    constructor(public routeChangeStack: any[], public func: (cancelPrevRouteChange: () => void, shouldCancelThisRoute: () => boolean) => (path: string, state?: any) => Promise<void>) {
        this.run =  this.func(() => {
            // cancel previous route change
            while (this.routeChangeStack.length > 1) {
                const routeChange = this.routeChangeStack.shift();
                routeChange.cancel();
            }
        }, () => this.cancelRoute);
        routeChangeStack.push(this);
    }

    public cancel() {
        this.cancelRoute = true;
    }
}

export class Layout {
    constructor(public template: Element, public apps: {[key: string]: App}) { }

    async loadApps(container: Element) {
        container.appendChild(this.template);
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

            appsToLoad.push(app.mount(el, this.template, ready));
        }
        var renderedApps: Element[] = await Promise.all(appsToLoad);
        const keys = this.apps ? Object.keys(this.apps) : [];
        renderedApps.map((renderedApp, index) => this.apps[keys[index]].renderedApp = renderedApp);
        setTimeout(() => readyResolver(), 10); //TODO: get back to this
    }

    async unloadApps(container: Element) {
        var appsToUnload = [];
        for (let key in this.apps) {
            const app = this.apps[key];
            const el = container.querySelector(`#${key}`);
            appsToUnload.push(app.unmount(el, app.renderedApp));
        }
        await Promise.all(appsToUnload);
        this.apps ? Object.keys(this.apps).forEach(key => delete this.apps[key].renderedApp) : null;
        container.removeChild(this.template);
    }
}

interface RequestHandler {
    (params: ({[key : string]: string})) : Promise<boolean> | void;
}

type Context = {
    path: string;
    state?: any;
    matches: {score: number, layout: Layout}[];
}

export const createRoutes = (middlewares: (Middleware<Context> | ((any, Next) => Promise<void> | void))[]) => {
    var newMiddlewares = middlewares.map(middleware => (typeof middleware === 'function' ? { name: 'custom', executor: middleware } : middleware) as Middleware<Context>);

    // check for single default route
    if(newMiddlewares.filter(m => m.type === 'defaultRoute').length > 1) throw new Error('Only one default route is allowed');

    // move default route to the end
    const defaultRouteIndex = newMiddlewares.findIndex(m => m.type === 'defaultRoute');
    if (defaultRouteIndex !== -1) {
        const defaultRoute = newMiddlewares.splice(defaultRouteIndex, 1)[0];
        newMiddlewares.push(defaultRoute);
    }

    return new Router(newMiddlewares);
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

export const route = (
    path: string,
    appOrLayout?: App | Layout
) => {
    return {
        type: 'route',
        executor: (ctx: Context, next) => {
            const layout = mapAppToLayout(appOrLayout);
            if (path === '/' && ctx.path === '/') {
                ctx.matches.push({ score: 100, layout });
            } else {
                if (path.substring(1) && ctx.path.toLocaleLowerCase().substring(1).startsWith(path.toLocaleLowerCase().substring(1))) {
                    ctx.matches.push({
                        score: path.length, 
                        layout
                    });
                }
            }
            next();
        }
    }
}

export const defaultRoute = (appOrLayout?: App | Layout) => {
    return  {
        type: 'defaultRoute',
        executor: (ctx: Context, next) => {
            if (ctx.matches.length > 0) return next();

            const layout = mapAppToLayout(appOrLayout);

            ctx.matches.push({
                score: 100, 
                layout
            });
            next();
        }
    }
}