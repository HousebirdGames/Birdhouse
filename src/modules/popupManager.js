import { resizeAllTextareas } from "../../../birdhouse/src/main.js";

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

    openPopup(popupId) {
        const popup = document.getElementById(popupId);
        if (popup) {
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
            resizeAllTextareas();
        }
    }

    closePopup(popupId) {
        const popup = document.getElementById(popupId);
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
    }
}
