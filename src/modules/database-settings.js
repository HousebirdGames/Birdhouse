import { hooks, hook, triggerHook } from './hooks.js';

export async function getSetting(name, useCache = false) {
    const cacheSetting = useCache ? "default" : "no-store";
    const response = await triggerHook('database-get-setting', name, cacheSetting);
    const data = await response.json();
    if (data.error) {
        console.error(data.error);
        return null;
    }
    return data.value;
}

export async function setSetting(name, value) {
    const response = await triggerHook('database-set-setting', name, value);
    const data = await response.json();
    if (data.success) {
        return true;
    }
    else {
        console.error(data.error + " | " + data.message);
        return false;
    }
}