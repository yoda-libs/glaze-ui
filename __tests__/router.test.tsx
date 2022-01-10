/**
 * @jest-environment jsdom
 */
/// <reference types="@types/jest" /> i
import { createRoutes, route, createLayout } from "../src/router";
import { app, createApps, bootstrap } from "../src/glaze";
import { Pipeline } from "../src/pipeline";

const createElement = (tag, props, ...children) => {
  if (typeof tag === "function") return tag(props, ...children);
  const element = document.createElement(tag);

  Object.entries(props || {}).forEach(([name, value]) => {
    if (name.startsWith("on") && name.toLowerCase() in window)
      element.addEventListener(name.toLowerCase().substr(2), value);
    else element.setAttribute(name, value.toString());
  });

  children.forEach(child => {
    appendChild(element, child);
  });

  return element;
};

const appendChild = (parent, child) => {
  if (Array.isArray(child))
    child.forEach(nestedChild => appendChild(parent, nestedChild));
  else
    parent.appendChild(child.nodeType ? child : document.createTextNode(child));
};

describe('test', () => {
  test('new router', () => {
    document.body.innerHTML = '<div id="root"></div>';
    const action = (name) => ({
      mount: (container, props) => {
          const div = <div>rendered {name}</div>;
          
          container.appendChild(div);
          return div;
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
    }).then(async glaze => {
      console.log(document.getElementById('root').innerHTML);
      await router.navigate('/auth', { code: '123' });
      console.log(document.getElementById('root').innerHTML);
    }).catch(console.error);
    window.dispatchEvent(new Event('load'));
  });
});