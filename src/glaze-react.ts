const mount = (component, react, reactDOM) => (container: HTMLElement, props) => {
    const div = document.createElement('div');
    div.setAttribute('glaze', 'react-app-wrapper');
    container.appendChild(div);
    const el = react.createElement(component, props);
    reactDOM.render(el, div);
  
    return div;
};
  
const unmount = (reactDOM) => (container: HTMLElement, app: HTMLElement) => {
    reactDOM.unmountComponentAtNode(app);
    container.removeChild(app);
};

export function glazeReact(component, react, reactDOM) {
    return { 
        mount: mount(component, react, reactDOM), 
        unmount: unmount(reactDOM) 
    }
}