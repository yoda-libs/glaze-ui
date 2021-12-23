const mount = (component, react, reactDOM) => (container: HTMLElement, props) => {
    const element = react.createElement(
      component,
      props
    );
    reactDOM.render(element, container);
};
  
const unmount = (reactDOM) => (container: HTMLElement) => {
    reactDOM.unmountComponentAtNode(container); 
};

export function glazeReact(component, react, reactDOM) {
    return { 
        mount: mount(component, react, reactDOM), 
        unmount: unmount(reactDOM) 
    }
}