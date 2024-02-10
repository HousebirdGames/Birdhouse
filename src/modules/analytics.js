import { hooks, hook, triggerHook } from './hooks.js';

export default function Analytics(value) {
    triggerHook('send-analytics', value);
}