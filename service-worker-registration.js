import { alertPopup } from "../birdhouse/src/main.js";

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

function updateApp() {
    window.location.reload();
}