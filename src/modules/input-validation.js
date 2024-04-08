/*
This file provides functionality for validating input and textarea elements across the application.


It integrates both client-side and server-side validation mechanisms, debouncing calls to improve performance.


When `enableInputValidation` is set to true in `config.js`, `main.js` automatically initializes this validation process.
So there is probably no need to call these functions manually, except for the clearError function, when implementing
custom validation logic through the `validate-field` hook or maybe the `validateEmail` function.
*/

/**
 * Attaches event listeners to the document body to perform input validation on all input and textarea elements.
 * This function is automatically called if input validation is enabled in the application configuration.
 */
export function initializeInputValidation() {
    document.body.addEventListener('click', function (event) {
        validateInputs(event)
    });
    document.body.addEventListener('input', function (event) {
        validateInputs(event)
    });
    document.body.addEventListener('focusin', function (event) {
        validateInputs(event)
    });
}

const debouncedValidateInputClient = debounce(validateInputClient, 100);
const debouncedValidateInputServer = debounce(validateInputServer, 2000);
/**
 * Validates input elements on the document body by debouncing and calling validation functions.
 * It distinguishes between client-side and server-side validation depending on the input's requirements.
 * 
 * @param {Event} event The DOM event triggered by user interaction with input or textarea elements.
 */
export function validateInputs(event) {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.tagName === 'SELECT' || event.target.tagName === 'BUTTON') {
        debouncedValidateInputClient(event);
        debouncedValidateInputServer(event);
    }
}

let ongoingValidation = null;
async function validateInput(event, serverSide) {
    if (ongoingValidation) {
        await ongoingValidation;
    }

    ongoingValidation = (async () => {
        const input = event.target;
        if (input.classList.contains('noValidation')) {
            return;
        }

        const errorElement = addMissingErrorMessage(input);

        await validateField(input, errorElement, serverSide);
    })();

    await ongoingValidation;
    ongoingValidation = null;
}

function addMissingErrorMessage(input) {
    const label = input.closest('label');
    let errorElement = label ? label.querySelector('.error-message') : null;

    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.classList.add('error-message');
        if (label) {
            label.appendChild(errorElement);
        } else {
            return null;
        }
    }

    return errorElement;
}

/**
 * Debounced wrapper for client-side validation of input elements.
 *
 * @param {Event} event The DOM event triggered by user interaction with input or textarea elements.
 */
export async function validateInputClient(event) {
    validateInput(event, false);
}

/**
 * Debounced wrapper for server-side validation of input elements.
 * This validation may involve asynchronous checks with the server to validate the input's content.
 *
 * @param {Event} event The DOM event triggered by user interaction with input or textarea elements.
 */
export async function validateInputServer(event) {
    validateInput(event, true);
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

/**
 * Displays an error message associated with an input element.
 *
 * @param {HTMLElement} input The input element that has encountered a validation error.
 * @param {HTMLElement} errorElement The DOM element where the error message will be displayed.
 * @param {string} message='' The error message to display. If not provided, no message will be displayed.
 */
export function displayError(input, errorElement, message = '') {
    if (input && errorElement) {
        input.classList.add('invalid');
        errorElement.textContent = message;
        errorElement.style.maxHeight = `${errorElement.scrollHeight}px`;
    }
    else if (input && !errorElement) {
        console.warning('errorElement is missing on input element', input);
        console.error('Error message:', message);
    }
}

/**
 * Clears any displayed error message associated with an input element.
 *
 * @param {HTMLElement} input The input element for which to clear the validation error.
 * @param {HTMLElement} errorElement The DOM element that currently displays the error message.
 */
export function clearError(input, errorElement) {
    if (input) {
        input.classList.remove('invalid');
    }

    if (errorElement) {
        errorElement = addMissingErrorMessage(input);
        errorElement.style.maxHeight = '0';
    }
}

/**
 * Performs the actual validation of an input field. This function is called by both client-side and server-side validation handlers.
 * It checks for common validation criteria such as minimum length, maximum length, and email format.
 * 
 * This is were the `validate-field` hook is triggered, allowing for custom validation logic to be implemented. If the hook returns false,
 * the error message is not cleared.
 *
 * @param {HTMLElement} input The input element to validate.
 * @param {HTMLElement} errorElement The element to display error messages in.
 * @param {boolean} serverSide=true Determines whether the validation should consider server-side logic.
 */
export async function validateField(input, errorElement, serverSide = true) {
    const value = input.value;

    if (input.minLength > 0 && value.length < input.minLength) {
        displayError(input, errorElement, 'Please enter at least ' + input.minLength + ' characters.');
        return;
    }

    if (input.maxLength > 0 && input.maxLength != input.minLength && value.length >= input.maxLength - 20) {
        displayError(input, errorElement, (input.maxLength - value.length) + ' characters left');
        return;
    }

    if (input.type === 'email' && value !== '' && !validateEmail(value)) {
        displayError(input, errorElement, 'Please enter a valid email address.');
        return;
    }

    let shouldClear = await window.triggerHook('validate-field', input, value, errorElement, serverSide);
    shouldClear = shouldClear === undefined ? true : shouldClear;

    if (shouldClear != false) {
        clearError(input, errorElement);
    }
}

/**
 * Validates whether a given string is a valid email address.
 *
 * @param {string} email The email address to validate.
 * @return {boolean} Returns true if the email address is valid, false otherwise.
 */
export function validateEmail(email) {
    const re = /^(([^<>()\[\]\\.,;:\s@"']+(\.[^<>()\[\]\\.,;:\s@"']+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}