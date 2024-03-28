/* 
This is an example of a custom component that can be used within the Birdhouse framework.
*/
import { getQueryParameterByName, updateOrAddQueryParameter, updateTitleAndMeta, alertPopup, action } from "../../Birdhouse/src/main.js";

/**
 * Demonstrates various uses of the action system within Birdhouse to interact with UI elements.
 * It showcases updating page metadata, handling query parameters, and adding event listeners
 * with both global and scoped delegation.
 * 
 * @param {Object} exampleData Data to be used within the component, demonstrating dynamic content.
 * @returns {string} The HTML content of the example component.
 */
export default async function Example(exampleData) {
    updateTitleAndMeta('Example Page', 'This is an example page.');

    action(exampleFunction) // This is an example of how to use the action system to call a function when the html of all components and subcomponents is loaded

    action({
        type: 'click',
        handler: (event) => {
            alertPopup('Button cliked: ', event.target.id);
        },
        selector: '#exampleButton'
    }); // This is an example of how to use the action system to add an delegate event listener to the whole document using the ID of a button as the selector

    action({
        type: 'click',
        handler: (event) => {
            alertPopup('Clicked a button inside a div with class \'.exampleDiv\'');
        },
        selector: 'button',
        container: '.exampleDiv'
    }); // This is an example of how to use the action system to add an delegate event listener to a specific container using a class as the container selector (All buttons inside will trigger the handler)

    action({
        type: 'click',
        handler: (event) => {
            alert('Clicked a button inside a div with id \'#exampleDivWithId\'');
        },
        selector: 'button',
        container: '#exampleDivWithId'
    }); // This is an example of how to use the action system to add an delegate event listener to a specific container using an id as the container selector (All buttons inside will trigger the handler)

    if (exampleData) {
        updateOrAddQueryParameter('example', exampleData);
    }

    return `
    <h1>Example Component</h1>
    <p>This is an example component.</p>
    <p>It is used to demonstrate how to create a custom component.</p>
    ${exampleData ? `<p>We have added a query parameter that should show here: example=${getQueryParameterByName('example')}</p>` : ''}
    <button id="exampleButton">Click me</button>
    <div class="exampleDiv">
        <button>I'm inside an exampleDiv</button>
        <button>I'm inside an exampleDiv too</button>
    </div>
    <div class="exampleDiv" id="exampleDivWithId">
        <button>I'm inside an exampleDiv with the the ID 'exampleDivWithId'</button>
        <button>I'm inside an exampleDiv with the the ID 'exampleDivWithId' too</button>
    </div>
    `;
}

function exampleFunction() {
    console.log('I am called after the component html is loaded');
}