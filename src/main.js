/*Birdhouse was created and published by Felix T. Vogel in 2024*/

import { } from '../../Birdhouse/src/modules/hooks.js';
import PopupManager from '../../Birdhouse/src/modules/popupManager.js';
import { updateNotes } from '../../updateNotes.js';
import { getSetting } from "../../Birdhouse/src/modules/database-settings.js";
import Analytics from "../../Birdhouse/src/modules/analytics.js";
import { initializeInputValidation } from '../../Birdhouse/src/modules/input-validation.js';
import { } from '../../everywhere.js';
import config from '../../config.js';

export let popupManager = null;
export const urlPrefix = (window.location.pathname.toLowerCase().startsWith(config.localhostPath.toLowerCase()) ? config.localhostPath.toLocaleLowerCase() : '').toLowerCase();
const redirect404ToHome = true;
const anchorScrollOffset = 54;
const excludedPaths = [].map(path => path.toLowerCase());

export let dynamicRoute = false;

const actions = [];

export function action(action) {
    if (typeof action === 'function') {
        actions.push(action);
    } else {
        const handler = (event) => {
            if (action.selector) {
                if (event.target.matches(action.selector)) {
                    action.handler(event);
                }
            } else {
                action.handler(event);
            }
        };
        actions.push({ ...action, handler });
    }
}

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

export let userData = null;
let fetchingUserData = false;
export let isMaintenanceMode = config.maintenanceModeWithFailedBackend != undefined ? config.maintenanceModeWithFailedBackend : true;
export const cookieIdentifier = `_${sanitizeIdentifier(config.cookieIdentifier)}`;

export function sanitizeIdentifier(title) {
    return title.replace(/[\s,;=]/g, '_');
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

async function checkRememberMe() {
    const remembered = await window.triggerHook('check-remember-me') || false;

    if (remembered) {
        window.location.reload();
    }
}

export async function fetchItems(url) {
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    const responseData = await response.json();
    if (response.ok) {
        return responseData.items;
    } else {
        console.error('Failed to fetch data:', responseData.message);
        alertPopup('Failed to fetch data');
        return [];
    }
}

fetchUserData().catch(error => console.error('Error fetching user data:', error));

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

export const isAdminPromise = getIsAdmin();
export const isUserPromise = getIsUser();

const routesArray = [];

function findRoute(path) {
    return routesArray.find(route => route.path.toLowerCase() === path.toLowerCase());
}

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

export function createAdminRoute(slug, name, materialIcon, componentPath, inMenu = true, data = null, dynamic = false) {
    componentPath = urlPrefix + '/src/' + componentPath;
    const route = {
        path: (urlPrefix + slug).toLowerCase(),
        name: name,
        type: 'admin',
        inMenu: inMenu,
        materialIcon: materialIcon,
        componentPath: componentPath,
        dynamic: dynamic,
        displayFull: true,
        Handler: async function () {
            try {
                if (!(await isAdminPromise)) {
                    return 'Not authorized to access this page';
                }

                const { default: Component } = await import(componentPath);
                const content = await Component(data).catch((error) => {
                    console.error(error);
                    return failedToLoadComponent();
                });
                return content;
            } catch (error) {
                console.error(error);
                return failedToLoadComponent();
            }
        }
    };
    routesArray.push(route);
}

export function createUserRoute(slug, name, materialIcon, componentPath, inMenu = true, data = null, displayFull = true, dynamic = false) {
    componentPath = urlPrefix + '/src/' + componentPath;
    const route = {
        path: (urlPrefix + slug).toLowerCase(),
        name: name,
        type: 'user',
        inMenu: inMenu,
        materialIcon: materialIcon,
        componentPath: componentPath,
        dynamic: dynamic,
        displayFull: displayFull,
        Handler: async function () {
            try {
                if (!(await isUserPromise)) {
                    return `
                    <div class="contentBox accent center fitContent"><h2>Only logged in users can see this page</h2>
                    <div class="linkRow">
                    <a href="${urlPrefix}/login" class="button"><span class="material-icons spaceRight">person</span>Login</a>
                    <a href="${urlPrefix}/registration" class="button highlight"><span class="material-icons spaceRight">task_alt</span>Register</a>
                    </div></div>`;
                }

                const { default: Component } = await import(componentPath);
                const content = await Component(data).catch((error) => {
                    console.error(error);
                    return failedToLoadComponent();
                });
                return content;
            } catch (error) {
                console.error(error);
                return failedToLoadComponent();
            }
        }
    };
    routesArray.push(route);
}

export function createPublicRoute(slug, name, materialIcon, componentPath, inMenu = true, data = null, dynamic = false) {
    componentPath = urlPrefix + '/src/' + componentPath;
    const route = {
        path: (urlPrefix + slug).toLowerCase(),
        name: name,
        type: 'public',
        inMenu: inMenu,
        materialIcon: materialIcon,
        componentPath: componentPath,
        dynamic: dynamic,
        displayFull: true,
        Handler: async function () {
            try {
                const { default: Component } = await import(componentPath);
                const content = await Component(data).catch((error) => {
                    console.error(error);
                    return failedToLoadComponent();
                });
                return content;
            } catch (error) {
                console.error(error);
                return failedToLoadComponent();
            }
        }
    };
    routesArray.push(route);
}

export function normalizePath(path) {
    path = path.toLowerCase();

    let normalizedPath = path;

    if (path !== urlPrefix + "/" && path.endsWith("/")) {
        normalizedPath = path.slice(0, -1);
    }

    for (const excludedPath of excludedPaths) {
        if (normalizedPath === excludedPath.toLowerCase() || normalizedPath === excludedPath.toLowerCase() + '/') {
            window.location.href = excludedPath;
            return;
        }
    }

    return normalizedPath;
}

export function getRelativePath(relativePath) {
    return new URL(relativePath, window.location.origin + urlPrefix + '/').pathname;
}

export async function addAdditionalComponent(componentPath, data = null) {
    const content = document.getElementById("content");
    if (content) {
        const additionalComponent = await getComponent(componentPath, data).catch((error) => {
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

export async function handleRouteChange() {
    if (isHandlingRouteChange) {
        return;
    }

    isHandlingRouteChange = true;

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

    if (!component) {
        if (redirect404ToHome) {
            window.location.replace(`${urlPrefix}/`);
        } else if (content) {
            content.innerHTML = '<div class="contentBox"><h1>Oups! Something went wrong.</h1></div>';
        }
    } else {
        if (content) {
            try {
                let contentHTML = '';

                contentHTML = await component();
                await window.triggerHook('on-component-loaded');

                content.innerHTML = contentHTML;

                scroll();
            } catch (error) {
                console.error(error);
                content.innerHTML = '<div class="contentBox"><h1>Oups! Something went wrong.</h1></div>';
                unmountActions();
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
}

function scroll() {
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

document.addEventListener("DOMContentLoaded", async () => {
    routesArray.push({
        path: '*',
        type: 'public',
        Handler: function NotFoundRouteHandler() {
            return `<div class="contentBox accent"><h1>404 Not Found</h1>
            <p>The page you're trying to access doesn't exist or has been moved. Please check the URL and try again.</p>
            <p>If you believe this is an error, please <a class="underline" href="${urlPrefix}/contact">contact us</a>.</p>
            </div>`;
        }
    });

    routesArray.push({
        path: 'offline',
        type: 'public',
        Handler: function NotFoundRouteHandler() {
            return `<div class="contentBox accent"><h1>Are you offline?</h1><p>Maybe you have lost your internet connection or the server is down. Please make sure you are connected to the internet and try again.</p></div>`;
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

    await window.triggerHook('after-adding-base-content', menuHTML);

    assignMenuButton();
    assignInstallButton();

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

export function addBaseContent(htmlContent) {
    const baseContent = document.getElementById("baseContent");
    baseContent.insertAdjacentHTML('beforeend', htmlContent);
}

export async function redirectUserToDashboard() {
    if (await isUserPromise) {
        window.location.replace(`${urlPrefix}/dashboard`);
    }
}

function failedToLoadComponent() {
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

export function goToRoute(href) {
    if (!href.startsWith('#')) {
        const normalizedHref = normalizePath(href);
        history.pushState(null, '', normalizedHref);
        handleRouteChange();
    }
}

function assignInstallButton() {
    let deferredPrompt;

    const installButton = document.getElementById('installButton');

    if (installButton) {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            installButton.style.display = 'flex';
        });

        installButton.addEventListener('click', (e) => {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
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
            deferredPrompt = null;
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
              ${latestPatch.title ? `<h4 class="leftText">New: Version ${latestPatch.version}</h4><h2>${latestPatch.title}</h2>` : `<h4 class="leftText"></h4><h2>New Version ${latestPatch.version}</h2>`}
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
                    updateContent.querySelector("h2").textContent = `${patch.title ? `${patch.title}` : `Version ${patch.version}`}`;
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

export async function getMenuHTML() {
    if (await isUserPromise) {
        return await generateMenuHTML('user');
    }
    else {
        return await generateMenuHTML('public');
    }
}

let textareaResizerAdded = false;
let resizeTimeout;
let debounceTimeout;

export function textareaResizer() {
    if (!textareaResizerAdded) {
        document.body.addEventListener('input', delegateResize);
        document.body.addEventListener('click', delegateResize);
        let windowWidth = window.innerWidth;

        window.addEventListener('resize', () => {
            if (window.innerWidth !== windowWidth) {
                resizeAllTextareasDelayed();
                windowWidth = window.innerWidth;
            }
        }, { passive: true });

        textareaResizerAdded = true;
    }

    resizeAllTextareasDelayed();

    function debounce(func, delay) {
        return function (...args) {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => func.apply(this, args), delay);
        }
    }

    function resizeAllTextareasDelayed() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            resizeAllTextareas();
        }, 100);
    }

    function delegateResize(event) {
        if (event.target.tagName.toLowerCase() === 'textarea') {
            requestAnimationFrame(() => {
                event.target.scrollTop = 0;
            });
            debounce(resizeOne.bind(event.target), 0)();
        }
    }

    function resizeOne() {
        const currentPosition = window.scrollY;
        const currentHeight = this.style.height;
        this.style.height = 'auto';
        const newHeight = this.scrollHeight + 4 + 'px';

        this.style.height = currentHeight;
        this.scrollTop = 0;

        requestAnimationFrame(() => {
            this.style.height = newHeight;
            this.scrollTop = 0;
            window.scrollTo(0, currentPosition);
        });
    }

}

export function resizeAllTextareas() {
    const allTextareas = document.querySelectorAll('textarea');
    const textareas = Array.from(allTextareas);

    textareas.forEach(textarea => {
        textarea.style.height = 'auto';
    });

    const scrollHeights = textareas.map(textarea => textarea.scrollHeight);

    window.requestAnimationFrame(() => {
        textareas.forEach((textarea, index) => {
            textarea.style.height = scrollHeights[index] + 4 + 'px';
        });
    });
}

export function isInViewport(element, offset = 0) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= -offset &&
        rect.left >= -offset &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) + offset &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth) + offset
    );
}

window.CopyToClipboard = function CopyToClipboardFromID(id) {
    const text = document.getElementById(id).innerText;
    navigator.clipboard.writeText(text).then(function () {
        alertPopup('Copied to clipboard', 'Copied: ' + string);
    }, function (err) {
        console.error('Could not copy text: ', err);
    });
}

window.CopyToClipboard = function CopyToClipboard(string, openPopup = true) {
    navigator.clipboard.writeText(string).then(function () {
        if (openPopup) {
            alertPopup('Copied to clipboard', 'Copied: ' + string);
        }
    }, function (err) {
        console.error('Could not copy text: ', err);
    });
}

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

export function roundToHalf(value) {
    return Math.round(value * 2) / 2;
}

export function roundToFull(value) {
    return Math.round(value);
}

export function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = days ? `; expires=${date.toUTCString()}` : '';
    document.cookie = `${name + cookieIdentifier}=${value}${expires}; path=/`;
}

export function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name + cookieIdentifier}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

export function setSessionStorageItem(key, value) {
    if (getCookie("storageAcknowledgement") === 'true' || key == "denyStorage") {
        try {
            sessionStorage.setItem(key, value);
        } catch (e) {
            console.error('Failed to set item in sessionStorage:', e);
        }
    }
}

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

export function deleteSessionStorageItem(key) {
    try {
        sessionStorage.removeItem(key);
    } catch (e) {
        console.error('Failed to remove item from sessionStorage:', e);
    }
}

export function setLocalStorageItem(key, value) {
    if (getCookie("storageAcknowledgement") === 'true') {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.error('Failed to set item in localStorage:', e);
        }
    }
}

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

export function deleteLocalStorageItem(key) {
    try {
        localStorage.removeItem(key);
    } catch (e) {
        console.error('Failed to remove item from localStorage:', e);
    }
}

export function getQueryParameterByName(name, url = window.location.href) {
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)', 'i'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

export function updateOrAddQueryParameter(name, value, url = window.location.href) {
    const urlObj = new URL(url);
    urlObj.searchParams.set(name, value);

    window.history.pushState({ path: urlObj.href }, '', urlObj.href);
}

export function removeQueryParameter(name, url = window.location.href) {
    const urlObj = new URL(url);
    urlObj.searchParams.delete(name);

    window.history.pushState({ path: urlObj.href }, '', urlObj.href);
}

function loadCSS(url) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = getRelativePath(url) + '?v=' + config.version;

    document.head.appendChild(link);
}

const deleteAllCookies = () => {
    const cookies = document.cookie.split(";");

    for (const cookie of cookies) {
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    }
};

const deleteSpecificCookies = (cookieNames) => {
    for (const name of cookieNames) {
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    }
};

const deleteSpecificLocalStorageEntries = (keys) => {
    for (const key of keys) {
        localStorage.removeItem(key);
    }
};

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
            loadCSS(urlPrefix + '/admin-style.css');

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