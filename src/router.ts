import { RouteHandler, Router as RouterBase } from 'html5-history-router';
import { App } from './glaze';

export class Route {
    public layout: Layout
    constructor(public path: string, appOrLayout: App | Layout) {
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

    async navigate(path: string) {
        return await this.router.pushState(path);
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

    getLayout(path: string) {
        const route = this.routes.filter(x => x.path === path)[0];
        if (!route) return null;
        return route.layout;
    }
}

export class Layout {
    template: any;
    apps: { [name: string]: any }
}

export const route = (
    path: string,
    appOrLayout: App | Layout
) => new Route(path, appOrLayout);

export const createRoutes = (routes: Route[]) => {
    return new Router(routes);
};

export const createLayout = (template: any, apps: { [name: string]: App } ) : Layout => {
    return { template, apps };
};