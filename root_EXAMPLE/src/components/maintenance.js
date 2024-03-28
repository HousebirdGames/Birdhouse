/*
This component is displayed when the website is undergoing maintenance.
It provides a simple message to inform users that the website is currently unavailable
and prompts them to return later. This is a static component, returning only HTML content.
*/

/**
 * Renders the maintenance message for the website.
 * 
 * This function returns a simple HTML structure that displays a maintenance notice
 * to the users, indicating that the website is temporarily unavailable due to maintenance activities.
 * 
 * @returns {Promise<string>} A promise that resolves with the HTML content of the maintenance component.
 */
export default async function Maintenance() {
    return `
    <h1>This website is currently under maintenance. Please come back later.</h1>
    `;
}