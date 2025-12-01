import handleRequest from './_handler.js';

export default function onRequest(context) {
    const request = context.request;
    return handleRequest(request);
}
