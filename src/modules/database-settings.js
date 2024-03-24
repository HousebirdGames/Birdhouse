/* This module is designed to be used as a part of a database settings system. */

/**
 * Retrieves a setting value from the database, if the database-get-setting hook is implemented. It can optionally use cache based on the `useCache` parameter.
 * If an error occurs during retrieval, it logs the error and returns null.
 *
 * @param {string} name The name of the setting to retrieve.
 * @param {boolean} [useCache=false] Determines whether to give the 'no-store' or 'default' cache setting to the database-get-setting hook.
 * @returns {Promise<any|null>} The value of the setting if found and no error occurs, otherwise null.
 */
export async function getSetting(name, useCache = false) {
    const cacheSetting = useCache ? "default" : "no-store";
    const response = await window.triggerHook('database-get-setting', name, cacheSetting);
    const data = await response.json();
    if (data.error) {
        console.error(data.error);
        return null;
    }
    return data.value;
}

/**
 * Sets a setting value in the database, if the database-set-setting hook is implemented.
 * If an error occurs during setting, it logs the error and returns false.
 * @param {string} name The name of the setting to set.
 * @param {any} value The value of the setting to set.
 * @returns {Promise<boolean>} True if the setting was successfully set, false if an error occurs.
 */
export async function setSetting(name, value) {
    const response = await window.triggerHook('database-set-setting', name, value);
    const data = await response.json();
    if (data.success) {
        return true;
    }
    else {
        console.error(data.error + " | " + data.message);
        return false;
    }
}