export default async function Analytics(value) {
    window.triggerHook('send-analytics', value);
}