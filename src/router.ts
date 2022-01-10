import { RouteHandler, RouterBase } from './base-router';
import { Pipeline, Middleware } from './pipeline';
import { App } from './glaze';

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
    public routes: Route[];
    protected pipeline: Pipeline<Context>;
    protected prevLayout: Layout;
    protected routeChangeStack = [];
    protected cancelPrevRouteChange: boolean = false;
    constructor(middlewares: Middleware<Context>[]) {
        this.router = new RouterBase();
        this.pipeline = Pipeline<Context>(...middlewares);
    }

    async navigate(path: string, state?: any) {
        return await this.router.pushState(path, state);
    }

    async start(container: Element) {
        this.router.always(async (path, querystring) => await this.onRouteChange(container)(path, querystring));
    }

    forward() {
        window.history.forward();
    }

    back() {
        this.router.popState();
    }

    executeHandler(route: Route, state: any) {
        if (!route.requestHander) return;
        const urlSearchParams = new URLSearchParams(state);
        const params = state ? Object.fromEntries(urlSearchParams.entries()) : {};
        route.requestHander(params);
    }

    getLayout(path: string) {
        if (!path) return null;
        const route = this.routes.filter(x => x.path === path)[0];
        if (!route || !route.layout) return null;
        return route.layout;
    }

    getRoute(q: any) {
        if (!q) return null;
        const { path } = q;
        const route = this.routes.filter(x => x.path === path)[0];
        return route;
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
            if (this.prevLayout) await this.prevLayout.unloadApps(container);
            delete this.prevLayout;

            const urlSearchParams = new URLSearchParams(querystring);
            const state = querystring ? Object.fromEntries(urlSearchParams.entries()) : {};        
            var context: Context = { path, state, matches: [] };
            await this.pipeline.execute(context);

            if (shouldCancelThisRoute()) return;

            context.matches.sort((a,b) => (a.score > b.score) ? -1 : ((b.score > a.score) ? 1 : 0))
            const match = context.matches[0];
            const { layout } = match;
            if (layout) {
                // cancel previous route change
                cancelPrevRouteChange();
                await layout.loadApps(container);
                this.routeChangeStack = [];
                this.injectRouterInLinks();
            }


            this.prevLayout = layout;
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
        for (let key in this.apps) {
            const app = this.apps[key];
            if (!app) throw new Error(`App ${key} not found`);

            const el = container.querySelector(`#${key}`);
            if (!el) throw new Error(`Div ${key} not found in layout template`);

            appsToLoad.push(app.mount(el, this.template));
        }
        var renderedApps: Element[] = await Promise.all(appsToLoad);
        const keys = Object.keys(this.apps);
        renderedApps.map((renderedApp, index) => this.apps[keys[index]].renderedApp = renderedApp);
    }

    async unloadApps(container: Element) {
        var appsToUnload = [];
        for (let key in this.apps) {
            const app = this.apps[key];
            const el = container.querySelector(`#${key}`);
            appsToUnload.push(app.unmount(el, app.renderedApp));
        }
        await Promise.all(appsToUnload);
        Object.keys(this.apps).forEach(key => delete this.apps[key].renderedApp);
        container.removeChild(this.template);
    }
}

interface RequestHandler {
    (params: ({[key : string]: string})) : Promise<boolean> | void;
}

export const createRoutes = (middlewares: Middleware<Context>[]) => {
    return new Router(middlewares.reverse());
}

type Context = {
    path: string;
    state?: any;
    matches: {score: number, layout: Layout}[];
}

export const route = (
    path: string,
    appOrLayout?: App | Layout
) => {
    return (ctx: Context, next) => {
        if (!ctx.path.startsWith(path)) return next();

        var layout;
        if (appOrLayout instanceof App) {
            const app = document.createElement('div');
            app.setAttribute('id', appOrLayout.name);
            app.setAttribute('glaze', 'layout-auto-generated');
            layout = createLayout(app, {[appOrLayout.name]: appOrLayout});
        } else {
            layout = appOrLayout;
        }

        ctx.matches.push({
            score: path.length, 
            layout
        });
        next();
    }
}

export const createLayout = (template: any, apps: { [name: string]: App } ) : Layout => {
    return new Layout(template, apps);
};

