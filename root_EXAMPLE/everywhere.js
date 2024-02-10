// Required imports
import * as main from "./birdhouse/src/main.js";
import { hooks, hook, triggerHook } from './birdhouse/src/modules/hooks.js';
import { displayError, clearError } from "./birdhouse/src/modules/input-validation.js";

// Your custom imports
import Example from './src/components/example.js';

// More hooks might become available or necessary in the future.
// Remember to keep your everywhere.js file up to date with the latest version of the example everywhere.js file.

hook('before-adding-base-content', async function (menuHTML) {
    const headerElement = document.getElementById("header");
    if (!headerElement) {
        return;
    }

    headerElement.innerHTML = menuHTML;
});

hook('get-popup-menu-html', async function (menuHTML) {
    return `
    <div id="menu" class="popup">
		<div class="menuList fade-left-menu">
            <br>
            ${menuHTML}
            <br>
			<button class="closePopup menu"><span class="material-icons md-light spaceRight">close</span>Close</button>
		</div>
	</div>
    `;
});

hook('page-loaded', async function () {
    await onPageLoaded();
});

async function onPageLoaded() {
    // Let's add some base content that will be included on every page.
    main.addBaseContent(`
    <p id="testBaseContentText" class="hidden">Hey! This is some base content.</p> 
    `);

    // We now can do something with the added element, like opening an alert popup.
    const testBaseContentText = document.getElementById('testBaseContentText');
    if (testBaseContentText) {
        main.alertPopup('This is an alert popup', `
        <p>In the everywhere.js we added not only some invisible base content, but we also do get its content and display it here: "${testBaseContentText.innerText}"</p>
        <br>
        <p>You probably want to directly remove this alertPopup from the everywhere.js file.</p>
        `);
    }
}

hook('user-logged-in', async function () {
    // Triggered when a user is logged in
});

hook('add-markdown-patterns', async function (html) {
    // Let's add some custom markdown patterns
    const examplePattern = /\[example_pattern\]/g;

    // We can replcae the pattern with some HTML, even a with a whole component
    html = html.replace(examplePattern, await Example());

    return html;
});

hook('create-routes', async function () {
    // Let's create some routes.
    // Each route type will be added to the menu, based on the user's role.
    // So the menuHTML will be different for the public and user. The admin is also a user.
    // Of course, you can also create routes conditionally, for example based on time of day or user role.
    // You can even overwrite routes. So if you create a route with the same path, the previously defined route will be overwritten.

    // The most common route is the public route, which is accessible by everyone.
    main.createPublicRoute('/example', 'Example Page', 'article', 'components/example.js', true, 'example-page');
    main.createPublicRoute('/example-inputs', 'Example Inputs', 'input', 'components/example-inputs.js', true);

    // As we want something to view on our front page, let's reuse the example component, but not add it to the menu.
    main.createPublicRoute('/', 'Example Page', 'article', 'components/example.js', false, 'front-page');

    // We can also use the same component for different routes. But this time without an icon.
    main.createPublicRoute('/example-2', 'Also the Example Page', '', 'components/example.js', true);

    // The user route is only accessible by logged in users.
    main.createUserRoute('/example-for-users', 'Example Page for Users', 'account_circle', 'components/example.js', true);

    // The admin route is only accessible by logged in admins.
    main.createAdminRoute('/example-for-users', 'Example Page for Admins', 'admin_panel_settings', 'components/example.js', true);
});

hook('get-cookies-list', async function () {
    // Let's add some default cookies to the list.

    let cookies = [
        'storageAcknoledgement',
        'lastUpdateNote',
        'PHPSESSID'
    ];

    return cookies;
});

hook('get-allowed-paths-during-maintenance', async function () {
    // Let's add some paths that are allowed during maintenance.

    let allowedPathsDuringMaintenance = [
        'login',
        'login-password',
        'logout',
        'contact',
        'privacy-policy',
        'terms-of-service'
    ];

    return allowedPathsDuringMaintenance;
});

hook('get-spa-excluded-links', async function () {
    // Let's add some routes that are excluded from the single page application route handling.

    let excludedRoutes = [
        'database/logout.php',
    ];

    return excludedRoutes;
});

hook('get-storage-acknoledgement-popup-content', async function () {
    // Let's add some content to the storage acknoledgement popup.

    const content = `
            <h1>Welcome!</h1>
			<p>By clicking "I Understand and Agree", you allow this site to store cookies on your device and use the browsers local storage. These following cookies and local storage entries are used to enable improve your experience:</p>
            <ul>
            <li>A cookie ensures that you won't see this message pop up on your subsequent visits or page reloads.</li>
            <li>Another cookie remembers which version of the website you last confirmed on the Update Notes, saving you from repeated update popups on every page load.</li>
            <li>Login will require a cookie and if you are logged in, additional cookies and local storage entries are used to provide further functionality.</li>
            </ul>
            <p>These cookies and the use of local storage entries are necessary for the smooth functioning of our site. If you choose to close this popup without clicking "I Understand and Agree", nothing will be stored. If you deny the permission, session storage will be used to hide this popup. Thank you for your understanding!</p>
        `;

    return content;
});

hook('generate-menu-html', async function (menuItems) {
    // Here you can modify how the menuHTML is generated from the menu items that are created with createPublicRoute, createUserRoute and createAdminRoute.

    return menuItems
        .map(item => {
            let classes = 'menuButton closePopup';
            let extraHTML = '';
            if (item.materialIcon != '') {
                let additionClass = item.hasName ? "spaceRight" : "";
                extraHTML = `<span class="material-icons ${additionClass}">${item.materialIcon}</span>`;
            }
            return `<a href="${item.path}" class="${classes} text-${item.displayFull}">${extraHTML}<span class="linkText">${item.name}</span></a>`;
        })
        .join('');
});

hook('fetch-user-data', async function () {
    // Let's return some default user data. Normally you would fetch this from a database.

    //You can try the different user examples by uncommenting them one by one.

    //Remember to set userLoginEnabled to true in config.js to enable the user login system.

    //Admin user
    /* const userData = {
        'loggedIn': true,
        'userId': '0',
        'username': 'Example Admin',
        'isAdmin': true,
        'isUser': true,
    }; */

    //Normal user
    /* const userData = {
        'loggedIn': true,
        'userId': '1',
        'username': 'Example User',
        'isAdmin': false,
        'isUser': true,
    }; */

    //Not logged in user
    const userData = {
        'loggedIn': false,
        'userId': '',
        'username': '',
        'isAdmin': false,
        'isUser': false,
    };

    return new Response(JSON.stringify(userData), {
        headers: { 'Content-Type': 'application/json' },
    });
});

hook('check-remember-me', async function () {
    // If your backend confirms that the user is remembered (i.e. Token accepted), return true.
    // Returning true here, will then reload the page.

    return false;
});

hook('get-maintenance-mode', async function () {
    // Here you would fetch the maintenance mode status from your backend.

    return false;
});

hook('add-dynamic-routes', async function (path) {
    // Here you can add some dynamic routes based on the path.
    // For example, you could add a route for each user, based on the user's ID. Or maybe you want to create blog posts that are fetched from a database.
    // These routes are only created when the user visits the path. So you can add a lot of dynamic routes without slowing down the initial page load. This also means, that they can not be added to the menu automatically.

    // In this example, we add a dynamic route with the example component.
    main.createPublicRoute('/dynamic-route', 'Dynamic Route', '', 'components/example.js', false, 'dynamic-route');

    return false;
});

hook('database-get-setting', async function (name, cacheSetting) {
    // Here you would fetch a setting from your backend.
    // In this example, we just return a default setting as a json response.

    return new Response(JSON.stringify({ value: 'exampleSetting' }), {
        headers: { 'Content-Type': 'application/json' },
    });
});

hook('database-set-setting', async function (name, value) {
    // Here you would set a setting in your backend.
    // In this example, we just return a success message as a json response.

    return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
    });
});

hook('send-analytics', async function (value) {
    // Here you would send analytics data to your backend.
    // In this example, we just log the value to the console.

    console.log('Analytics:', value);
});

hook('validate-field', async function (input, value, errorElement, serverSide) {
    // This hook is triggered when a field is validated. You can use it to add custom validation rules.
    // If there are no errors, the error of the field will be cleared automatically if nothing or true is returned.

    if (input.name === 'exampleInput' && value.length != 8) {
        displayError(input, errorElement, 'Example input must be 8 characters long.');
        return false;
    }

    // You can also clear the error of another field (not the one that is currently being validated) by using the clearError(input, errorElement) function.

    if (serverSide) {
        // Here you can add server side validation. For example, you could check if a username already exists in your database.
        // The server side validation has a longer debounce to reduce the amount of requests to your server.

        /* const response = await checkUsernameExistence(value);
        if (response.exists) {
            displayError(input, errorElement, 'Username already exists.');
            return false;
        } */
    }

    //Please remember, that all input/textarea elements should have a label element surrounding them. This is needed for the automatic error message placement.
});