window.hooks = {};
window.hookCache = {};

window.hook = function (name, callback) {
    if (!window.hooks[name]) {
        window.hooks[name] = [];
    }
    window.hooks[name].push(callback);
    window.hookCache[name] = callback;
};

window.triggerHook = async function (name, ...args) {
    if (!window.hooks[name]) {
        return args;
    }

    let hook = window.hookCache[name];
    if (hook) {
        args = await hook(...args);
    }

    return args;
};