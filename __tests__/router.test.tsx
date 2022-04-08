/**
 * @jsx createElement
 * @jest-environment jsdom
 */
/// <reference types="@types/jest" /> i
import { createRoutes, route, createLayout } from "../src/router";
import { app, createApps, bootstrap } from "../src/glaze";
import { createElement } from "../src/jsx";

var apps, layout, authMiddleware;
describe('Router tests', () => {
  beforeAll(() => {
    document.body.innerHTML = '<div id="root"></div>';
    const action = (name) => ({
      mount: (container, props) => {
          const div = <div>rendered {name}</div>;
          
          container.appendChild(div);
          return div as any;
      },
      unmount: (container, app) => {
          container.removeChild(app)
      }
    });
    apps = createApps([
        app('login', action('login')),
        app('navbar', action('navbar')),
        app('left', action('left')),
        app('right', action('right')),
    ]);

    layout = createLayout(
      <div className="row">
        <div id="navbar"></div>
        <div className="column">
          <div id="left"></div>
          <div id="right"></div>
        </div>
      </div>
    , {
      navbar: apps['navbar'],
      left: apps['left'],
      right: apps['right'],
    });

    authMiddleware = async (ctx, next) => {
      if (ctx.path.startsWith('/login')) return next();

      const { code } = ctx.state;
      if (!code) return await ctx.redirect('/login');

      if (ctx.path.startsWith('/auth')) return await ctx.redirect('/', { code });

      next();
    };
  });

  test('test middlewares', () => {
    const router = createRoutes([
      authMiddleware,
      route('/', layout),
      route('/login', apps['login']),
    ]);

    bootstrap({
      container: document.getElementById('root'),
      apps,
      router
    }).then(async _ => {
      expect(document.getElementById('root').innerHTML).toBe('<div id="login" glaze="layout-auto-generated"><div>rendered login</div></div>');
      await router.navigate('/auth', { code: '123' });
      expect(document.getElementById('root').innerHTML).toBe('<div class="row"><div id="navbar"><div>rendered navbar</div></div><div class="column"><div id="left"><div>rendered left</div></div><div id="right"><div>rendered right</div></div></div></div>');
    }).catch(console.error);
    window.dispatchEvent(new Event('load'));
  });
  test('test route start with slash', () => {
    expect(() => {
      createRoutes([
        route('', layout),
      ]);
    }).toThrow();
  });

  test('test route start with slash', () => {
    expect(() => {
      createRoutes([
        route('', layout),
      ]);
    }).toThrow();
  });

  test('test base path', () => {
    const router = createRoutes([
      route('/', layout),
      route('/login', apps['login']),
    ], {
      basePath: '/base'
    });

    bootstrap({
      container: document.getElementById('root'),
      apps,
      router
    }).then(_ => {
      expect(window.location.pathname).toBe('/base');
    }).catch(console.error);
    window.dispatchEvent(new Event('load'));
  });

  test('test base path ending with /', () => {
    const router = createRoutes([
      route('/', layout),
      route('/login', apps['login']),
    ], {
      basePath: '/base/'
    });

    bootstrap({
      container: document.getElementById('root'),
      apps,
      router
    }).then(_ => {
      expect(window.location.pathname).toBe('/base');
    }).catch(console.error);
    window.dispatchEvent(new Event('load'));
  });
  
  test('test base path with auth middleware', () => {
    const router = createRoutes([
      authMiddleware,
      route('/', layout),
      route('/login', apps['login']),
    ], {
      basePath: '/base'
    });

    bootstrap({
      container: document.getElementById('root'),
      apps,
      router
    }).then(_ => {
      expect(window.location.pathname).toBe('/base/login');
    }).catch(console.error);
    window.dispatchEvent(new Event('load'));
  });
  
  test('test hooks', () => {
    const afterUnmount = jest.fn(() => {
      expect(layoutUnmountSpy).toHaveBeenCalled();
    });
    const beforeUnmount = jest.fn(() => {
      expect(afterUnmount).not.toHaveBeenCalled();
      expect(layoutUnmountSpy).not.toHaveBeenCalled();
    });
    const afterMount = jest.fn(() => {
      expect(beforeMount).toHaveBeenNthCalledWith(1);
      expect(layoutMountSpy).toHaveBeenCalled();
    });
    const beforeMount = jest.fn(() => {
      expect(afterMount).not.toHaveBeenNthCalledWith(1);
      expect(layoutMountSpy).not.toHaveBeenCalled();
    });
    const layoutMountSpy = jest.spyOn(layout, 'mount');
    const layoutUnmountSpy = jest.spyOn(layout, 'unmount');
    const router = createRoutes([
      route('/', layout, () => ({
        beforeMount,
        afterMount,
        beforeUnmount,
        afterUnmount,
      })),
      route('/login', apps['login']),
    ], { basePath: '/base' });

    bootstrap({
      container: document.getElementById('root'),
      apps,
      router
    }).then(async _ => {
      await router.navigate('/login');
    }).catch(console.error);
    window.dispatchEvent(new Event('load'));
  });
});