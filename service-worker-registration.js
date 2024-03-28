/*
This script handles the registration of the service worker for the application. It is imported in the default
index.html file.


It ensures that new updates to the service worker are detected and prompts the user to update the application.
Upon detecting an update, a popup is displayed, giving the user the option to update the app immediately.


This script is a crucial part of enabling offline capabilities and ensuring that users have access to the latest version of the application.
*/

import { alertPopup } from "../Birdhouse/src/main.js";

navigator.serviceWorker.register('service-worker.js').then(function (registration) {
    registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                const updatePopup = document.getElementById('newUpdatePopup');
                const updateButton = document.getElementById('update-version-btn');
                if (updatePopup && updateButton) {
                    updatePopup.style.display = 'block';
                    updateButton.addEventListener("click", () => {
                        updateButton.disabled = true;
                        alertPopup('Updating', '<p class="centerText">Please wait while the app is updated...</p><div class="loadingSymbolWrap"><div class="loadingSymbol"></div></div>', false, 'keepOpen');
                        if (registration.waiting) {
                            registration.waiting.postMessage({ action: 'skipWaiting' });
                        }
                        updateApp();
                    });
                }
            }
        });
    });
    registration.update();
    console.log('ServiceWorker registration successful with scope: ', registration.scope);
}, function (err) {
    console.log('ServiceWorker registration failed: ', err);
});

/**
 * Forces the application to reload, triggering the activation of a new service worker if one is waiting.
 * This function is called when the user agrees to update the application to the latest version.
 * It ensures that the latest assets are fetched and used by the application.
 */
function updateApp() {
    window.location.reload();
}