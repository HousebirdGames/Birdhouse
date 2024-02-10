export let hooks = {};

export function hook(name, callback) {
    if (!hooks[name]) {
        hooks[name] = [];
    }
    hooks[name].push(callback);
}

export async function triggerHook(name, ...args) {
    if (!hooks[name]) {
        return args;
    }
    for (let hook of hooks[name]) {
        args = await hook(...args);
    }
    return args;
}