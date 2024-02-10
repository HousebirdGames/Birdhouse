import { getQueryParameterByName, updateOrAddQueryParameter, updateTitleAndMeta, alertPopup } from "../../birdhouse/src/main.js";

export default async function Example(exampleData) {
    updateTitleAndMeta('Example Page', 'This is an example page.');

    setTimeout(() => {
        setupEventHandlers();
    }, 0); // Set up event handlers like this, so that the page is fully loaded and you can access all elements

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

function setupEventHandlers() {
    // Add event handlers here
    const button = document.getElementById('exampleButton');
    if (button) {
        button.addEventListener('click', () => {
            alertPopup('Button cliked');
        });
    }

    console.log('Event handlers set up');
}