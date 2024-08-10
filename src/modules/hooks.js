/* This file defines a simple hook system for managing and triggering custom events or hooks within the application.
It allows for registering callback functions to specific event names and triggering those callbacks with custom arguments.
The system also caches the last callback registered for each event for quicker access. */

// Object to store all registered hooks
window.hooks = {};

/**
 * Registers a callback function for a given hook name.
 * If the hook doesn't exist, it initializes an array for that hook.
 *
 * @param {string} name The name of the hook to register the callback for.
 * @param {Function} callback The callback function to register.
 */
window.hook = function (name, callback) {
    if (!window.hooks[name]) {
        window.hooks[name] = [];
    }
    window.hooks[name].push(callback);
};

/**
 * Triggers a hook by name, executing all registered callbacks for it with any provided arguments.
 * If no hook is registered under the provided name, it returns null.
 *
 * @param {string} name The name of the hook to trigger.
 * @param {...any} args Arguments to pass to the callback functions.
 * @returns {Promise<any[]>|Promise<any>} The results of the triggered hook callbacks or a single result if only one callback is registered.
 */
window.triggerHook = async function (name, ...args) {
    if (!window.hooks[name]) {
        return null;
    }

    const results = [];
    for (const callback of window.hooks[name]) {
        try {
            const result = await callback(...args);
            results.push(result);
        } catch (error) {
            console.error(`Error in hook "${name}":`, error);
        }
    }

    return results.length === 1 ? results[0] : results;
};

/**
 * Removes a specific callback from a hook.
 *
 * @param {string} name The name of the hook.
 * @param {Function} callback The callback function to remove.
 */
window.removeHook = function (name, callback) {
    if (window.hooks[name]) {
        window.hooks[name] = window.hooks[name].filter(cb => cb !== callback);
    }
};

/**
 * Clears all hooks for a given name or all hooks if no name is provided.
 *
 * @param {string} [name] The name of the hook to clear. If not provided, clears all hooks.
 */
window.clearHooks = function (name) {
    if (name) {
        delete window.hooks[name];
    } else {
        window.hooks = {};
    }
};