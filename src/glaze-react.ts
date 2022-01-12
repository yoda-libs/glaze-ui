const mount = (component, react, reactDOM, hot) => (container: HTMLElement, props: any) => {
    const div = document.createElement('div');
    div.setAttribute('glaze', 'react-app-wrapper');
    container.appendChild(div);
    if (hot) hot(props, div);
    const el = react.createElement(component, props);
    reactDOM.render(el, div);
  
    return div;
};
  
const unmount = (reactDOM) => (container: HTMLElement, app: HTMLElement) => {
    reactDOM.unmountComponentAtNode(app);
    container.removeChild(app);
};


export function glazeReact(component, react, reactDOM, hot) {
    return { 
        mount: mount(component, react, reactDOM, hot), 
        unmount: unmount(reactDOM)
    }
}

