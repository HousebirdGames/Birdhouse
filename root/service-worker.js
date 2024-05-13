/*
The service worker is a fundamental component for enabling a progressive web app to operate offline.
By caching essential files listed in the filesToCache.js script — automatically generated during the
project's build process — it ensures that these files are available from the cache when no network
connection is available.


During deployment, the build pipeline automatically relocates the service worker to the root
directory of the project. It also generates a config-sw.js file based on your project's config.js
file. This configuration specifies the cache version and outlines which paths should be excluded
from caching. The cache version, dictated by config.js, is pivotal for cache management and is
refreshed anytime there's a version update via the pipeline.


When handling requests to the database (indicated by URLs starting with "database/..."), the
service worker attempts to fetch the data from the network first. If the network request fails,
it looks for the data in the cache. Failing to find the data in the cache too, it returns a status
code of 503, signaling service unavailability. This approach ensures data availability, even in
offline scenarios, enhancing the user experience by leveraging modern web capabilities.
*/

self.CACHE_VERSION = "1.0.0.0";
importScripts('./config-sw.js' + `?v=${self.CACHE_VERSION}`);
self.importScripts('Birdhouse/filesToCache.js' + `?v=${self.CACHE_VERSION}`);

self.addEventListener('install', function (event) {
    event.waitUntil(cacheFiles().then(() => self.skipWaiting()));
});

function cacheFiles() {
    return caches.open(self.CACHE_VERSION).then(function (cache) {
        const filesWithCacheVersion = filesToCache.map(file => `${file}?v=${self.CACHE_VERSION}`);
        return cache.addAll(filesWithCacheVersion)
            .catch(function (error) {
                console.error('Error caching files:', error);
            });
    });
}

self.addEventListener('activate', function (event) {
    event.waitUntil(
        cacheFiles().then(() =>
            caches.keys().then(function (cacheNames) {
                return Promise.all(
                    cacheNames.map(function (cacheName) {
                        if (self.CACHE_VERSION !== cacheName) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            }))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('message', event => {
    if (event.data && event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', function (event) {
    var request = event.request;

    if (self.config && self.config.excludedPaths && self.config.excludedPaths.some(path => request.url.includes(path))) {
        event.respondWith(fetch(request));
        return;
    }

    if (request.method === 'POST') {
        event.respondWith(
            fetch(request).catch(function () {
                return new Response(JSON.stringify({ success: false, message: 'You are offline: This action cannot be performed' }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 503,
                    statusText: 'Service Unavailable'
                });
            })
        );
        return;
    }

    if (request.url.includes('database/')) {
        event.respondWith(
            fetch(request)
                .then(function (response) {
                    var responseToCache = response.clone();
                    caches.open(self.CACHE_VERSION).then(function (cache) {
                        cache.put(request, responseToCache);
                    });
                    return response;
                })
                .catch(function () {
                    return caches.match(request)
                        .then(function (response) {
                            if (response) {
                                return response;
                            } else {
                                return new Response('You are offline: The requested data is not available', { status: 503 });
                            }
                        });
                })
        );
    }
    else {
        var urlWithoutQuery = request.url;

        if (event.request.mode === 'navigate') {
            urlWithoutQuery = '/index.html';
        }

        var updatedRequest = new Request(urlWithoutQuery + `?v=${self.CACHE_VERSION}`, {
            method: request.method,
            headers: request.headers,
            mode: 'cors',
            credentials: request.credentials,
            redirect: request.redirect,
            referrer: request.referrer,
            integrity: request.integrity
        });

        event.respondWith(
            caches.match(updatedRequest, { ignoreSearch: false })
                .then(function (response) {
                    if (response) {
                        return response;
                    }

                    if (request.url.includes('manifest.json')) {
                        return fetch(request)
                            .then(response => {
                                if (!response || response.status !== 200) {
                                    console.error('Failed to fetch manifest.json');
                                    throw new Error('Failed to fetch manifest.json');
                                }
                                return response;
                            })
                            .catch(error => {
                                console.error('Fetch failed for manifest.json', error);
                                throw error;
                            });
                    }

                    var fetchRequest = request.clone();

                    return fetch(fetchRequest).then(
                        function (response) {
                            if (!response || response.status !== 200) {
                                return response;
                            }

                            var responseToCache = response.clone();

                            caches.open(self.CACHE_VERSION)
                                .then(function (cache) {
                                    cache.put(updatedRequest, responseToCache);
                                });

                            return response;
                        }
                    ).catch(function () {
                        return caches.match(`/index.html?v=${self.CACHE_VERSION}`)
                            .catch(() => new Response('You are offline: This action cannot be performed'));
                    });
                })
        );
    }
});