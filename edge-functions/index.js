// ======================== Configuration ========================
const CONFIG = {
    // Auth Worker Base URL (Production)
    AUTH_WORKER_URL: "https://auth.lodgegeek.com",
    // Cookie Name (Must match Auth Worker's cookie)
    COOKIE_NAME: "auth_token",
    // Allowed Email Domain
    ALLOWED_DOMAIN: "lodgegeek.com"
};

// ======================== EdgeOne Pages Function Entry ========================
export default function onRequest(context) {
    const request = context.request;
    return handleRequest(request);
}

// ======================== Core Logic ========================
async function handleRequest(request) {
    const url = new URL(request.url);
    console.log(`[Debug] Request: ${request.method} ${url.pathname}`);

    // 1. Ignore static resources
    const ignorePaths = ["/favicon.ico", "/robots.txt", "/assets/", "/resources/", "/icons/", "/manifest.json"];
    if (ignorePaths.some(path => url.pathname.startsWith(path))) {
        return fetch(request);
    }

    // 2. Handle Logout (Redirect to Auth Worker)
    if (url.pathname === "/logout" || url.pathname === "/logout/") {
        return handleLogout(url);
    }

    // 2.5 Handle Verify Proxy (Bypass CORS)
    if (url.pathname === "/api/auth/verify") {
        return handleVerifyProxy(request);
    }

    // 3. Check Authentication (Cookie)
    const isLoggedIn = checkLoginCookie(request);
    console.log(`[Debug] Login status: ${isLoggedIn}`);

    if (isLoggedIn) {
        // 4. Authenticated: Proceed to origin
        const response = await fetch(request);

        // Reconstruct headers
        const newHeaders = new Headers(response.headers);
        newHeaders.delete("Content-Encoding");
        newHeaders.delete("Content-Length");
        newHeaders.set("X-Auth-Status", "logged_in");

        // Prevent caching of authenticated pages
        newHeaders.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        newHeaders.set("Pragma", "no-cache");
        newHeaders.set("Expires", "0");

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders
        });
    }

    // 5. Not Authenticated: Redirect to Auth Worker Login
    return redirectToLogin(url);
}

// ======================== Helper Functions ========================

/**
 * Check if the auth cookie exists
 * Note: We only check for existence here. Real validation happens via /verify in the frontend
 * or could be done here if we could verify the JWT signature (requires secret).
 * For now, we rely on the cookie presence and the frontend /verify call for user info.
 */
function checkLoginCookie(request) {
    const cookieHeader = request.headers.get("Cookie") || "";
    if (!cookieHeader) return false;

    const cookieParts = cookieHeader.split("; ").reduce((acc, part) => {
        const [key, value] = part.split("=");
        if (key && value) acc[key.trim()] = value.trim();
        return acc;
    }, {});

    return !!cookieParts[CONFIG.COOKIE_NAME];
}

/**
 * Redirect to Auth Worker Login
 */
function redirectToLogin(currentUrl) {
    const loginUrl = new URL(`${CONFIG.AUTH_WORKER_URL}/login`);
    // Pass the current URL as the redirect_to target
    loginUrl.searchParams.set("redirect_to", currentUrl.toString());

    return new Response(null, {
        status: 302,
        headers: {
            "Location": loginUrl.toString(),
            "Cache-Control": "no-cache"
        }
    });
}
