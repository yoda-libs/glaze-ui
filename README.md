<img src="https://i.imgur.com/IKLECXW.jpg" width="150"></img>
# Glaze UI

<img src="https://www.freepnglogos.com/uploads/discord-logo-png/discord-logo-logodownload-download-logotipos-1.png" width="35" style="vertical-align:middle" />&nbsp;&nbsp;[Join the chat on Discord](https://discord.gg/hB6ketWMrz)

## A framework for micro front-end services (MFE)

`Glaze UI` is a framework that lets you have multiple Micro Front-End (MFE) applications  on the same Single Page Application (SPA). That means you can have different frameworks like React, Angular and Vue running side-by-side. Including different versions of the same framework. 

It consists on a [Glaze UI shell application](https://github.com/yoda-libs/create-glaze-ui) that can host multiple MFE applications. 
<br/><br/>

## Motivation

`Glaze UI` was designed for the ever changing world of front-end applications that currently face a challenge creating a modular approach and combining different frameworks into a same single page application. 

All other MFE frameworks availabe are complex to use. `Glaze UI` was designed with simplicity in mind, but also functionality and extensibility.
<br/><br/>

## Quick Start

To create the [shell application](https://github.com/yoda-libs/create-glaze-ui), run the command below. <br/>For more information, refer to [create-glaze-ui](https://www.npmjs.com/package/create-glaze-ui) npm package.
```bash
yarn create glaze-ui <name>
```

To create a [react micro-front end react app](https://github.com/yoda-libs/create-glaze-ui-react) for glaze, run the command below. <br/>For more information, refer to [create-glaze-ui-react](https://www.npmjs.com/package/create-glaze-ui-react) npm package.
```bash
yarn create glaze-ui-react <app>
```
<br/><br/>

## Shell Application Example

Here is an example of the shell application `index.jsx` file, registering `navbar` as a MFE React application.


```js
import { 
    bootstrap, 
    createApps, app, 
    createRoutes, route
} from 'glaze-ui';

const apps = createApps([
    // run 'yarn create glaze-ui-react navbar' to create the navbar app
    // run 'cd navbar && yarn start'
    app('navbar', 'http://localhost:8081/navbar.js'),
]);

const router = createRoutes([
    route('/', apps['navbar']),
])

bootstrap({
    container: document.getElementById('root'),
    apps,
    router,
    sharedLibs: {
        'react': 'https://unpkg.com/react@17.0.2/umd/react.production.min.js',
        'react-dom': 'https://unpkg.com/react-dom@17.0.2/umd/react-dom.production.min.js',
    }
}).then(async glaze => {
    // example on how to send a message to all glaze apps
    glaze.dispatch({test: "message"});
}).catch(console.error);
```

## Requirements
[Node.js](https://nodejs.org/en/download/) >=16.10 and yarn.
<br/><br/>


## Table of contents

* [Intro](#a-framework-for-micro-front-end-services-(MFE))
* [Motivation](#motivation)
* [Quick Start](#quick-start)
* [Shell Application Example](#shell-application-example)
* [Requirements](#requirements)
* [Table of Contents](#table-of-contents)
* [Registering Apps](#logging)
  * [createApps](#createapps)
  * [app](#app)
* [Creating Layoutss](#creating-layouts)
  * [createLayout](#createlayout)
* [Registering Routes](#createroutes)
  * [createRoutes](#createroutes)
  * [route](#route)
* [Bootstraping](#bootstraping)
  * [bootstrap](#bootstrap)

<br/>

## Registering Apps
Use `createApps` function to register MFE apps. 

`createApps` takes an array of `app` and returns a `Dictionary` with the app name as the key and the app reference as the value.
```js
const apps = createApps([
    app('navbar', 'http://acme.com/navbar.js'),
])
```
### createApps
* Input:
  * `app[]`: array of `app`.

### app
* Inputs:
  * `name`: (`string`) - the application name.
  * `bootstrap`: (`string | Bootstrap`) - a string or an object with `mount` and `unmount` functions.
    
    _`Bootstrap`_
    ```js
    {
        mount: (container, props) => HTMLElement,
        unmount: (container, app) => void
    }
    ```

  _Examples:_

    Register the `mount` and `unmount` functions.
    ```js
    app('navbar', () => {
        mount: (container, props) => {
            const div = <div>Example MFE app</div>;
            
            container.appendChild(div);
            return div;
        },
        unmount: (container, app) => {
            container.removeChild(app)
        }
    })
    ```

    Use `SystemJS` to load a external module that resolves to an object with `mount` and `unmount` functions similar to the example above.
    ```js
    app('navbar', () => System.import('http://acme.com/navbar.js'))
    ```

    Simplify by using a string that `Glaze UI` will use to call `SystemJS` like the example above.
    ```js
    app('navbar', 'http://acme.com/navbar.js')
    ```
<br/><br/>

## Creating Layouts
Use `createLayout` function to create a layout. Layouts are used in [routes](#registering-routes).
```js
const rootLayout = createLayout(
    <div className="row">
        <div id="navbar" />
        <div id="content">
    </div>,
    {
        navbar: apps['navbar'],
        content: apps['content']
    }
)
```
_Creates a layout an_

### createLayout
* Inputs:
  * `template`: (`html`) - an html template.
    ```html
    <div id="myid" />
    ```
  * `apps`: (`Dictionary`) - a dictionary that maps the html element `id` to a reference of the `app`.

    ```js
    myid: apps['navbar']
    ```

## Registering Routes
Use `createRoutes` function to register routes for MFE apps.
```js
const router = createRoutes([
    route('/', rootLayout),
    route('/login', apps['login']),
])
```

### createRoutes
* Input:
  * `route[]`: array of `route`.

### route
* Inputs:
  * `path`: (`string`) - the route path.
  * `appOrLayout`: (`app` | `layout`) - a reference to an [app](#app) or [layout](#creating-layouts).

  _Examples:_

    Register route with an app reference.
    ```js
    route('/', apps['navbar'])
    ```
    Register route with a layout.
    ```js
    route('/', createLayout(
        <div className="row">
            <div id="navbar"></div>
            <div className="col">
                <div id="left"></div>
                <div id="right"></div>
            </div>
        </div>, {
            navbar: apps['navbar'],
            left: apps['left'],
            right: apps['right'],
        })
    )
    ```

## Bootstraping
Use `bootstrap` function to initialize the library and bootstrap components. Returns a `Promise` that resolves to an instance of `Glaze`.
```js
bootstrap({
    container: document.getElementById('root'),
    apps,
    router,
})
```

### bootstrap
* Inputs:
  * `config`: (`BootstrapConfig`) - the configuration object.
  
      _`BootstrapConfig`_
      * `container`: (`HTMLElement`) - the root html element for Glaze UI to render.
        ```js 
        document.getElementById('root')
        ```
      * `apps`: (`app[]`) - the list of apps. Plese refer to [createApps](#createapps).
      * `router`: (`Router`) - a reference to a router. Please refer to [createRoutes](#createroutes).
      * `sharedLibs`: (`Dictionary`) - a dictionary with library urls to be shared across MFE apps.
        ```js
        {
            'react': 'https://unpkg.com/react@17.0.2/umd/react.production.min.js',
            'react-dom': 'https://unpkg.com/react-dom@17.0.2/umd/react-dom.production.min.js',
        }
        ```
      * `options`: - the options.
        ```js
        { debug: true }
        ```

    _Examples:_
    
    Most trivial example on how to bootstrap.
    ```js
    bootstrap({
        container: document.getElementById('root'),
        apps
    })
    ```
    Bootstrap with a router and dispatches a message after.
    ```js
    bootstrap({
        container: document.getElementById('root'),
        apps,
        router,
    }).then(async glaze => {
        // example on how to send a message to all glaze apps
        glaze.dispatch({test: "message"});
    })
    ```