import { RouteHandler, RouterBase } from './base-router';
import { App } from './glaze';

export class Route {
    public layout: Layout;
    constructor(public path: string, appOrLayout?: App | Layout, public requestHander?: RequestHandler) {
        if (typeof appOrLayout === 'function') {
            this.requestHander = appOrLayout;
            this.layout = null;
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
    constructor(routes: Route[]) {
        this.router = new RouterBase();
        this.routes = routes;
    }

    async navigate(path: string, state?: any) {
        return await this.router.pushState(path, state);
    }

    forward() {
        window.history.forward();
    }

    back() {
        this.router.popState();
    }

    subscribe(callback: RouteHandler) {
        this.router.always(callback);
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
}

export class Layout {
    template: any;
    apps: { [name: string]: any }
}

interface RequestHandler {
    (params: ({[key : number]: string})) : void;
}

export const route = (
    path: string,
    appOrLayout?: App | Layout,
    requestHandler?: RequestHandler
) => new Route(path, appOrLayout, requestHandler);


export const createRoutes = (routes: Route[]) => {
    return new Router(routes);
};

export const createLayout = (template: any, apps: { [name: string]: App } ) : Layout => {
    return { template, apps };
};

