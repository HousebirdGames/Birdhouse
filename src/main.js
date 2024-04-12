/*This file contains the core variables and functions for the Birdhouse framework. It also has several useful common functions.*/

import { } from '../../Birdhouse/src/modules/hooks.js';
import PopupManager from '../../Birdhouse/src/modules/popupManager.js';
import { updateNotes } from '../../updateNotes.js';
import { getSetting } from "../../Birdhouse/src/modules/database-settings.js";
import Analytics from "../../Birdhouse/src/modules/analytics.js";
import { initializeInputValidation } from '../../Birdhouse/src/modules/input-validation.js';
import { } from '../../everywhere.js';
import config from '../../config.js';

/**
 * A reference to the popup manager instance used throughout the application.
 * 
 * 
 * This variable is initially set to null and should be assigned to an instance of the popup manager once initialized.
 * It is exported to allow for consistent popup management across different parts of the application.
 * @type {PopupManager|null}
 */
export let popupManager = null;

/**
 * The prefix for URLs within the application, dynamically set based on the current window location.
 * 
 * 
 * If the application is being served from the path specified in config.localhostPath (typically during development),
 * urlPrefix is set to this path to correctly handle routing. In production, or if not served from config.localhostPath,
 * it defaults to an empty string. This ensures that URL routing works correctly in both development and production environments.
 * @type {string}
 */
export const urlPrefix = (window.location.pathname.toLowerCase().startsWith(config.localhostPath.toLowerCase()) ? config.localhostPath.toLocaleLowerCase() : '').toLowerCase();

/**
 * Indicates whether the current route is dynamically generated.
 * 
 * 
 * Set to false by default; it should be updated dynamically based on the application's routing logic to reflect
 * whether the current page was loaded from a dynamic route.
 * @type {boolean}
 */
export let dynamicRoute = false;

const redirect404ToRoot = config.redirect404ToRoot != undefined ? config.redirect404ToRoot : false;

const anchorScrollOffset = 54;

/**
 * A list of paths that are excluded from certain application logic, such as redirection.
 * 
 * 
 * Paths are converted to lowercase to ensure case-insensitive matching. Modify this list as needed for your application in the config file.
 * @type {string[]}
 */
export const excludedPaths = config.excludedPaths.map(path => path.toLowerCase());

/**
 * If user login is implemented, this variable can store the user data retrieved from the server.
 * @type {Object|null}
*/
export let userData = null;
let fetchingUserData = false;

fetchUserData().catch(error => console.error('Error fetching user data:', error));

/**
 * A promise that resolves to a boolean indicating whether the current user is an administrator.
 * Please refer to the fetch-user-data hook for more information as the user data is used here.
 * 
 * User data should include userData.loggedIn and userData.isAdmin properties.
 * @type {Promise<boolean>}
 */
export const isAdminPromise = getIsAdmin();

/**
 * A promise that resolves to a boolean indicating whether the current user is a logged in.
 * Please refer to the fetch-user-data hook for more information as the user data is used here.
 * 
 * User data should include userData.loggedIn and userData.isUser properties.
 * @type {Promise<boolean>}
 */
export const isUserPromise = getIsUser();

/**
 * Signals whether the application is in maintenance mode. If `maintenanceModeWithFailedBackend` is set to `true` in the config file,
 * the application will enter maintenance mode if the backend fails to respond. Otherwise, maintenance mode is only set by the server.
 * 
 * 
 * The `get-maintenance-mode` hook is used to fetch the maintenance mode status from the server, which is triggeren on route change.
 * @type {boolean}
 */
export let isMaintenanceMode = config.maintenanceModeWithFailedBackend != undefined ? config.maintenanceModeWithFailedBackend : true;

/**
 * The identifier used to store cookies. This identifier is appended to the cookie name to ensure uniqueness.
 * @type {string}
 */
export const cookieIdentifier = `_${sanitizeIdentifier(config.cookieIdentifier)}`;

/**
 * Creates a debounced function that delays invoking `func` until after `wait` milliseconds have elapsed
 * since the last time the debounced function was invoked.
 * 
 * @param {Function} func The function to debounce.
 * @param {number} wait The number of milliseconds to delay.
 * @returns {Function} Returns the new debounced function.
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const actions = [];

/**
 * Registers an action to be executed. Actions can either be functions to be executed directly,
 * or objects defining more complex behavior such as event listening.
 * 
 * 
 * If an action object is provided, it can specify a debounce period, an event type, a selector to
 * delegate events, the container which the delegate listener is added to, and a handler function.
 * 
 * 
 * If the action is a function, it is simply added to the action queue to be executed after the components are loaded.
 * 
 * 
 * For examples of how to use the action system, see the example component (Birdhouse/root_EXAMPLE/src/components/example.js).
 *
 * @param {Function|Object} action - The action to register. If an object, it should contain at least `type` and `handler` properties.
 */
export function action(action) {
    if (typeof action === 'function') {
        actions.push(action);
    } else {
        let handler = action.handler;
        if (action.debounce) {
            handler = debounce(action.handler, action.debounce);
        }

        const eventHandler = (event) => {
            if (action.selector) {
                if (event.target.matches(action.selector)) {
                    handler(event);
                }
            } else {
                handler(event);
            }
        };
        actions.push({ ...action, handler: eventHandler });
    }
}

/**
 * Iterates through all registered actions and sets them up accordingly.
 * This function is called automatically after the `before-actions-setup` hook.
 * 
 * 
 * For function actions, it executes them immediately. For object actions, it adds
 * event listeners to the specified containers. If a container is specified, the event
 * listener is added to all elements matching the container selector. Otherwise, it defaults
 * to the document.
 */
export function setupActions() {
    for (const action of actions) {
        if (typeof action === 'function') {
            action();
        } else {
            let containers;
            if (action.container) {
                containers = Array.from(document.querySelectorAll(action.container));
            } else {
                containers = [document];
            }

            containers.forEach(container => {
                container.addEventListener(action.type, action.handler, action.passive ? { passive: true } : { passive: false });
            });
        }
    }
}

/**
 * Cleans up and removes all event listeners registered through the action system.
 * It is called automatically when a route change is handled.
 * 
 * 
 * This function iterates through all registered actions, removing event listeners
 * from their specified containers or from the document if no container is specified.
 * After all event listeners are removed, the action list is cleared.
 */
export function unmountActions() {
    for (const action of actions) {
        if (typeof action !== 'function') {
            let containers;
            if (action.container) {
                containers = Array.from(document.querySelectorAll(action.container));
            } else {
                containers = [document];
            }

            containers.forEach(container => {
                container.removeEventListener(action.type, action.handler);
            });
        }
    }

    actions.length = 0;
}

/**
 * Sanitizes the input string by replacing all occurrences of spaces, commas, semicolons, and equals signs with underscores.
 * This transformation makes the identifier more suitable for contexts where such characters are prohibited or undesired, 
 * such as in URL slugs or programming variable names.
 *
 * 
 * The function targets the following characters for replacement:
 * 
 * - Spaces (including tabs and other whitespace characters)
 * 
 * - Commas (,)
 * 
 * - Semicolons (;)
 * 
 * - Equals signs (=)
 *
 * 
 * Each of these characters is replaced with an underscore (_) to ensure the sanitized string complies with common usage requirements
 * where these specific characters may be problematic.
 * 
 * @param {string} identifier The original string to be sanitized.
 * @return {string} The sanitized string, with the specified characters replaced by underscores.
 */
export function sanitizeIdentifier(identifier) {
    return identifier.replace(/[\s,;=]/g, '_');
}

/**
 * Creates an admin route for the application. This function is essential for dynamically
 * adding admin interfaces and ensuring that they are visible only to users with the appropriate permissions.
 *
 * 
 * If the user is not logged in as admin, the page content is replaced with default content that prompts the user to log in.
 * This behavior can be customized by using the `overwrite-not-authorized-admin-page-content` hook.
 * 
 * @param {string} slug The URL slug for the route.
 * @param {string} name The display name for the route.
 * @param {string} materialIcon The Material icon identifier for the route.
 * @param {string} componentPath The path to the component that should be loaded for this route.
 * @param {boolean} inMenu Whether this route should be included in the navigation menu.
 * @param {Object|null} data Optional data to pass to the route's component.
 * @param {boolean} displayFull Whether to display the route with text in navigation contexts.
 * @param {boolean} dynamic Whether the route is dynamically generated.
 */
export async function createAdminRoute(slug, name, materialIcon, componentPath, inMenu = true, data = null, displayFull = true, dynamic = false) {
    let overwrittenNotAuthorizedPageContent = await triggerHook('overwrite-not-authorized-admin-page-content');
    if (overwrittenNotAuthorizedPageContent == null) {
        overwrittenNotAuthorizedPageContent = `
                <div class="contentBox accent center fitContent"><h2>You are not authorized to access this page</h2>
                <div class="linkRow">
                <a href="${urlPrefix}/login" class="button"><span class="material-icons spaceRight">person</span>Login</a>
                <a href="${urlPrefix}/registration" class="button highlight"><span class="material-icons spaceRight">task_alt</span>Register</a>
                </div></div>`;
    }

    const route = constructRoute('admin', slug, name, materialIcon, componentPath, inMenu, data, dynamic, displayFull,
        async () => await isAdminPromise ? Promise.resolve() : overwrittenNotAuthorizedPageContent,
        `${componentPath}.css`);
    routesArray.push(route);
}

/**
 * Creates a user route, visible to logged-in users. This function enables the dynamic addition
 * of user-specific pages.
 * 
 * 
 * If the user is not logged in, the page content is replaced with default content that prompts the user to log in.
 * This behavior can be customized by using the `overwrite-not-authorized-user-page-content` hook.
 *
 * @param {string} slug The URL slug for the route.
 * @param {string} name The display name for the route.
 * @param {string} materialIcon The Material icon identifier for the route.
 * @param {string} componentPath The path to the component that should be loaded for this route.
 * @param {boolean} inMenu Whether this route should be included in the navigation menu.
 * @param {Object|null} data Optional data to pass to the route's component.
 * @param {boolean} displayFull Whether to display the route with text in navigation contexts.
 * @param {boolean} dynamic Whether the route is dynamically generated.
 */
export async function createUserRoute(slug, name, materialIcon, componentPath, inMenu = true, data = null, displayFull = true, dynamic = false) {
    let overwrittenNotAuthorizedPageContent = await triggerHook('overwrite-not-authorized-user-page-content');
    if (overwrittenNotAuthorizedPageContent == null) {
        overwrittenNotAuthorizedPageContent = `
        <div class="contentBox accent center fitContent"><h2>Only logged in users can see this page</h2>
        <div class="linkRow">
        <a href="${urlPrefix}/login" class="button"><span class="material-icons spaceRight">person</span>Login</a>
        <a href="${urlPrefix}/registration" class="button highlight"><span class="material-icons spaceRight">task_alt</span>Register</a>
        </div></div>`;
    }

    const route = constructRoute('user', slug, name, materialIcon, componentPath, inMenu, data, dynamic, displayFull,
        async () => await isUserPromise ? Promise.resolve() : overwrittenNotAuthorizedPageContent,
        '');
    routesArray.push(route);
}

/**
 * Creates a public route accessible to all visitors. This function facilitates the addition
 * of general-access pages.
 *
 * @param {string} slug The URL slug for the route.
 * @param {string} name The display name for the route.
 * @param {string} materialIcon The Material icon identifier for the route.
 * @param {string} componentPath The path to the component that should be loaded for this route.
 * @param {boolean} inMenu Whether this route should be included in the navigation menu.
 * @param {Object|null} data Optional data to pass to the route's component.
 * @param {boolean} displayFull Whether to display the route with text in navigation contexts.
 * @param {boolean} dynamic Whether the route is dynamically generated.
 */
export function createPublicRoute(slug, name, materialIcon, componentPath, inMenu = true, data = null, displayFull = true, dynamic = false) {
    const route = constructRoute('public', slug, name, materialIcon, componentPath, inMenu, data, dynamic, displayFull, () => Promise.resolve());
    routesArray.push(route);
}

function constructRoute(type, slug, name, materialIcon, componentPath, inMenu, data, dynamic, displayFull, customLogic, additionalCSSPath = '') {
    const fullPath = urlPrefix + '/src/' + componentPath;
    return {
        path: (urlPrefix + slug).toLowerCase(),
        name: name,
        type: type,
        inMenu: inMenu,
        materialIcon: materialIcon,
        componentPath: fullPath,
        dynamic: dynamic,
        data: data,
        displayFull: displayFull,
        Handler: async function () {
            return routeHandler(fullPath, data, customLogic);
        }
    };
}

if (config.enableImageComparisonSliders) {
    loadCSS(urlPrefix + '/Birdhouse/src/modules/image-comparison-slider/image-comparison-slider.css');
}

let retryDelay = 1000;
let hadError = false;

async function fetchUserData() {
    if (config.userLoginEnabled && !userData) {
        while (fetchingUserData) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        if (!userData) {
            fetchingUserData = true;
            try {
                const response = await window.triggerHook('fetch-user-data') || null;
                userData = await response.json();
                retryDelay = 1000;
                if (hadError) {
                    location.reload();
                }
            } catch (error) {
                console.error('Fetch error:', error);
                retryDelay = Math.min(retryDelay * 2, 3600000);
                setTimeout(fetchUserData, retryDelay);
                hadError = true;
            } finally {
                if (userData && !userData.loggedIn) {
                    checkRememberMe();
                }
                fetchingUserData = false;
            }
        }
    }
}

/**
 * Triggers the check-remember-me hook to determine if there is a valid remember-me token stored.
 * If the hook returns true, the page is reloaded to log in the user automatically.
 * 
 * 
 * This function is called automatically when the application is loaded. It is used to reload
 * the page if that is needed for the login to take effect.
 */
export async function checkRememberMe() {
    const remembered = await window.triggerHook('check-remember-me') || false;

    if (remembered) {
        window.location.reload();
    }
}

async function getIsAdmin() {
    if (!userData) await fetchUserData();

    if (userData) {
        if (userData.loggedIn && userData.isAdmin) {
            console.log("Logged in as admin");
            return true;
        }
        else {
            return false;
        }
    }
}

async function getIsUser() {
    if (!userData) await fetchUserData();
    if (userData) {
        if (userData.loggedIn && userData.isUser) {
            console.log("Logged in as user");
            await window.triggerHook('user-logged-in');
            return true;
        }
        else {
            return false;
        }
    }
}

const routesArray = [];

function findRoute(path) {
    return routesArray.find(route => route.path.toLowerCase() === path.toLowerCase());
}

/**
 * Retrieves an array of menu items based on the specified route type. Each menu item includes
 * details such as path, display preference, material icon, presence of a name, and the name itself.
 * 
 * @param {string} routeType The type of route to filter menu items by.
 * @returns {Object[]} An array of objects representing each menu item's details.
 */
export function getMenuItems(routeType) {
    return routesArray
        .filter(route => route.type === routeType && route.inMenu)
        .map(route => {
            return {
                path: route.path,
                displayFull: route.displayFull,
                materialIcon: route.materialIcon,
                hasName: route.name != "",
                name: route.name
            };
        });
}

async function generateMenuHTML(routeType) {
    const menuItems = getMenuItems(routeType);
    let html = '';

    html = await window.triggerHook('generate-menu-html', menuItems) || menuItems.map(item => {
        return `
        <a href="${item.path}"><span class="material-icons">${item.materialIcon}</span>${item.displayFull ? item.name : ''}</a>
        `;
    }).join('');

    return html;
}

async function routeHandler(componentPath, data, customLogic = async () => true) {
    try {
        const customLogicResult = await customLogic();
        if (typeof customLogicResult === 'string') {
            return customLogicResult;
        }

        const module = await import(componentPath + '.js');
        if (typeof module.default !== 'function') {
            throw new Error('The imported module does not export a default function.');
        }

        const Component = module.default;
        const content = await Component(data).catch((error) => {
            console.error(error);
            return failedToLoadComponent();
        });

        loadCSS(componentPath + '.css', true);

        return content;
    } catch (error) {
        console.error(error);
        return failedToLoadComponent();
    }
}

async function getComponent(componentPath, data = null) {
    try {
        componentPath = urlPrefix + '/src/' + componentPath;
        const { default: Component } = await import(componentPath);

        return Component;
    } catch (error) {
        console.error(error);
    }
}

const updateButton = document.getElementById('update-version-btn');
if (updateButton) {
    updateButton.addEventListener('click', () => {
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        }
    });
}

async function updateMaintenanceMode() {
    isMaintenanceMode = await window.triggerHook('get-maintenance-mode') || isMaintenanceMode;
}

const content = document.getElementById("content");

let isHandlingRouteChange = false;

let path = normalizePath(window.location.pathname);

/**
 * Handles route changes within the application. This function is responsible for updating the
 * application's state based on the new route, including updating the UI, fetching new data, and
 * managing history. It ensures that only one route change is handled at a time to prevent race
 * conditions.
 * 
 * 
 * This function is called automatically when the application is loaded and when the user navigates,
 * but it can also be triggered manually if needed.
 */
export async function handleRouteChange() {
    if (isHandlingRouteChange) {
        return;
    }

    isHandlingRouteChange = true;

    removeAllComponentCSS();
    unmountActions();

    await window.triggerHook('on-handle-route-change');

    if (config.enableInfoBar) {
        const infoBar = document.getElementById('infoBar');
        let infoText = '<p>Infos could not be retrieved: Please contact us</p>';
        getSetting('info_text', false).then(info_text => {
            if (info_text != '') {
                infoText = `<p>${info_text}</p>`;
            }
            else {
                infoText = '';
            }

            updateInfoBar();
        }).catch(error => {
            console.error(error);
            updateInfoBar();
        });

        function updateInfoBar() {
            if (infoBar) {
                infoBar.innerHTML = infoText;
            }
            else {
                alert(infoText);
            }
        }
    }

    content.classList.remove('fade-in-fast');

    content.innerHTML = await window.triggerHook('get-loading-content');

    path = normalizePath(window.location.pathname);

    let component = null;

    await updateMaintenanceMode();

    let allowedPathsDuringMaintenance = await window.triggerHook('get-allowed-paths-during-maintenance') || [];

    if (isMaintenanceMode && !allowedPathsDuringMaintenance.includes(path.replace(urlPrefix + '/', ''))) {
        component = await getComponent('components/maintenance.js');

        if (component == null) {
            component = function MaintenanceMode() {
                return '<h1>This website is currently under maintenance. Please come back later.</h1>';
            };
        }
    }
    else {
        let route = findRoute(path);

        if (!route) {
            dynamicRoute = await window.triggerHook('add-dynamic-routes', path.slice(urlPrefix.length + 1).toLowerCase());

            if (!route) {
                route = findRoute(path);
            }
        }
        else {
            dynamicRoute = route.dynamic;
        }

        if (!route && !dynamicRoute) {
            route = findRoute('*');  // Fallback to 404 route
        }

        component = route ? route.Handler : null;
    }

    if (getCookie("storageAcknowledgement") != 'true' && !getSessionStorageItem('denyStorage') && config.openCookiePopupAtPageLoad) {
        popupManager.openPopup("storageAcknowledgementPopup");
    }

    let oupsContent = await window.triggerHook('overwrite-oups-content');
    if (oupsContent == null || overwrittenOupsContent == '') {
        oupsContent = '<div class="contentBox"><h1>Oups! Something went wrong.</h1></div>'
    }

    if (!component) {
        if (redirect404ToRoot) {
            window.location.replace(`${urlPrefix}/`);
        } else if (content) {
            content.innerHTML = oupsContent;
        }
    } else {
        if (content) {
            try {
                let contentHTML = '';

                contentHTML = await component();
                await window.triggerHook('on-component-loaded');

                content.innerHTML = contentHTML;
            } catch (error) {
                console.error(error);
                content.innerHTML = oupsContent;
            }
        }
    }

    await window.triggerHook('on-content-loaded');

    await window.triggerHook('before-actions-setup');

    setupActions();

    await window.triggerHook('on-actions-setup');

    initializeCookiesAndStoragePopupButtons();

    initializeUpdateNotesButtons();

    addLinkListeners();

    const initialLoadingSymbol = document.getElementById('initialLoadingSymbol');
    if (initialLoadingSymbol) {
        initialLoadingSymbol.remove();
    }
    content.classList.add('fade-in-fast');

    isHandlingRouteChange = false;

    let message = getQueryParameterByName('message');
    let messageTitle = ""
    switch (message) {
        case "failedCookies":
            messageTitle = "Permission needed";
            message = "<strong>Note:</strong> The login requires cookies and storage to be allowed.";
            break;
        case "nouser":
            messageTitle = "No User";
            message = "No user found with this username";
            break;
        case "success":
            messageTitle = "Success";
            message = "Logged in successfully";
            break;
        case "rememberme":
            messageTitle = "Success";
            message = "Logged in successfully with remember me";
            break;
        case "logout":
            messageTitle = "Goodbye!";
            message = "Logged out";
            break;
        case "logoutall":
            messageTitle = "Goodbye!";
            message = "Logged out & invalidated all auth tokens";
            break;
        case "failed":
            messageTitle = "Oups!";
            message = "Invalid username, password, or role";
            break;
        case "error":
            messageTitle = "Error";
            message = "There was an error while trying to log in";
            break;
        default:
            messageTitle = "Notice";
            message = message ? message : '';
            break;
    }
    if (message != "") {
        removeQueryParameter('message');
        alertPopup(messageTitle, `<p>${message}</p>`);
    }

    if (config.enableImageComparisonSliders) {
        try {
            const module = await import(urlPrefix + '/Birdhouse/src/modules/image-comparison-slider/image-comparison-slider.js');
            module.initImageComparisons();
        } catch (err) {
            console.error('Failed to load module', err);
        }
    }

    assignInstallButton();

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            scroll();
        });
    });
}

/**
 * Scrolls to the element specified by the hash in the URL, or to the top of the page if no hash is provided.
 * 
 * 
 * This function checks the current URL for a hash (#). If a hash is present, it attempts to find an element
 * with an ID that matches the hash. If such an element is found, the page scrolls smoothly to bring the element
 * into view. The `anchorScrollOffset` is used to adjust the final scroll position, allowing for fixed elements
 * like headers.
 * 
 * 
 * If no hash is present in the URL, or if no element with a matching ID is found, the page scrolls to the top.
 */
export function scroll() {
    const hash = window.location.hash.substring(1);
    if (hash != '') {
        const element = document.getElementById(hash);
        if (element) {
            requestAnimationFrame(() => {
                const newPosition = window.scrollY + element.getBoundingClientRect().top - anchorScrollOffset;
                window.scrollTo({ top: newPosition, behavior: 'smooth' });
            });
        }
        else {
            window.scrollTo(0, 0);
        }
    }
    else {
        window.scrollTo(0, 0);
    }
}

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    deferredPrompt = e;
    assignInstallButton();
});

document.addEventListener("DOMContentLoaded", async () => {
    routesArray.push({
        path: '*',
        type: 'public',
        Handler: async function NotFoundRouteHandler() {
            const overwritten404Content = await triggerHook('overwrite-404-content');
            if (overwritten404Content != null && overwritten404Content != '') {
                return overwritten404Content;
            }

            return `<div class="contentBox accent"><h1>404 Not Found</h1>
            <p>The page you're trying to access doesn't exist or has been moved. Please check the URL and try again.</p>
            <p>If you believe this is an error, please <a class="underline" href="${urlPrefix}/contact">contact us</a>.</p>
            </div>`;
        }
    });

    if (config.enableInputValidation) {
        setTimeout(initializeInputValidation, 0);
    }

    popupManager = new PopupManager();

    await window.triggerHook('create-routes');

    await addAdminButtons();

    updateTitleAndMeta();
    handleRouteChange();
    textareaResizer();

    window.addEventListener('popstate', () => handleRouteChange());

    document.addEventListener('change', (event) => {
        const checkbox = event.target;
        if (checkbox.type === 'checkbox') {
            if (checkbox.checked) {
                checkbox.classList.add('animate');

                setTimeout(() => {
                    checkbox.classList.remove('animate');
                }, 400);
            }
        }
    });

    const menuHTML = await getMenuHTML();
    await window.triggerHook('before-adding-base-content', menuHTML);

    const overwrittenBaseContent = await triggerHook('overwrite-default-base-content');
    if (overwrittenBaseContent == null || overwrittenBaseContent == '') {
        addBaseContent(`
            ${await window.triggerHook('get-popup-menu-html', menuHTML) || ''}

            <div id="updatePopup" class="popup">
                <div class="popup-content big">
                    <h2>Update Notes</h2>
                    <p class="versionInfo"></p>
                    <div id="updateNotesButtonsContainer"></div>
                    <div id="updateContent">
                    </div>
                    <button id="updateConfirm" class="">Alright</button>
                </div>
            </div>

            <div id="storageAcknowledgementPopup" class="popup">
                <div class="popup-content big">
                    ${await window.triggerHook('get-storage-acknowledgement-popup-content') || '<p>By clicking "I Understand and Agree", you allow this site to store cookies on your device and use the browsers local storage.</p>'}

                    <div id="storageAcknowledgementButtonRow" class="inputRow center">
                        <button id="storageAcknowledgementPopupClose" class="closePopup closePopupIcon"><i class="material-icons">close</i></button>
                        <button id="clearButton" class="centerText">Deny permission<br>(deletes cookies<br>& local storage)</button>
                        <button id="storageAcknowledgementButton" class="closePopup centerText">I understand<br>and agree</button>
                    </div>
                </div>
            </div>

            <div id="alertPopup" class="popup">
                <div class="popup-content">
                    <h5 id="alertPopupText"></h5>
                    <div id="alertPopupContent"></div>
                    <button id="alertCloseButton" class="closePopup">Alright</button>
                </div>
            </div>
        `);
    }
    else {
        addBaseContent(`
        ${overwrittenBaseContent}
        `);
    }

    await window.triggerHook('after-adding-base-content', menuHTML);

    assignMenuButton();

    const clearButton = document.getElementById("clearButton");
    if (clearButton) {
        clearButton.addEventListener("click", async () => {
            Analytics('Revoked storage acknowledgement');
            setSessionStorageItem('denyStorage');
            const localStorageEntriesToDelete = ['selectedTheme', 'lastVisitedPage'];
            deleteSpecificLocalStorageEntries(localStorageEntriesToDelete);
            const cookiesToDelete = await window.triggerHook('get-cookies-list') || [];
            deleteSpecificCookies(cookiesToDelete);
            location.reload();
        });
    }

    const storageAcknowledgementButton = document.getElementById("storageAcknowledgementButton");
    if (storageAcknowledgementButton) {
        storageAcknowledgementButton.addEventListener("click", () => {
            Analytics('Gave storage acknowledgement');
            const wasTrue = getCookie("storageAcknowledgement") === 'true';
            setCookie("storageAcknowledgement", true, 365);
            popupManager.closePopup("storageAcknowledgementPopup");
            deleteSessionStorageItem('denyStorage');
            if (!wasTrue) {
                location.reload();
            }
        });
    }

    const footer = document.getElementById("footer");
    if (footer) {
        footer.classList.add('hideOnSmallScreen');
    }

    const resetPopupButton = document.getElementById("resetPopupButton");
    if (resetPopupButton) {
        resetPopupButton.addEventListener('click', () => {
            popupManager.openPopup("resetSavePopup");
        });
    }

    if (getCookie("storageAcknowledgement") === 'true' || getSessionStorageItem('denyStorage')) {
        popupManager.closePopup("storageAcknowledgementPopup");
    }
    else if (config.openCookiePopupAtPageLoad) {
        popupManager.openPopup("storageAcknowledgementPopup");
    }

    if (getCookie("storageAcknowledgement") == 'true') {
        showUpdateNotes();
    }

    const versionInfos = document.querySelectorAll('.versionInfo');
    if (versionInfos) {
        versionInfos.forEach(versionInfo => {
            versionInfo.textContent = "Current Version: " + config.version;
        });
    }

    const currentYear = new Date().getFullYear();
    const currentYearElement = document.getElementById('currentYear');
    currentYearElement.textContent = currentYear > config.foundationYear ? config.foundationYear + ' - ' + currentYear + ' ' : config.foundationYear + ' ';

    window.triggerHook('page-loaded');
});

function failedToLoadComponent() {
    const overwrittenFailedToLoadContent = window.triggerHook('overwrite-failed-to-load-content');
    if (overwrittenFailedToLoadContent != null && overwrittenFailedToLoadContent != '') {
        return overwrittenFailedToLoadContent;
    }

    return `
    <div class="contentBox accent">
    <h1>Are you offline?</h1>
    <p>The component could not be loaded. Maybe you have lost your internet connection or the server is down. Please make sure you are connected to the internet and try again.</p>
    <p>If you believe this is an error, please contact us.</p>
    </div>
    `;
}

let linkClickListener;
function addLinkListeners() {
    if (linkClickListener) {
        document.body.removeEventListener('click', linkClickListener);
    }

    linkClickListener = async function (event) {
        if (!event.target || !event.target.tagName) {
            return;
        }

        let linkElement;

        if (event.target.tagName === 'A') {
            linkElement = event.target;
        }
        else if (event.target.parentElement && event.target.parentElement.tagName === 'A') {
            linkElement = event.target.parentElement;
        }

        if (linkElement) {
            let href = linkElement.getAttribute('href');
            Analytics("Click: " + href);

            if (href.startsWith('#')) {
                history.pushState(null, '', window.location.pathname + href);
                scroll();
                event.preventDefault();
                return;
            }

            const url = new URL(href, window.location.href);
            const cleanHref = url.origin + url.pathname;

            let excludedRoutes = await window.triggerHook('get-spa-excluded-links') || [];

            excludedRoutes = excludedRoutes.map(route => { return route.toLowerCase() });

            if (excludedRoutes.includes(getRelativePath(cleanHref))) {
                return;
            }

            if (linkElement.hostname !== window.location.hostname) {
                return;
            }

            event.preventDefault();
            goToRoute(href);
        }
    };

    document.body.addEventListener('click', linkClickListener);
}

function assignInstallButton() {
    if (deferredPrompt == null) {
        return;
    }

    const installButton = document.getElementById('installButton');
    if (installButton) {
        const installPrompt = deferredPrompt;
        deferredPrompt = null;
        installButton.style.display = 'flex';

        installButton.addEventListener('click', (e) => {
            installPrompt.prompt();
            installPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    alertPopup(`Thank you for installing ${config.pageTitle} on your device`)
                    Analytics('Installed PWA');
                }
            });
        });
        installButton.addEventListener('animationend', () => {
            installButton.style.animation = '';
        });

        window.addEventListener('appinstalled', () => {
            console.log("App installed");
            installButton.style.display = 'none';
            installPrompt = null;
        });
    }
}

function showUpdateNotes(force = false) {
    const latestPatch = updateNotes[0];

    if ((getCookie("lastUpdateNote") !== latestPatch.version && config.showNewUpdateNotes) || force) {
        Analytics('Showed updated notes');
        const updatePopup = document.getElementById("updatePopup");
        const updateContent = document.getElementById("updateContent");
        const updateNotesButtonsContainer = document.getElementById("updateNotesButtonsContainer");

        if (updatePopup && updateContent && updateNotesButtonsContainer) {
            updateContent.innerHTML = `
              ${latestPatch.title ? `<h4 class="leftText">New: Version ${latestPatch.version}</h4><h3>${latestPatch.title}</h3>` : `<h4 class="leftText"></h4><h3>New Version ${latestPatch.version}</h3>`}
              <ul id="updateNotesList">
                ${latestPatch.notes.map((note) => `<li>${note}</li>`).join('')}
              </ul>
            `;

            updateNotesButtonsContainer.innerHTML = '';
            updateNotes.forEach((patch, index) => {
                const button = document.createElement("button");
                button.classList.add('updateVersionButton');
                button.textContent = `${patch.version}`;

                if (patch.version === latestPatch.version) {
                    button.classList.add('active');
                }

                button.addEventListener("click", () => {
                    updateContent.querySelector("h3").textContent = `${patch.title ? `${patch.title}` : `Version ${patch.version}`}`;
                    updateContent.querySelector("h4").textContent = `${patch.title ? `Version ${patch.version}` : ``}`;
                    document.getElementById("updateNotesList").innerHTML = patch.notes
                        .map((note) => `<li>${note}</li>`)
                        .join("");

                    updateNotesButtonsContainer.querySelectorAll('.updateVersionButton').forEach(btn => {
                        btn.classList.remove('active');
                    });

                    button.classList.add('active');
                });
                updateNotesButtonsContainer.appendChild(button);
            });

            popupManager.openPopup("updatePopup");
            const updateConfirm = document.getElementById("updateConfirm");
            if (updateConfirm) {
                updateConfirm.addEventListener("click", (event) => {
                    if (getCookie("storageAcknowledgement") === "true") {
                        Analytics('Confirmed updated notes');
                        setCookie("lastUpdateNote", latestPatch.version, 365);
                    }
                    popupManager.closePopup("updatePopup");
                });
            }
        }
    }
}

function initializeUpdateNotesButtons() {
    const updateNotesButtons = document.querySelectorAll(".updateNotesButton");
    updateNotesButtons.forEach(updateNotesButton => {
        updateNotesButton.addEventListener('click', () => {
            Analytics('Viewed update notes');
            showUpdateNotes(true);
        });
    });
}

function initializeCookiesAndStoragePopupButtons() {
    const openAcknowledgementButtons = document.querySelectorAll(".openAcknowledgementButton");
    if (openAcknowledgementButtons) {
        openAcknowledgementButtons.forEach(openAcknowledgementButton => {
            openAcknowledgementButton.addEventListener("click", () => {
                popupManager.openPopup("storageAcknowledgementPopup");
            });
        });
    }
}

/**
 * Normalizes the given path by converting it to lowercase and removing trailing slashes. It also
 * ensures the path is redirected to a specified excluded path if matched.
 * 
 * @param {string} path The path to normalize.
 * @returns {string} The normalized path.
 */
export function normalizePath(path) {
    path = path.toLowerCase();

    let normalizedPath = path;

    if (path !== urlPrefix + "/" && path.endsWith("/")) {
        normalizedPath = path.slice(0, -1);
    }

    for (const excludedPath of excludedPaths) {
        const excludedPathWithPrefix = urlPrefix + excludedPath;
        if (normalizedPath === excludedPathWithPrefix.toLowerCase() || normalizedPath === excludedPathWithPrefix.toLowerCase() + '/') {
            window.location.href = excludedPathWithPrefix;
            return;
        }
    }

    return normalizedPath;
}

/**
 * Converts a relative path to a fully qualified URL path, taking into account the application's
 * URL prefix.
 * 
 * @param {string} path The path to convert.
 * @returns {string} The relative URL path.
 */
export function getRelativePath(path) {
    return new URL(path, window.location.origin + urlPrefix + '/').pathname;
}

/**
 * Dynamically adds an additional component to the page's content area. Useful for loading
 * components based on user interaction or other dynamic criteria.
 * 
 * @param {string} componentPath The path to the component's JavaScript module.
 * @param {Object|null} data Optional data to pass to the component for rendering.
 */
export async function addAdditionalComponent(componentPath, data = null) {
    const content = document.getElementById("content");
    if (content) {
        const additionalComponent = await getComponent(componentPath + '.js', data).catch((error) => {
            console.error(error);
            return 'Failed to load additional component';
        });
        const additionalContent = await additionalComponent(data).catch((error) => {
            console.error(error);
            return 'Failed to load additional component';
        });
        content.insertAdjacentHTML('beforeend', additionalContent);
    }
}

/**
 * Appends the provided HTML content to the base content area of the page.
 * 
 * @param {string} htmlContent The HTML content to add.
 */
export function addBaseContent(htmlContent) {
    const baseContent = document.getElementById("baseContent");
    baseContent.insertAdjacentHTML('beforeend', htmlContent);
}

/**
 * Redirects the user to the dashboard route if they are logged in as a user. This function
 * checks the user's authentication status and performs the redirection if applicable.
 */
export async function redirectUserToDashboard() {
    if (await isUserPromise) {
        window.location.replace(`${urlPrefix}/dashboard`);
    }
}

/**
 * Redirects the browser to a new route. This function updates the browser's history and triggers
 * the application's route handling mechanism.
 * 
 * @param {string} href The path to redirect to.
 */
export function goToRoute(href) {
    if (!href.startsWith('#')) {
        const normalizedHref = normalizePath(href);
        history.pushState(null, '', normalizedHref);
        handleRouteChange();
    }
}

/**
 * Generates the HTML content for the application's menu based on the current user's role. This
 * function dynamically constructs the menu items and layout.
 * 
 * @returns {Promise<string>} A promise that resolves to the generated HTML content for the menu.
 */
export async function getMenuHTML() {
    if (await isUserPromise) {
        return await generateMenuHTML('user');
    }
    else {
        return await generateMenuHTML('public');
    }
}

let textareaResizerAdded = false;

function textareaResizer() {
    if (!textareaResizerAdded) {
        action({
            type: 'input',
            handler: delegateResize,
            selector: 'textarea',
            debounce: 0,
        });
        action({
            type: 'click',
            handler: delegateResize,
            selector: 'textarea',
            debounce: 0,
        });

        let windowWidth = window.innerWidth;

        window.addEventListener('resize', () => {
            if (window.innerWidth !== windowWidth) {
                resizeAllTextareas();
                windowWidth = window.innerWidth;
            }
        }, { passive: true });

        textareaResizerAdded = true;
    }

    action(resizeAllTextareas);

    function delegateResize(event) {
        requestAnimationFrame(() => { event.target.scrollTop = 0; });
        debounce(resizeOne.bind(event.target), 0)();
    }

    function resizeOne() {
        const currentPosition = window.scrollY;
        const currentHeight = this.style.height;
        const newHeight = getTextareaHeight(this) + 4 + 'px';

        this.style.height = currentHeight;
        this.scrollTop = 0;

        requestAnimationFrame(() => {
            this.style.height = newHeight;
            this.scrollTop = 0;
            window.scrollTo(0, currentPosition);
        });
    }
}

/**
 * A utility function to dynamically resize all textareas on the page. It is typically called
 * when the page loads or when the content of the page changes to ensure all textareas are
 * appropriately sized.
 * 
 * 
 * Is typically called automatically, but can also be triggered manually if needed.
 * 
 * 
 * This function supports batching which can help in improving performance on pages with a large number
 * of textareas by spreading out the resize operations over multiple animation frames with a delay of
 * 100ms between each batch. This can help prevent the browser from becoming unresponsive when resizing.
 *
 * @param {number|null} batchSize=null The number of textareas to process in each batch (needs to be greater than 0). If null, all textareas are resized in a single batch.
 */
export async function resizeAllTextareas(batchSize = null) {
    const allTextareas = document.querySelectorAll('textarea');
    if (batchSize == null) {
        requestAnimationFrame(() => {
            resizeTextareaNodes(allTextareas);
        });
    }
    else if (batchSize > 0 && typeof batchSize === 'number' && Number.isInteger(batchSize)) {
        const textareas = Array.from(allTextareas);

        for (let i = 0; i < textareas.length; i += batchSize) {
            const batch = textareas.slice(i, i + batchSize);
            requestAnimationFrame(() => {
                resizeTextareaNodes(batch);
            });

            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    else {
        console.error('Invalid batch size: Must be a positive integer that greater than 0');
    }
}

/**
 * A utility function to dynamically resize a single textarea element. It first resets the textarea's height to 'auto',
 * then sets it to the scrollHeight of the textarea plus 4 pixels. The scrollHeight is equal to the height of the 
 * textarea's content. The extra 4 pixels account for the textarea's border.
 *
 * @param {HTMLTextAreaElement} textarea The textarea element to resize.
 */
export async function resizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 4 + 'px';
}

/**
 * This function works by converting the provided NodeList of textarea elements into an array to leverage array methods
 * for iteration. It processes each textarea in batches to minimize reflows and repaints, improving performance especially
 * when dealing with a large number of textareas.
 * 
 * 
 * Each textarea's height is retrieved by using the getTextareaHeight function.
 * 
 * 
 * Example usage:
 * const textareas = document.querySelectorAll('textarea');
 * resizeTextareaNodes(textareas);
 * 
 * @param {NodeList} nodeList A NodeList of textarea elements to be resized. Typically obtained through document.querySelectorAll or similar methods.
 */
export function resizeTextareaNodes(nodeList) {
    const textareas = Array.from(nodeList);

    const heights = textareas.map(textarea => {
        return getTextareaHeight(textarea) + 4;
    });

    window.requestAnimationFrame(() => {
        textareas.forEach((textarea, index) => {
            textarea.style.height = `${heights[index]}px`;
        });
    });
}

/**
 * Calculates the content height of a textarea element without altering its visible state or layout.
 * This function creates an off-screen clone of the provided textarea, applies relevant styles, and
 * measures its scrollHeight to determine the content height. This method avoids causing reflows for
 * the original textarea element, improving performance in scenarios where reflow cost is a concern.
 *
 * @param {HTMLTextAreaElement} textarea The textarea element for which to calculate content height.
 * @returns {number} The calculated height of the textarea content, in pixels.
 */
export function getTextareaHeight(textarea) {
    const clone = textarea.cloneNode();
    clone.style.position = 'absolute';
    clone.style.visibility = 'hidden';
    clone.style.height = 'auto';

    clone.style.width = getComputedStyle(textarea).width;
    clone.textContent = textarea.value;

    document.body.appendChild(clone);

    const contentHeight = clone.scrollHeight;

    document.body.removeChild(clone);

    return contentHeight;
}

/**
 * Checks if the specified element is within the viewport. This can be used to determine if an
 * element is visible to the user.
 * 
 * @param {Element} element The DOM element to check.
 * @param {number} offset An optional offset to consider the element in viewport before it
 * actually enters the viewport.
 * @returns {boolean} True if the element is in the viewport, false otherwise.
 */
export function isInViewport(element, offset = 0) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= -offset &&
        rect.left >= -offset &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) + offset &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth) + offset
    );
}

/**
 * Copies the given string to the clipboard.
 * @param {string} stringToCopy The string to copy.
 * @param {boolean} openPopup=true Whether to open a popup after copying.
 */
window.CopyToClipboard = function CopyToClipboard(stringToCopy, openPopup = true) {
    navigator.clipboard.writeText(stringToCopy).then(function () {
        if (openPopup) {
            alertPopup('Copied to clipboard', 'Copied: ' + stringToCopy);
        }
    }, function (err) {
        console.error('Could not copy text: ', err);
    });
}

/**
 * Copies the inner text of the element with the given ID to the clipboard.
 * @param {string} id The ID of the element.
 * @param {boolean} openPopup=true Whether to open a popup after copying.
 */
window.CopyToClipboardFromID = function CopyToClipboardFromID(id, openPopup = true) {
    const stringToCopy = document.getElementById(id).innerText;
    navigator.clipboard.writeText(text).then(function () {
        if (openPopup) {
            alertPopup('Copied to clipboard', 'Copied: ' + stringToCopy);
        }
    }, function (err) {
        console.error('Could not copy text: ', err);
    });
}

/**
 * Updates the page's title and meta description. This can be used to dynamically change the
 * information seen by users and search engines based on the current content or context of the
 * page.
 * 
 * @param {string} title The new title of the page.
 * @param {string} description The new meta description of the page.
 */
export function updateTitleAndMeta(title = '', description = config.pageDescription) {
    const metaDescpription = document.querySelector('meta[name="description"]');
    if (metaDescpription) {
        metaDescpription.setAttribute("content", description);
    }

    if (title == '') {
        document.title = config.pageTitle;
    }
    else {
        document.title = title + ' | ' + config.pageTitle;
    }
}

/**
 * Rounds a numeric value to the nearest half unit. This function is useful for ratings or
 * measurements that are typically represented in half units.
 * 
 * @param {number} value The value to round.
 * @returns {number} The rounded value.
 */
export function roundToHalf(value) {
    return Math.round(value * 2) / 2;
}

/**
 * Rounds a numeric value to the nearest whole number. This function is useful for counts or
 * other integer-based measurements.
 * 
 * @param {number} value The value to round.
 * @returns {number} The rounded value.
 */
export function roundToFull(value) {
    return Math.round(value);
}

/**
 * Sets a cookie with the specified name, value, and expiration days. This function simplifies
 * the process of creating cookies.
 * 
 * @param {string} name The name of the cookie.
 * @param {string} value The value of the cookie.
 * @param {number} days The number of days until the cookie expires.
 */
export function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = days ? `; expires=${date.toUTCString()}` : '';
    document.cookie = `${name + cookieIdentifier}=${value}${expires}; path=/`;
}

/**
 * Retrieves the value of a cookie with the specified name. If the cookie does not exist, null
 * is returned.
 * 
 * @param {string} name The name of the cookie to retrieve.
 * @returns {string|null} The value of the cookie or null if it does not exist.
 */
export function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name + cookieIdentifier}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

/**
 * Deletes all cookies associated with the current domain. This function is useful for clearing
 * session data.
 */
export function deleteAllCookies() {
    const cookies = document.cookie.split(";");

    for (const cookie of cookies) {
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    }
};

/**
 * Deletes specific cookies by name. This function allows for targeted removal of cookies without
 * affecting others.
 * 
 * @param {Array<string>} cookieNames An array of cookie names to delete.
 */
export function deleteSpecificCookies(cookieNames) {
    for (const name of cookieNames) {
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    }
};

/**
 * Sets an item in the session storage. This function checks if the user has acknowledged
 * storage usage using the getCookie("storageAcknowledgement") function before attempting to set the item.
 * 
 * @param {string} key The key under which to store the item.
 * @param {string} value The value to store.
 */
export function setSessionStorageItem(key, value) {
    if (getCookie("storageAcknowledgement") === 'true' || key == "denyStorage") {
        try {
            sessionStorage.setItem(key, value);
        } catch (e) {
            console.error('Failed to set item in sessionStorage:', e);
        }
    }
}

/**
 * Retrieves an item from the session storage. This function checks if the user has acknowledged
 * storage usage using the getCookie("storageAcknowledgement") function before attempting to retrieve the item.
 * 
 * @param {string} key The key of the item to retrieve.
 * @returns {string|null} The retrieved item or null if it does not exist.
 */
export function getSessionStorageItem(key) {
    if (getCookie("storageAcknowledgement") === 'true' || key == "denyStorage") {
        try {
            return sessionStorage.getItem(key);
        } catch (e) {
            console.error('Failed to get item from sessionStorage:', e);
            return null;
        }
    }
}

/**
 * Deletes an item from the session storage.
 * 
 * @param {string} key The key of the item to delete.
 * @returns {boolean} True if the item was successfully deleted, false otherwise.
 */
export function deleteSessionStorageItem(key) {
    try {
        sessionStorage.removeItem(key);
        return true;
    } catch (e) {
        console.error('Failed to remove item from sessionStorage:', e);
        return false;
    }
}

/**
 * Sets an item in the local storage. This function checks if the user has acknowledged
 * storage usage using the getCookie("storageAcknowledgement") function before attempting to set the item.
 * 
 * @param {string} key The key under which to store the item.
 * @param {string} value The value to store.
 */
export function setLocalStorageItem(key, value) {
    if (getCookie("storageAcknowledgement") === 'true') {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.error('Failed to set item in localStorage:', e);
        }
    }
}

/**
 * Retrieves an item from the local storage. This function checks if the user has acknowledged
 * storage usage using the getCookie("storageAcknowledgement") function before attempting to retrieve the item.
 * 
 * @param {string} key The key of the item to retrieve.
 * @returns {string|null} The retrieved item or null if it does not exist.
 */
export function getLocalStorageItem(key) {
    if (getCookie("storageAcknowledgement") === 'true') {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.error('Failed to get item from localStorage:', e);
            return null;
        }
    }
}

/**
 * Deletes an item from the local storage.
 * 
 * @param {string} key The key of the item to delete.
 * @returns {boolean} True if the item was successfully deleted, false otherwise.
 */
export function deleteLocalStorageItem(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (e) {
        console.error('Failed to remove item from localStorage:', e);
        return false;
    }
}

/**
 * Deletes specific entries from the local storage. This function allows for targeted removal of
 * multiple local storage items without affecting others.
 * 
 * @param {Array<string>} keys An array of keys corresponding to the local storage items to delete.
 */
export function deleteSpecificLocalStorageEntries(keys) {
    for (const key of keys) {
        localStorage.removeItem(key);
    }
};

/**
 * Retrieves the value of a URL query parameter by name. If the parameter does not exist, null
 * is returned.
 * 
 * @param {string} name The name of the query parameter to retrieve.
 * @param {string} url Optional. The URL to parse. Defaults to the current window's URL.
 * @returns {string|null} The value of the query parameter or null if it does not exist.
 */
export function getQueryParameterByName(name, url = window.location.href) {
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)', 'i'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

/**
 * Updates or adds a query parameter to the current URL and updates the browser's history.
 * 
 * @param {string} name The name of the query parameter to update or add.
 * @param {string} value The value of the query parameter.
 * @param {string} url Optional. The base URL to modify. Defaults to the current window's URL.
 */
export function updateOrAddQueryParameter(name, value, url = window.location.href) {
    const urlObj = new URL(url);
    urlObj.searchParams.set(name, value);

    window.history.pushState({ path: urlObj.href }, '', urlObj.href);
}

/**
 * Removes a query parameter from the current URL and updates the browser's history.
 * 
 * @param {string} name The name of the query parameter to remove.
 * @param {string} url Optional. The base URL to modify. Defaults to the current window's URL.
 */
export function removeQueryParameter(name, url = window.location.href) {
    const urlObj = new URL(url);
    urlObj.searchParams.delete(name);

    window.history.pushState({ path: urlObj.href }, '', urlObj.href);
}

/**
 * Loads a CSS file dynamically into the document's head. If the file is a component-specific
 * stylesheet, it will be marked accordingly for potential removal when the component is unloaded.
 * 
 * @param {string} url The URL of the CSS file to load.
 * @param {boolean} forComponent Optional. Specifies whether the CSS is for a specific component, allowing it to be targeted for removal.
 * @returns {Promise<boolean>} A promise that resolves to true if the CSS file was successfully loaded or false if there was an error.
 */
export async function loadCSS(url, forComponent = false) {
    try {
        const response = await fetch(getRelativePath(url) + '?v=' + config.version);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        } else {
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('text/css')) {
                if (forComponent) {
                    return;
                }
                throw new Error('The fetched file is not a CSS file');
            }

            var link = document.createElement('link');
            link.rel = 'stylesheet';
            if (forComponent) {
                link.classList.add('componentCSS');
            }
            link.href = getRelativePath(url) + '?v=' + config.version;

            document.head.appendChild(link);
            return true;
        }
    } catch (e) {
        console.log(`There was a problem loading the CSS file: ${e.message}`);
        return false;
    }
}

/**
 * Removes a CSS file from the document based on its URL.
 * 
 * @param {string} url The URL of the CSS file to remove.
 * @returns {boolean} True if the CSS file was successfully removed, false otherwise.
 */
export function removeCSS(url) {
    const links = document.querySelectorAll(`link[href^="${getRelativePath(url)}"]`);

    let removed = false;
    links.forEach(link => {
        if (link.href.includes(getRelativePath(url))) {
            link.parentNode.removeChild(link);
            removed = true;
        }
    });
    return removed;
}

/**
 * Removes all component-specific CSS files from the document. This function is typically called
 * when navigating away from a component to ensure its styles do not affect other parts of the application.
 * 
 * @returns {boolean} True if any CSS files were removed, false otherwise.
 */
export function removeAllComponentCSS() {
    const links = document.querySelectorAll('.componentCSS');

    let removed = false;
    links.forEach(link => {
        link.parentNode.removeChild(link);
        removed = true;
    });
    return removed;
}

/**
 * Displays a customizable popup alert with optional content. This function is part of the popup
 * management system and provides a consistent way to display alerts across the application.
 * 
 * @param {string} text The main text to display in the popup.
 * @param {string} content Optional additional HTML content to display in the popup.
 * @param {boolean} showCloseButton Specifies whether to show a close button on the popup.
 * @param {string|null} addedClass An optional class to add to the popup for styling or identification.
 */
export function alertPopup(text = '', content = '', showCloseButton = true, addedClass = null) {
    const alertPopup = document.getElementById("alertPopup");

    if (addedClass) {
        alertPopup.classList.add(addedClass);
    }
    const alertPopupText = document.getElementById("alertPopupText");
    const alertPopupContent = document.getElementById("alertPopupContent");
    if (alertPopupContent && alertPopup) {
        popupManager.openPopup("alertPopup");
        if (text == '') {
            alertPopupText.style.display = 'none';
        }
        else {
            alertPopupText.style.display = 'block';
            alertPopupText.innerHTML = text;
        }

        if (content == '') {
            alertPopupContent.style.display = 'none';
        }
        else {
            alertPopupContent.style.display = 'block';
            alertPopupContent.innerHTML = content;
        }

        const closeButton = document.getElementById('alertCloseButton');
        if (closeButton && !showCloseButton) {
            closeButton.style.display = 'none';
        }
        else {
            closeButton.style.display = 'block';
        }
    }
    else {
        alert(text + ' ' + content);
    }
}

/**
 * Closes an open alert popup. If a specific class was added to the popup when it was opened,
 * it can be specified here to ensure only popups with that class are closed.
 * 
 * @param {string|null} addedClass The class that was added to the popup, if any.
 */
export function alertPopupClose(addedClass = null) {
    const alertPopup = document.getElementById("alertPopup");
    if (alertPopup) {
        if (!addedClass || alertPopup.classList.contains(addedClass)) {
            if (addedClass) {
                alertPopup.classList.remove(addedClass);
            }
            popupManager.closePopup("alertPopup");
        }
    }
}

/**
 * Assigns a click event listener to the menu button. This function is part of the popup management
 * system and ensures that clicking the menu button opens the corresponding popup.
 * 
 * 
 * This function is typically called automatically when the page loads, but might need to be called
 * manually, when the button is added dynamically or when the button is replaced.
 */
export function assignMenuButton() {
    const menuButton = document.querySelector("button#menuButton");
    if (menuButton) {
        menuButton.addEventListener("click", () => {
            popupManager.openPopup("menu");
        });
    }
}

async function addAdminButtons() {
    const adminBar = document.getElementById("adminBar");
    if (adminBar) {
        if (await isAdminPromise) {
            const adminBarHtml = await generateMenuHTML('admin');
            adminBar.innerHTML = adminBarHtml;
            await loadCSS(urlPrefix + '/admin-style.css');

            const pageSpeedButton = document.createElement("button");
            pageSpeedButton.classList.add("menuButton");
            pageSpeedButton.innerHTML = `<span class="material-icons spaceRight">speed</span><span class="linkText">Page Speed Test</span>`;
            pageSpeedButton.onclick = function () {
                window.open(`https://pagespeed.web.dev/analysis?url=${window.location.href}`, '_blank');
            };
            adminBar.appendChild(pageSpeedButton);
        }
        else {
            adminBar.remove();
        }
    }
}