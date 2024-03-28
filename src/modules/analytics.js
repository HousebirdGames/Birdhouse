/* This module is designed to be used as a part of an analytics system. */

/**
 * Sends analytics data by triggering a custom hook.
 * This function is designed to be used as a part of an analytics system,
 * where `value` represents the analytics data to be sent.
 * Use the `send-analytics` hook to send analytics data.
 * 
 * @param {any} value - The analytics data to be sent. This could be an event name, user action, or any other relevant data.
 */
export default async function Analytics(value) {
    window.triggerHook('send-analytics', value);
}