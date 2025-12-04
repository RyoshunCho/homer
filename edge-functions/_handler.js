// ======================== Configuration ========================
// Environment variables are expected from EdgeOne Dashboard:
// - R2_PUBLIC_URL: Public R2 URL for reading config
// - R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_NAME: For R2 write operations
// - ADMIN_EMAILS: Comma-separated list of admin email addresses

const CONFIG = {
    // Auth Worker Base URL (Production)
    AUTH_WORKER_URL: "https://auth.lodgegeek.com",
    // Cookie Name (Must match Auth Worker's cookie)
    COOKIE_NAME: "auth_token",
    // Allowed Email Domain
    ALLOWED_DOMAIN: "lodgegeek.com",
};

// ======================== R2 Helper Functions (Inlined) ========================

/**
 * Check if a user is an admin based on their email
 */
function isAdminUser(env, userEmail) {
    if (!env.ADMIN_EMAILS || !userEmail) {
        return false;
    }
    const adminEmails = env.ADMIN_EMAILS.split(',').map(e => e.trim().toLowerCase());
    return adminEmails.includes(userEmail.toLowerCase());
}

/**
 * Get config.yml content from R2 (via public URL for reading)
 */
async function r2GetConfig(env) {
    const url = `${env.R2_PUBLIC_URL}/config.yml`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.status}`);
    }

    return await response.text();
}

/**
 * Create HMAC-SHA256 signature for AWS S3 compatible API
 */
async function hmacSha256(key, message) {
    const encoder = new TextEncoder();
    const keyData = typeof key === 'string' ? encoder.encode(key) : key;
    const messageData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    return new Uint8Array(signature);
}

/**
 * Create SHA256 hash
 */
async function sha256(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert Uint8Array to hex string
 */
function toHex(buffer) {
    return Array.from(buffer).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get AWS Signature V4 signing key
 */
async function getSigningKey(secretKey, dateStamp, region, service) {
    const encoder = new TextEncoder();
    const kDate = await hmacSha256(encoder.encode('AWS4' + secretKey), dateStamp);
    const kRegion = await hmacSha256(kDate, region);
    const kService = await hmacSha256(kRegion, service);
    const kSigning = await hmacSha256(kService, 'aws4_request');
    return kSigning;
}

/**
 * Make a signed request to R2
 */
async function r2SignedRequest(env, method, key, body = null) {
    const endpoint = new URL(env.R2_ENDPOINT);
    const host = endpoint.host;
    const url = `${env.R2_ENDPOINT}/${env.R2_BUCKET_NAME}/${key}`;

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);

    const region = 'auto';
    const service = 's3';

    const payloadHash = body ? await sha256(body) : await sha256('');

    const canonicalUri = `/${env.R2_BUCKET_NAME}/${key}`;
    const canonicalQueryString = '';
    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

    const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${await sha256(canonicalRequest)}`;

    const signingKey = await getSigningKey(env.R2_SECRET_ACCESS_KEY, dateStamp, region, service);
    const signature = toHex(await hmacSha256(signingKey, stringToSign));

    const authorizationHeader = `${algorithm} Credential=${env.R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const headers = {
        'Host': host,
        'x-amz-date': amzDate,
        'x-amz-content-sha256': payloadHash,
        'Authorization': authorizationHeader,
    };

    if (body) {
        headers['Content-Type'] = 'text/yaml';
    }

    return fetch(url, {
        method,
        headers,
        body: body || undefined,
    });
}

/**
 * Save config.yml to R2 with automatic backup
 */
async function r2SaveConfig(env, content) {
    // 1. Create backup first
    try {
        const currentConfig = await r2GetConfig(env);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupKey = `config.backup.${timestamp}.yml`;
        await r2SignedRequest(env, 'PUT', backupKey, currentConfig);
        console.log(`Backup created: ${backupKey}`);
    } catch (error) {
        console.error('Backup creation failed:', error);
        // Continue even if backup fails
    }

    // 2. Save new config
    const response = await r2SignedRequest(env, 'PUT', 'config.yml', content);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save config: ${response.status} - ${errorText}`);
    }

    return { success: true };
}

// ======================== Core Logic ========================
export default async function handleRequest(request, env = {}) {
    const url = new URL(request.url);
    console.log(`[Debug] Request: ${request.method} ${url.pathname}`);

    // 1. Ignore static resources
    const ignorePaths = ["/favicon.ico", "/robots.txt", "/assets/", "/resources/", "/icons/", "/manifest.json"];
    if (ignorePaths.some(path => url.pathname.startsWith(path)) && !url.pathname.includes("config.yml")) {
        return fetch(request);
    }

    // 1.5 Handle CORS preflight for API endpoints
    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
        console.log(`[Debug] CORS preflight for: ${url.pathname}`);
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": url.origin,
                "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Max-Age": "86400",
            }
        });
    }

    // 2. Handle Logout (Redirect to Auth Worker)
    if (url.pathname === "/logout" || url.pathname === "/logout/") {
        return handleLogout(url);
    }

    // 2.5 Handle Verify Proxy (Bypass CORS)
    if (url.pathname.startsWith("/api/auth/verify")) {
        return handleVerifyProxy(request);
    }

    // 2.6 Handle Admin Check API
    if (url.pathname === "/api/admin/check") {
        return handleAdminCheck(request, env);
    }

    // 2.7 Handle Config API (GET/PUT)
    if (url.pathname === "/api/config") {
        console.log(`[Debug] Matched /api/config`);
        return handleConfigApi(request, env);
    }

    // 2.8 Handle Service Memo API (PATCH)
    if (url.pathname === "/api/config/memo") {
        console.log(`[Debug] Matched /api/config/memo`);
        return handleServiceMemoApi(request, env);
    }

    // 2.9 Handle Global Memo API (PATCH)
    if (url.pathname === "/api/config/global-memo") {
        console.log(`[Debug] Matched /api/config/global-memo`);
        return handleGlobalMemoApi(request, env);
    }

    console.log(`[Debug] No API match for: ${url.pathname}`);

    // 3. Check Authentication (Cookie)
    const isLoggedIn = checkLoginCookie(request);
    console.log(`[Debug] Login status: ${isLoggedIn}`);

    if (isLoggedIn) {
        // 3.5 Intercept config.yml request
        if (url.pathname.endsWith("/assets/config.yml")) {
            return handleConfigProxy(request, env);
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
 * Proxy config.yml from External URL (R2 Public URL)
 */
async function handleConfigProxy(request, env) {
    try {
        // Use R2_PUBLIC_URL from environment or fallback
        const configUrl = env.R2_PUBLIC_URL
            ? `${env.R2_PUBLIC_URL}/config.yml`
            : "https://pub-40e4e971626a41c7848a9726fd3fad92.r2.dev/config.yml";

        const response = await fetch(configUrl);

        if (!response.ok) {
            console.error(`[Error] Failed to fetch external config: ${response.status}`);
            return new Response("Failed to load configuration", { status: 502 });
        }

        const newHeaders = new Headers(response.headers);
        newHeaders.set("Content-Type", "text/yaml");
        newHeaders.set("X-Auth-Status", "logged_in");
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

// ======================== Admin API Functions ========================

/**
 * Get user info from auth worker
 */
async function getUserInfo(request) {
    try {
        const response = await fetch(`${CONFIG.AUTH_WORKER_URL}/verify`, {
            method: "GET",
            headers: {
                "Cookie": request.headers.get("Cookie") || "",
                "Accept": "application/json"
            },
            redirect: "manual"
        });

        if (!response.ok || response.status >= 300) {
            return null;
        }

        const data = await response.json();
        if (data.valid && data.payload) {
            return data.payload;
        }
        return null;
    } catch (error) {
        console.error("Failed to get user info:", error);
        return null;
    }
}

/**
 * Handle Admin Check API - checks if current user is admin
 */
async function handleAdminCheck(request, env) {
    try {
        const user = await getUserInfo(request);

        if (!user) {
            return new Response(JSON.stringify({ isAdmin: false, error: "Not authenticated" }), {
                status: 401,
                headers: { "Content-Type": "application/json" }
            });
        }

        const userEmail = user.enterprise_email || user.email;
        const isAdmin = isAdminUser(env, userEmail);

        return new Response(JSON.stringify({
            isAdmin,
            email: userEmail
        }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    } catch (error) {
        console.error("Admin check failed:", error);
        return new Response(JSON.stringify({ isAdmin: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}

/**
 * Handle Config API - GET to read, PUT to save
 */
async function handleConfigApi(request, env) {
    // Check authentication first
    const user = await getUserInfo(request);
    if (!user) {
        return new Response(JSON.stringify({ error: "Not authenticated" }), {
            status: 401,
            headers: { "Content-Type": "application/json" }
        });
    }

    const userEmail = user.enterprise_email || user.email;

    // For PUT, check admin permission
    if (request.method === "PUT") {
        if (!isAdminUser(env, userEmail)) {
            return new Response(JSON.stringify({ error: "Admin access required" }), {
                status: 403,
                headers: { "Content-Type": "application/json" }
            });
        }

        try {
            const body = await request.json();
            const content = body.content;

            if (!content) {
                return new Response(JSON.stringify({ error: "Content is required" }), {
                    status: 400,
                    headers: { "Content-Type": "application/json" }
                });
            }

            await r2SaveConfig(env, content);

            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        } catch (error) {
            console.error("Config save failed:", error);
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { "Content-Type": "application/json" }
            });
        }
    }

    // GET - read config
    if (request.method === "GET") {
        try {
            const content = await r2GetConfig(env);
            return new Response(JSON.stringify({ content }), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        } catch (error) {
            console.error("Config read failed:", error);
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { "Content-Type": "application/json" }
            });
        }
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
    });
}

/**
 * Handle Service Memo API - PATCH to update a specific service's memo
 * Requires login (any user can edit)
 */
async function handleServiceMemoApi(request, env) {
    if (request.method !== "PATCH") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: { "Content-Type": "application/json" }
        });
    }

    // Check authentication
    const user = await getUserInfo(request);
    if (!user) {
        return new Response(JSON.stringify({ error: "Not authenticated" }), {
            status: 401,
            headers: { "Content-Type": "application/json" }
        });
    }

    try {
        const body = await request.json();
        const { serviceId, memo } = body;

        if (!serviceId) {
            return new Response(JSON.stringify({ error: "serviceId is required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        console.log(`[handleServiceMemoApi] Looking for serviceId: ${serviceId}`);

        // Get current config
        const configContent = await r2GetConfig(env);
        console.log(`[handleServiceMemoApi] Config loaded, length: ${configContent?.length || 0}`);

        // Log first 500 chars to see if id is present
        console.log(`[handleServiceMemoApi] Config start: ${configContent?.substring(0, 500)}`);

        // Update memo for the service with matching id
        const updatedContent = updateServiceMemo(configContent, serviceId, memo || "");

        if (!updatedContent) {
            console.log(`[handleServiceMemoApi] Service not found: ${serviceId}`);
            return new Response(JSON.stringify({ error: "Service not found" }), {
                status: 404,
                headers: { "Content-Type": "application/json" }
            });
        }

        // Save updated config
        await r2SaveConfig(env, updatedContent);

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    } catch (error) {
        console.error("Service memo update failed:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}

/**
 * Handle Global Memo API - PATCH to update globalMemo section
 * Requires login (any user can edit)
 */
async function handleGlobalMemoApi(request, env) {
    if (request.method !== "PATCH") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: { "Content-Type": "application/json" }
        });
    }

    // Check authentication
    const user = await getUserInfo(request);
    if (!user) {
        return new Response(JSON.stringify({ error: "Not authenticated" }), {
            status: 401,
            headers: { "Content-Type": "application/json" }
        });
    }

    const userEmail = user.enterprise_email || user.email;

    try {
        const body = await request.json();
        const { content } = body;

        if (content === undefined) {
            return new Response(JSON.stringify({ error: "content is required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        // Get current config
        const configContent = await r2GetConfig(env);

        // Update globalMemo section
        const now = new Date().toISOString();
        const updatedContent = updateGlobalMemo(configContent, content, now, userEmail);

        // Save updated config
        await r2SaveConfig(env, updatedContent);

        return new Response(JSON.stringify({ success: true, updatedAt: now, updatedBy: userEmail }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    } catch (error) {
        console.error("Global memo update failed:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}

/**
 * Update memo for a specific service by ID in YAML content
 */
function updateServiceMemo(yamlContent, serviceId, newMemo) {
    // Normalize line endings
    const normalizedContent = yamlContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedContent.split('\n');
    let foundService = false;
    let serviceIndent = -1;
    let memoLineIndex = -1;
    let insertAfterLine = -1;

    console.log(`[updateServiceMemo] Searching for service ID: ${serviceId}`);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for id match - handle various quote styles
        const idMatch = line.match(/^(\s*)id:\s*["']?([^"'\s]+)["']?\s*$/);
        if (idMatch) {
            console.log(`[updateServiceMemo] Found id at line ${i}: "${idMatch[2]}"`);
            if (idMatch[2] === serviceId) {
                foundService = true;
                serviceIndent = idMatch[1].length;
                insertAfterLine = i;
                console.log(`[updateServiceMemo] Matched! Indent: ${serviceIndent}`);
                continue;
            }
        }

        if (foundService) {
            // Check if we've moved to next service or section
            const indentMatch = line.match(/^(\s*)/);
            const currentIndent = indentMatch ? indentMatch[1].length : 0;
            const trimmed = line.trim();

            // If we hit a new list item at same or lower indent, stop
            if (trimmed.startsWith('- ') && currentIndent <= serviceIndent) {
                console.log(`[updateServiceMemo] Found next item at line ${i}, stopping`);
                break;
            }

            // Check for memo line within this service
            const memoMatch = line.match(/^(\s*)memo:/);
            if (memoMatch && memoMatch[1].length > serviceIndent) {
                memoLineIndex = i;
                console.log(`[updateServiceMemo] Found existing memo at line ${i}`);
            }

            // Track last property line for insertion (must be indented more than service start)
            if (trimmed && !trimmed.startsWith('#') && currentIndent > serviceIndent && line.includes(':')) {
                insertAfterLine = i;
            }
        }
    }

    if (!foundService) {
        console.log(`[updateServiceMemo] Service not found: ${serviceId}`);
        return null;
    }

    const indent = ' '.repeat(serviceIndent + 2);
    const escapedMemo = newMemo.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const newMemoLine = `${indent}memo: "${escapedMemo}"`;

    console.log(`[updateServiceMemo] Adding memo at indent ${serviceIndent + 2}, line ${insertAfterLine + 1}`);

    if (memoLineIndex >= 0) {
        // Replace existing memo line
        lines[memoLineIndex] = newMemoLine;
    } else {
        // Insert new memo line after last property
        lines.splice(insertAfterLine + 1, 0, newMemoLine);
    }

    return lines.join('\n');
}

/**
 * Update globalMemo section in YAML content
 */
function updateGlobalMemo(yamlContent, content, updatedAt, updatedBy) {
    const lines = yamlContent.split('\n');
    let inGlobalMemo = false;
    let globalMemoStart = -1;
    let globalMemoEnd = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.match(/^globalMemo:/)) {
            inGlobalMemo = true;
            globalMemoStart = i;
            continue;
        }

        if (inGlobalMemo) {
            // Check if we've moved to next top-level section
            if (line.match(/^[a-zA-Z]/) && !line.startsWith(' ')) {
                globalMemoEnd = i;
                break;
            }
        }
    }

    if (globalMemoStart === -1) {
        // globalMemo section not found, add it
        const insertIndex = lines.findIndex(l => l.match(/^links:/));
        if (insertIndex > 0) {
            const newSection = [
                '',
                '# Global Memo (告知カード)',
                'globalMemo:',
                `  content: "${content.replace(/"/g, '\\"')}"`,
                `  updatedAt: "${updatedAt}"`,
                `  updatedBy: "${updatedBy}"`,
                ''
            ];
            lines.splice(insertIndex, 0, ...newSection);
        }
    } else {
        // Replace globalMemo section
        const endIndex = globalMemoEnd === -1 ? globalMemoStart + 4 : globalMemoEnd;
        const newSection = [
            'globalMemo:',
            `  content: "${content.replace(/"/g, '\\"')}"`,
            `  updatedAt: "${updatedAt}"`,
            `  updatedBy: "${updatedBy}"`
        ];
        lines.splice(globalMemoStart, endIndex - globalMemoStart, ...newSection);
    }

    return lines.join('\n');
}
