import { updateTitleAndMeta } from "../../Birdhouse/src/main.js";

export default async function ExampleInputs() {
    updateTitleAndMeta('Example Inputs', 'This is an input example page.');

    return `
    <h1>Example Inputs</h1>
    <label><input type="text" name="exampleInput" placeholder="Type something" required></label>
    <label><input type="email" name="exampleEmail" placeholder="This is an email input" required></label>
    <label><textarea minlength="10" maxlength="50" placeholder="This textarea requires a minimum of 10 characters and has a limit of 50."></textarea></label>
    `;
}