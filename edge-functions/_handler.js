// ======================== Configuration ========================
const CONFIG = {
    // Auth Worker Base URL (Production)
    AUTH_WORKER_URL: "https://auth.lodgegeek.com",
    // Cookie Name (Must match Auth Worker's cookie)
    COOKIE_NAME: "auth_token",
    // Allowed Email Domain
    ALLOWED_DOMAIN: "lodgegeek.com",
    // External Config URL (R2)
    EXTERNAL_CONFIG_URL: "https://pub-40e4e971626a41c7848a9726fd3fad92.r2.dev/config.yml"
};

// ======================== Core Logic ========================
export default async function handleRequest(request) {
    const url = new URL(request.url);
    console.log(`[Debug] Request: ${request.method} ${url.pathname}`);

    // 1. Ignore static resources
    const ignorePaths = ["/favicon.ico", "/robots.txt", "/assets/", "/resources/", "/icons/", "/manifest.json"];
    if (ignorePaths.some(path => url.pathname.startsWith(path)) && !url.pathname.includes("config.yml")) {
        return fetch(request);
    }

    // 2. Handle Logout (Redirect to Auth Worker)
    if (url.pathname === "/logout" || url.pathname === "/logout/") {
        return handleLogout(url);
    }

    // 2.5 Handle Verify Proxy (Bypass CORS)
    if (url.pathname.startsWith("/api/auth/verify")) {
        return handleVerifyProxy(request);
    }

    // 3. Check Authentication (Cookie)
    const isLoggedIn = checkLoginCookie(request);
    console.log(`[Debug] Login status: ${isLoggedIn}`);

    if (isLoggedIn) {
        // 3.5 Intercept config.yml request
        if (url.pathname.endsWith("/assets/config.yml")) {
            return handleConfigProxy(request);
        }

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

/**
 * Handle Logout
 */
function handleLogout(currentUrl) {
    const logoutUrl = new URL(`${CONFIG.AUTH_WORKER_URL}/logout`);
    logoutUrl.searchParams.set("redirect_to", currentUrl.origin);

    return new Response(null, {
        status: 302,
        headers: {
            "Location": logoutUrl.toString(),
            "Cache-Control": "no-cache"
        }
    });
}

/**
 * Proxy /api/auth/verify to Auth Worker
 */
async function handleVerifyProxy(request) {
    const targetUrl = `${CONFIG.AUTH_WORKER_URL}/verify`;

    try {
        const response = await fetch(targetUrl, {
            method: "GET",
            headers: {
                "Cookie": request.headers.get("Cookie") || "",
                "Accept": "application/json"
            },
            redirect: "manual" // Prevent following redirects
        });

        // Handle Redirects (3xx) or Unauthorized (401)
        if (response.status >= 300 || response.status === 401) {
            console.log(`[Debug] Verify proxy got status: ${response.status}`);
            return new Response(JSON.stringify({ valid: false, error: `Upstream status: ${response.status}` }), {
                status: 200, // Return 200 so frontend can parse JSON
                headers: { "Content-Type": "application/json" }
            });
        }

        // Forward successful response
        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache"
            }
        });
    } catch (error) {
        console.error("Verify proxy failed:", error);
        return new Response(JSON.stringify({ valid: false, error: "Proxy Error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}

/**
 * Proxy config.yml from External URL
 */
async function handleConfigProxy(request) {
    try {
        const response = await fetch(CONFIG.EXTERNAL_CONFIG_URL);

        if (!response.ok) {
            console.error(`[Error] Failed to fetch external config: ${response.status}`);
            // Fallback to origin if external fails? Or return error?
            // For now, let's return error to make it obvious
            return new Response("Failed to load configuration", { status: 502 });
        }

        const newHeaders = new Headers(response.headers);
        // Ensure correct content type for YAML
        newHeaders.set("Content-Type", "text/yaml");
        // Add auth status header just in case
        newHeaders.set("X-Auth-Status", "logged_in");
        // Enable caching for 1 hour to reduce R2 requests
        newHeaders.set("Cache-Control", "public, max-age=3600");

        return new Response(response.body, {
            status: 200,
            headers: newHeaders
        });

    } catch (error) {
        console.error("[Error] Config proxy exception:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}
