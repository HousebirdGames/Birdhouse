/*
This file defines the PopupManager class responsible for managing popups throughout the application.
It handles the opening and closing of popups, ensuring that focus management and accessibility are taken into account.


The PopupManager is automatically instantiated in `main.js`, where a global reference is maintained for easy access across the application.
Use this class to programmatically control popups, such as opening a popup when a button is clicked or closing it when the user interacts with a close button.


You can import the `popupManager` instance from `main.js` to access the PopupManager class and its methods: `openPopup` and `closePopup`.
Use popupManager.openPopup(popupID) to open a popup by its ID and popupManager.closePopup(popupID) to close a popup by its ID.
 */

import { resizeAllTextareas } from "../../../Birdhouse/src/main.js";

/**
 * Manages the display and behavior of popups within the application.
 * 
 * 
 * Handles user interactions such as clicking outside the popup to close it or clicking the close button.
 * 
 * 
 * Ensures that focus is managed correctly for accessibility purposes when a popup is opened or closed.
 */
export default class PopupManager {
    constructor() {
        document.addEventListener('click', (event) => {
            if (event.target.matches('.closePopup')) {
                const parentPopup = event.target.closest('.popup');
                if (parentPopup) {
                    this.closePopup(parentPopup.id);
                }
            }

            if (event.target.matches('.popup')) {
                const popupId = event.target.id;

                if (event.target.classList.contains("keepOpen")) {
                    return;
                }

                this.closePopup(popupId);
            }
        });
    }

    /**
     * Opens a popup by its ID. Sets the display property to block, applies a fade-in animation, and adjusts
     * tabindex for focusable elements outside the popup to ensure that keyboard navigation is confined to the popup.
     * 
     * @param {string} popupID The ID of the popup to open.
     */
    openPopup(popupID) {
        const popup = document.getElementById(popupID);
        if (popup) {
            console.log('Opening popup');
            Array.from(document.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).forEach(el => {
                if (!popup.contains(el)) {
                    el.setAttribute('data-prev-tabindex', el.tabIndex);
                    el.setAttribute('tabindex', '-1');
                }
            });

            popup.classList.remove('fade-in-fast');
            popup.classList.remove('fade-out-fast');
            popup.classList.add('fade-in-fast');
            popup.style.display = 'block';
            document.body.classList.add('body-no-scroll');
            resizeAllTextareas();
        }
    }

    /**
     * Closes a popup by its ID. Resets the display property to none, applies a fade-out animation, and restores
     * the tabindex of all elements affected when the popup was opened.
     * 
     * @param {string} popupID The ID of the popup to close.
     */
    closePopup(popupID) {
        const popup = document.getElementById(popupID);
        if (popup) {
            Array.from(document.querySelectorAll('[data-prev-tabindex]')).forEach(el => {
                el.setAttribute('tabindex', el.getAttribute('data-prev-tabindex'));
                el.removeAttribute('data-prev-tabindex');
            });

            popup.classList.remove('fade-out-fast');
            popup.classList.remove('fade-in-fast');
            popup.classList.add('fade-out-fast');
            setTimeout(() => {
                popup.style.display = 'none';
            }, 200);
        }
        document.body.classList.remove('body-no-scroll');
    }
}
