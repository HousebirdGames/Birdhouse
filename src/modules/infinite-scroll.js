export default function InfiniteScroll(config) {
    let initialLimit = config.initialLimit || 3;
    let add = config.add || 0;
    let initialPage = config.page || 1;
    let limit, page;
    let handleScrollDebounced = debounce(handleScroll, 200);
    let container = config.container;
    let fetchURL = config.fetchURL;
    let displayFunction = config.displayFunction;
    let searchParameter = config.searchParameter || (() => '');
    let emptyMessage = config.emptyMessage || 'Currently empty';
    let storageType = config.storageType;
    let isCooldown = false;
    let pendingArgs = null;
    let isSetup = false;

    async function fetchItems(url) {
        if (storageType) {
            let storage = storageType === 'local' ? localStorage : sessionStorage;
            let bundleKey = `InfiniteScroll-Cache-${container.id}`;
            let cacheBundle = JSON.parse(storage.getItem(bundleKey)) || {};
            let cacheKey = url;

            if (cacheBundle[cacheKey]) {
                return Promise.resolve(cacheBundle[cacheKey]);
            } else {
                return fetch(url)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Network response was not ok');
                        }
                        return response.text().then(text => {
                            try {
                                let json = JSON.parse(text);
                                cacheBundle[cacheKey] = json;
                                storage.setItem(bundleKey, JSON.stringify(cacheBundle));
                                return json;
                            } catch (error) {
                                console.error('Failed to parse response as JSON:', error);
                                return false;
                            }
                        });
                    })
                    .catch(error => {
                        console.error('There has been a problem with the fetch operation:', error);
                        return false;
                    });
            }
        } else {
            return fetchAndProcess(url);
        }
    }

    function fetchAndProcess(url) {
        return fetch(url)
            .then(handleResponse)
            .catch(handleError);
    }

    function handleResponse(response) {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.text().then(text => {
            try {
                return JSON.parse(text);
            } catch (error) {
                console.error('Failed to parse response as JSON:', error);
                return false;
            }
        });
    }

    function handleError(error) {
        console.error('There has been a problem with the fetch operation:', error);
        return false;
    }

    async function addMoreItems(items, fadeIn = true) {
        if (!container) {
            console.error('Container does not exist');
            return;
        }

        const itemsHtml = await displayFunction(items, false, fadeIn);

        if (itemsHtml) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = itemsHtml;

            while (tempDiv.firstChild) {
                container.appendChild(tempDiv.firstChild);
            }
        }

        displayNoItemsMessage();
    }

    function displayNoItemsMessage() {
        removeLoadingSymbol();
        if (container.innerHTML.trim() === '') {
            let searchQuery = searchParameter();
            let search = searchQuery.slice(searchQuery.indexOf('=') + 1);

            const messageHtml = `<div class="no-items-message">${searchQuery ? `Nothing found while searching for "${search}"` : emptyMessage}</div>`;
            container.innerHTML = messageHtml;
        }
    }

    function displayOfflineMessage() {
        removeLoadingSymbol();
        if (container.innerHTML.trim() === '') {
            const messageHtml = `<div class="no-items-message">You are offline and nothing was cached yet</div>`;
            container.innerHTML = messageHtml;
        }
    }

    function handleScroll() {
        const rect = container.getBoundingClientRect();
        const isAtBottom = (rect.bottom <= window.innerHeight + 2000);

        if (isAtBottom) {
            const loadingSymbol = document.getElementById('logoLoadingSymbol');
            if (loadingSymbol && loadingSymbol.classList.contains('smoothHide')) {
                loadingSymbol.classList.remove('smoothHide');
            }

            removeLoadingSymbol();
            appendLoadingSymbol();

            const newLimit = limit + add;
            const newPage = page + 1;

            const separator = fetchURL.includes('?') ? '&' : '?';
            fetchItems(`${fetchURL}${separator}${searchParameter()}&limit=${newLimit}&page=${newPage}`).then(response => {
                setTimeout(() => {
                    if (loadingSymbol) {
                        loadingSymbol.classList.add('smoothHide');
                    }
                }, 100);

                if (response === false) {
                    displayOfflineMessage();
                    teardown();
                } else {
                    const items = response.items;

                    if (items) {
                        if (items.length < newLimit) {
                            displayNoItemsMessage();
                            teardown();
                        } else {
                            limit = newLimit;
                            page = newPage;
                            addMoreItems(items);
                        }
                    }
                    else {
                        teardown();
                    }
                }
            });
        }
    }

    function resetState() {
        limit = initialLimit;
        page = initialPage;
    }

    async function setup(emptyContainer = false, fadeIn = true) {
        if (isSetup || !container || !document.contains(container)) {
            return;
        }

        resetState();
        window.addEventListener('scroll', handleScrollDebounced);
        const separator = fetchURL.includes('?') ? '&' : '?';

        container.innerHTML = '';
        appendLoadingSymbol();

        await fetchItems(`${fetchURL}${separator}${searchParameter()}&limit=${limit}&page=${page}`)
            .then(async (response) => {
                if (emptyContainer) {
                    console.log('Emptying container');
                    container.innerHTML = '';
                }

                if (response === false) {
                    displayOfflineMessage();
                } else {
                    const items = response.items;
                    if (items) {
                        await addMoreItems(items, fadeIn);
                    }
                    else {
                        displayNoItemsMessage();
                    }
                }
            });

        isSetup = true;
    }

    function teardown() {
        if (!isSetup) {
            return;
        }

        window.removeEventListener('scroll', handleScrollDebounced);
        isSetup = false;

        removeLoadingSymbol();
    }

    function appendLoadingSymbol() {
        const loadingHtml = '<div class="loadingSymbolWrap"><div class="loadingSymbol"></div></div>';
        container.insertAdjacentHTML('beforeend', loadingHtml);
    }

    function removeLoadingSymbol() {
        const loadingElement = container.querySelector('.loadingSymbolWrap');
        if (loadingElement) {
            loadingElement.remove();
        }
    }

    function refresh() {
        if (isCooldown) {
            pendingArgs = arguments;
            return;
        }

        isCooldown = true;
        setTimeout(() => {
            isCooldown = false;
            if (pendingArgs) {
                refresh.apply(this, pendingArgs);
                pendingArgs = null;
            }
        }, 1000);

        if (!container || !document.contains(container)) {
            return;
        }

        if (isSetup) {
            teardown();
        }

        resetState();
        setup(true, false);
    }

    return { setup, teardown, refresh, isSetup: () => isSetup };
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}