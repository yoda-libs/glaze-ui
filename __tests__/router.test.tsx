/**
 * @jest-environment jsdom
 */
/// <reference types="@types/jest" /> i
import { createRoutes, route, createLayout } from "../src/router";
import { app, createApps } from "../src/glaze";

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
  test('test', () => {
    const apps = createApps([
      app('login', {
          mount: (container, props) => {
              const div = document.createElement('div');
              
              container.appendChild(div);
              return div;
          },
          unmount: (container, app) => {
              container.removeChild(app)
          }
      }),
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
    const routes = createRoutes([
      route('/login', apps['login']),
      route('/', layout),
    ]);
  });
})