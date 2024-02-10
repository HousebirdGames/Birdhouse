import { urlPrefix } from "../main.js";
import { hooks, hook, triggerHook } from "./hooks.js";

export function initializeInputValidation() {
    document.body.addEventListener('input', function (event) {
        validateInputs(event)
    });
    document.body.addEventListener('focusin', function (event) {
        validateInputs(event)
    });
}

const debouncedValidateInputClient = debounce(validateInputClient, 100);
const debouncedValidateInputServer = debounce(validateInputServer, 2000);
function validateInputs(event) {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
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

        if (input.classList.contains('noValidation') || input.type === 'checkbox' || input.type === 'radio' || input.type === 'submit' || input.type === 'button') {
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
            input.parentNode.insertBefore(errorElement, input.nextSibling);
        }
    }

    return errorElement;
}

async function validateInputClient(event) {
    validateInput(event, false);
}

async function validateInputServer(event) {
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

export function displayError(input, errorElement, message = '') {
    if (input && errorElement) {
        input.classList.add('invalid');
        errorElement.textContent = message;
        errorElement.style.maxHeight = `${errorElement.scrollHeight}px`;
    }
}

export function clearError(input, errorElement) {
    input.classList.remove('invalid');
    errorElement = addMissingErrorMessage(input);
    errorElement.style.maxHeight = '0';
}

async function validateField(input, errorElement, serverSide = true) {
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

    const shouldClear = await triggerHook('validate-field', input, value, errorElement, serverSide);

    if (shouldClear != false) {
        clearError(input, errorElement);
    }
}

function validateEmail(email) {
    const re = /^(([^<>()\[\]\\.,;:\s@"']+(\.[^<>()\[\]\\.,;:\s@"']+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}