/* This file defines a simple hook system for managing and triggering custom events or hooks within the application.
It allows for registering callback functions to specific event names and triggering those callbacks with custom arguments.
The system also caches the last callback registered for each event for quicker access. */

// Object to store all registered hooks
window.hooks = {};
// Cache for storing the last callback registered for each hook
window.hookCache = {};

/**
 * Registers a callback function for a given hook name. If the hook doesn't exist, it initializes an array for that hook.
 * It also caches the callback for quick future access.
 *
 * @param {string} name The name of the hook to register the callback for.
 * @param {Function} callback The callback function to register.
 */
window.hook = function (name, callback) {
    if (!window.hooks[name]) {
        window.hooks[name] = [];
    }
    window.hooks[name].push(callback);
    window.hookCache[name] = callback;
};

/**
 * Triggers a hook by name, executing the last registered callback for it with any provided arguments.
 * If no hook is registered under the provided name, it simply returns the provided arguments.
 *
 * @param {string} name The name of the hook to trigger.
 * @param {...any} args Arguments to pass to the callback function.
 * @returns {Promise<any>} The result of the callback function or the provided arguments if no callback is registered.
 */
window.triggerHook = async function (name, ...args) {
    if (!window.hooks[name]) {
        return null;
    }

    let hook = window.hookCache[name];
    if (hook) {
        args = await hook(...args);
    }

    return args;
};