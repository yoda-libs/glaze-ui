<img src="https://i.imgur.com/IKLECXW.jpg" width="150"></img>
# Glaze UI

<img src="https://www.freepnglogos.com/uploads/discord-logo-png/discord-logo-logodownload-download-logotipos-1.png" width="35" style="vertical-align:middle" />&nbsp;&nbsp;[Join the chat on Discord](https://discord.gg/hB6ketWMrz)
## A framework for front-end microservices (MFE)

Glaze UI is a framework that lets you have multiple micro-frontend applications (MFE) on the same SPA application. That means you can have different frameworks like React, Angular and Vue running side-by-side. Including different versions of the same framework. 

It consists on a [Glaze UI shell application](https://github.com/yoda-libs/create-glaze-ui) that can host multiple MFE applications using different technologies. For example, you can create a [Glaze UI React App](https://github.com/yoda-libs/create-glaze-ui-react).


```js
/** @jsx createElement */
import { 
    createElement, 
    bootstrap, createApps, app, 
    createRoutes, createLayout, route
} from 'glaze-ui';

const apps = createApps([
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

This is a [Node.js](https://nodejs.org/en/) module available through the
[npm registry](https://www.npmjs.com/).
<br/><br/>
## Requirements
[Node.js](https://nodejs.org/en/download/) >=16.10 and yarn.
<br/><br/>
## Installation

To create the [shell application](https://github.com/yoda-libs/create-glaze-ui), run the command below. <br/>For more information, refer to [create-glaze-ui](https://www.npmjs.com/package/create-glaze-ui) npm package.
```bash
yarn create glaze-ui <name>
```

To create a [react micro-front end react app](https://github.com/yoda-libs/create-glaze-ui-react) for glaze, run the command below. <br/>For more information, refer to [create-glaze-ui-react](https://www.npmjs.com/package/create-glaze-ui-react) npm package.
```bash
yarn create glaze-ui-react <app>
```
<br/>

Installation is done using the
[`npm install` command](https://docs.npmjs.com/getting-started/installing-npm-packages-locally):

```bash
$ npm install express
```