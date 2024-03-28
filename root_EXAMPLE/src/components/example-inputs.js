/* 
This is an example of how to create a component that demonstrates the usage of various input types.
*/
import { updateTitleAndMeta } from "../../Birdhouse/src/main.js";

/**
 * Demonstrates the creation and usage of various input types within a Birdhouse component.
 * This includes text, email inputs, and a textarea with validation constraints.
 * It also showcases updating page metadata specific to the input example.
 * 
 * @returns {string} The HTML content for the input example component.
 */
export default async function ExampleInputs() {
    updateTitleAndMeta('Example Inputs', 'This is an input example page.');

    return `
    <h1>Example Inputs</h1>
    <label><input type="text" name="exampleInput" placeholder="Type something" required></label>
    <label><input type="email" name="exampleEmail" placeholder="This is an email input" required></label>
    <label><textarea minlength="10" maxlength="50" placeholder="This textarea requires a minimum of 10 characters and has a limit of 50."></textarea></label>
    `;
}