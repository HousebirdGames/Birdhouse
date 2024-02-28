import { getQueryParameterByName, updateOrAddQueryParameter, updateTitleAndMeta, alertPopup, event } from "../../Birdhouse/src/main.js";

export default async function Example(exampleData) {
    updateTitleAndMeta('Example Page', 'This is an example page.');

    event(exampleFunction) // This is an example of how to use the event system to call a function when the html of all components and subcomponents is loaded

    event({
        type: 'click',
        handler: (event) => {
            alertPopup('Button cliked: ', event.target.id);
        },
        selector: '#exampleButton'
    }); // This is an example of how to use the event system to add an delegate event listener to a button using a selector

    if (exampleData) {
        updateOrAddQueryParameter('example', exampleData);
    }

    return `
    <h1>Example Component</h1>
    <p>This is an example component.</p>
    <p>It is used to demonstrate how to create a custom component.</p>
    ${exampleData ? `<p>We have added a query parameter that should show here: example=${getQueryParameterByName('example')}</p>` : ''}
    <button id="exampleButton">Click me</button>
    `;
}

function exampleFunction() {
    console.log('I am called after the component html is loaded');
}