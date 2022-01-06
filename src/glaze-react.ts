const mount = (component, react, reactDOM) => (container: HTMLElement, props) => {
    const div = document.createElement('div');
    div.setAttribute('glaze', 'react-app-wrapper');
    container.appendChild(div);
    reactDOM.render(react.createElement(component, props), div);
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