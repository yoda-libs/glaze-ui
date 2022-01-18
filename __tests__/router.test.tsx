/**
 * @jsx createElement
 * @jest-environment jsdom
 */
/// <reference types="@types/jest" /> i
import { createRoutes, route, createLayout } from "../src/router";
import { app, createApps, bootstrap } from "../src/glaze";
import { createElement } from "../src/jsx";

describe('Router tests', () => {
  test('test middlewares', () => {
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
    const apps = createApps([
        app('login', action('login')),
        app('navbar', action('navbar')),
        app('left', action('left')),
        app('right', action('right')),
    ]);
    const layout = createLayout(
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

    const authMiddleware = async (ctx, next) => {
      if (ctx.path.startsWith('/login')) return next();

      const { code } = ctx.state;
      if (!code) return await router.navigate('/login');

      if (ctx.path.startsWith('/auth')) return await router.navigate('/', { code });

      next();
    };
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
});