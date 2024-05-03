/*
This script handles the registration of the service worker for the application. It is imported in the default
index.html file.


It ensures that new updates to the service worker are detected and prompts the user to update the application.
Upon detecting an update, a popup is displayed, giving the user the option to update the app immediately.


This script is a crucial part of enabling offline capabilities and ensuring that users have access to the latest version of the application.
*/

import { alertPopup } from "../Birdhouse/src/main.js";

if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
    console.log('ServiceWorker not supported in this environment');
    window.navigator.serviceWorker.getRegistrations().then(function (registrations) {
        for (let registration of registrations) {
            registration.unregister();
        }
    });
} else {
    fetch('config.js?no-cache=' + new Date().getTime(), { cache: 'no-store' })
        .then(response => response.text())
        .then(text => {
            let version = '';
            try {
                let versionMatch = text.match(/"?\bversion\b"?\s*:\s*"([^"]*)"/);
                version = versionMatch ? versionMatch[1] : '';
            } catch (err) {
                console.error('Failed to extract version from config.js', err);
            }

            console.log('ServiceWorker version:', version);

            navigator.serviceWorker.register('service-worker.js').then(registration => {
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            if (version.split('-').length > 1) {
                                console.log('Updating the app...');
                                if (registration.waiting) {
                                    registration.waiting.postMessage({ action: 'skipWaiting' });
                                }
                                if (version.split('-').includes('f')) {
                                    console.log('Initiating page reload...');
                                    updateApp(registration);
                                }
                            } else {
                                showUpdateNotification(registration);
                            }
                        }
                    });
                });
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            }, err => {
                console.log('ServiceWorker registration failed: ', err);
            });
        });
}

function showUpdateNotification(registration) {
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
            updateApp(registration);
        });
    }
}

function updateApp(registration) {
    window.location.reload();
}