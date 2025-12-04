import handleRequest from './_handler.js';

export default function onRequest(context) {
    const request = context.request;
    const env = context.env || {};
    return handleRequest(request, env);
}
