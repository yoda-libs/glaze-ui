/**
 * @jsx createElement
 * @jest-environment jsdom
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
                    const div = (<div>rendered login</div>) as any;
                    
                    container.appendChild(div);
                    return div;
                },
                unmount: (container, app) => {
                    container.removeChild(app)
                }
            }),
        ]);

        bootstrap({
            container: document.getElementById('root'),
            apps
        }).then(async _ => {

            const root = document.getElementById('root');

            const loginApp = await apps['login'].mount(root);
            expect(root.innerHTML).toBe('<div>rendered login</div>');
            await apps['login'].unmount();
            expect(root.innerHTML).toBe('');
    
        }).catch(console.error);
        window.dispatchEvent(new Event('load'));
    });

    test('router can work with templates', async () => {
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
        const router = createRoutes([
            route('/login', apps['login']),
            route('/', layout),
        ]);

        await bootstrap({
            container: document.getElementById('root'),
            apps,
            router
        });
        expect(document.querySelector('#root').innerHTML).toBe('<div class="row"><div id="navbar"><div>rendered navbar</div></div><div class="column"><div id="left"><div>rendered left</div></div><div id="right"><div>rendered right</div></div></div></div>');
        await router.navigate('/login').catch(e => {
            console.error(e.message);
        });
        expect(document.querySelector('#root').innerHTML).toBe('<div id=\"login\" glaze=\"layout-auto-generated\"><div>rendered login</div></div>');
    });

    test('register shared libs', () => {
        document.body.innerHTML = '<div id="root1"></div>';
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
            container: document.getElementById('root1'), 
            apps,
            sharedLibs: {
                "test": "lib",
            }
        }).then(_ => {
            const imports = JSON.parse(document.head.querySelectorAll('script[type="systemjs-importmap"]')[0].innerHTML).imports;
            expect(imports['test']).toBe('lib');
        }).catch(console.error);
    });
});
