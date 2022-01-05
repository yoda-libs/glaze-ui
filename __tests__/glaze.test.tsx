/**
 * @jest-environment jsdom
 * @jsx createElement
 */
/// <reference types="@types/jest" /> i
import { bootstrap, createApps, app } from "../src/glaze";
import { createRoutes, route, createLayout } from "../src/router";
import { createElement } from "../src/jsx";

declare var global: any;
declare var System: any;
global.System = ({
    import: (url: string) => Promise.resolve(({
        mount: (container, props) => {
            console.log(`Mounting ${url} to ${container}`);
        },
        unmount: (container, app) => {
            console.log(`Unmounting ${url} from ${container}`);
        }
    }))
});

describe('glaze', () => {
    test('apps can mount and unmount', () => {
        document.body.innerHTML = '<div id="root"></div>';
        const apps = createApps([
            app('login', {
                mount: (container, props) => {
                    const div = <div>rendered login</div>;
                    
                    container.appendChild(div);
                    return div;
                },
                unmount: (container, app) => {
                    container.removeChild(app)
                }
            }),
            app('navbar', 'http://localhost:8183/navbar.js'),
            app('navbar1', System.import('http://localhost:8183/navbar.js')),
        ]);

        bootstrap({
            container: document.getElementById('root'),
            apps,
            options: { debug: true }
        }).then(async _ => {

            const root = document.getElementById('root');
            const loginApp = await apps['login'].mount(root);
            await apps['login'].unmount(root, loginApp);

            const navbarApp = await apps['navbar'].mount(root);
            await apps['navbar'].unmount(root, navbarApp);

            const navbar1App = await apps['navbar'].mount(root);
            await apps['navbar1'].unmount(root, navbar1App);
    
        }).catch(console.error);
        window.dispatchEvent(new Event('load'));
    });

    test('router can works with templates', () => {
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
        const router = createRoutes([
            route('/login', apps['login']),
            route('/', layout),
        ]);

        bootstrap({
            container: document.getElementById('root'),
            apps,
            router
        }).then(async _ => {
            expect(document.querySelector('#root').innerHTML).toBe('<div class="row"><div id="navbar"><div>rendered navbar</div></div><div class="column"><div id="left"><div>rendered left</div></div><div id="right"><div>rendered right</div></div></div></div>');
            await router.navigate('/login');
            expect(document.querySelector('#root').innerHTML).toBe('<app id="login"><div>rendered login</div></app>');    
        }).catch(console.error);
        window.dispatchEvent(new Event('load'));
    });
    it('register shared libs', async () => {
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
            app('navbar', 'http://localhost:8183/navbar.js'),
            app('navbar1', System.import('http://localhost:8183/navbar.js')),
        ]);
        bootstrap({
            container: document.getElementById('root'), 
            apps,
            sharedLibs: {
                "react": "https://unpkg.com/react@17/umd/react.production.min.js",
                "react-dom": "https://unpkg.com/react-dom@17/umd/react-dom.production.min.js",
            }
        }).then(_ => {
            const imports = JSON.parse(document.querySelectorAll('[type="systemjs-importmap"]')[0].innerHTML).imports;
            expect(imports['react']).toBe('https://unpkg.com/react@17/umd/react.production.min.js');
            expect(imports['react-dom']).toBe('https://unpkg.com/react-dom@17/umd/react-dom.production.min.js');
        }).catch(console.error);
    });
});
