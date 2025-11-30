// ======================== 配置項（需替換為實際信息）========================
const CONFIG = {
    // Lark 應用憑證（開發者後台獲取）
    LARK_APP_ID: "cli_a9a1d7e481389e1b",
    LARK_APP_SECRET: "JIpx57OYudZrj4FwSyO9gb4tGBaMwNfC",
    // 回調URL（需和Lark應用後台配置的完全一致）
    LARK_REDIRECT_URI: "https://nav.lodgegeek.com/auth/callback",
    // 公司郵箱域名（例如 lodgegeek.com）
    COMPANY_EMAIL_DOMAIN: "lodgegeek.com",
    // 登錄Cookie配置
    COOKIE_CONFIG: {
        name: "lark_internal_auth",
        maxAge: 2592000, // 30天（1個月）有效期（60秒*60分*24小時*30天）
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax"
    }
};

// ======================== EdgeOne Pages 函數入口（固定格式）========================
export default function onRequest(context) {
    const request = context.request;
    return handleRequest(request);
}

// ======================== 核心處理邏輯 ========================
async function handleRequest(request) {
    const url = new URL(request.url);
    console.log(`[Debug] Request: ${request.method} ${url.pathname}`);

    // Debug header to verify function execution
    const debugHeaders = { "X-Edge-Function-Ver": "logout-fix-v1" };

    // 1. 忽略特定靜態資源，避免認證循環
    const ignorePaths = ["/favicon.ico", "/robots.txt", "/assets/", "/resources/", "/icons/", "/manifest.json"];
    if (ignorePaths.some(path => url.pathname.startsWith(path))) {
        console.log(`[Debug] Ignoring path: ${url.pathname}`);
        return fetch(request); // 直接返回靜態資源
    }

    // 2. 処理ログアウトリクエスト (最優先)
    if (url.pathname === "/logout" || url.pathname === "/logout/") {
        console.log(`[Debug] Handling logout`);
        return handleLogout();
    }

    // 3. 檢查是否已登錄（驗證Cookie）
    const isLoggedIn = checkLoginCookie(request);
    console.log(`[Debug] Login status: ${isLoggedIn}`);

    if (isLoggedIn) {
        const response = await fetch(request);

        // Debug: Log upstream headers
        console.log(`[Debug] Upstream Status: ${response.status}`);
        console.log("[Debug] Upstream Headers:");
        response.headers.forEach((value, key) => {
            console.log(`  ${key}: ${value}`);
        });

        // Reconstruct headers to safely strip encoding/length
        const newHeaders = new Headers(response.headers);
        newHeaders.delete("Content-Encoding");
        newHeaders.delete("Content-Length");
        newHeaders.delete("Content-Length");
        newHeaders.set("X-Debug-Auth", "logged_in");

        // Prevent caching of the authenticated page to avoid FOUC (Flash of Unauthenticated Content)
        newHeaders.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        newHeaders.set("Pragma", "no-cache");
        newHeaders.set("Expires", "0");

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders
        });
    }

    // 5. 處理Lark認證回調
    if (url.pathname === "/auth/callback") {
        console.log(`[Debug] Handling callback`);
        return handleLarkCallback(url);
    }

    // 6. 未登錄，跳轉到Lark授權頁面
    console.log(`[Debug] Redirecting to Lark`);
    return redirectToLarkAuth();
}

// ======================== 輔助函數 ========================
/**
 * 檢查登錄Cookie是否有效
 */
function checkLoginCookie(request) {
    const cookieHeader = request.headers.get("Cookie") || "";
    if (!cookieHeader) return false;

    const cookieParts = cookieHeader.split("; ").reduce((acc, part) => {
        const [key, value] = part.split("=");
        acc[key] = value;
        return acc;
    }, {});

    const authCookie = cookieParts[CONFIG.COOKIE_CONFIG.name];
    return !!authCookie && authCookie === "valid";
}

/**
 * 跳轉到Lark國際版授權頁面
 */
function redirectToLarkAuth() {
    const larkAuthUrl = new URL("https://open.larksuite.com/open-apis/authen/v1/index");
    larkAuthUrl.searchParams.set("app_id", CONFIG.LARK_APP_ID);
    larkAuthUrl.searchParams.set("redirect_uri", CONFIG.LARK_REDIRECT_URI);
    larkAuthUrl.searchParams.set("response_type", "code");

    return new Response(null, {
        status: 302,
        headers: {
            "Location": larkAuthUrl.toString(),
            "Cache-Control": "no-cache",
            "X-Debug-Auth": "redirecting",
            "X-Edge-Function-Ver": "logout-fix-v1"
        }
    });
}

/**
 * 處理Lark認證回調
 */
async function handleLarkCallback(url) {
    const code = url.searchParams.get("code");
    if (!code) {
        return createErrorResponse("Lark認證失敗", "缺少授權碼（code）");
    }

    try {
        // 換取access_token
        const accessTokenData = await getLarkAccessToken(code);
        const accessToken = accessTokenData.data?.access_token;
        if (!accessToken) {
            return createErrorResponse("Lark認證失敗", accessTokenData.msg || "獲取AccessToken失敗");
        }

        // 獲取用戶信息
        const userInfo = await getLarkUserInfo(accessToken);
        if (!userInfo || !userInfo.email) {
            return createErrorResponse("Lark認證失敗", "無法獲取用戶信息");
        }

        // 驗證公司郵箱域名（必須使用企業郵箱 enterprise_email）
        const enterpriseEmail = userInfo.enterprise_email;

        // 如果沒有企業郵箱，顯示詳細錯誤信息
        if (!enterpriseEmail) {
            return createErrorResponse(
                "無法獲取企業郵箱",
                `請確保：<br>1. Lark應用已開啟"獲取用戶受雇信息"權限<br>2. Lark管理後台已啟用郵箱服務<br>3. 用戶已設置企業郵箱<br><br>當前用戶信息：<br><pre>${JSON.stringify(userInfo, null, 2)}</pre>`
            );
        }

        const emailDomain = enterpriseEmail.split("@")[1];

        if (emailDomain !== CONFIG.COMPANY_EMAIL_DOMAIN) {
            return createErrorResponse(
                `未授權訪問：僅允許 ${CONFIG.COMPANY_EMAIL_DOMAIN}域名的賬號訪問`,
                `企業郵箱：${enterpriseEmail}<br>個人郵箱：${userInfo.email || '未設置'}`
            );
        }

        // 驗證通過，設置Cookie並跳回首頁
        const cookieStr = buildCookieString();
        return new Response(null, {
            status: 302,
            headers: {
                "Location": "/", // 跳回homer首頁
                "Set-Cookie": cookieStr,
                "Cache-Control": "no-cache"
            }
        });

    } catch (error) {
        console.error("Lark回調處理異常：", error);
        return createErrorResponse("服務器內部錯誤", error.message);
    }
}

function createErrorResponse(message, debugInfo = "") {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Login Error</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 2rem; text-align: center; background-color: #f5f5f7; color: #1d1d1f; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .error-title { color: #d93025; font-size: 1.5rem; margin-bottom: 1rem; }
            .message { margin-bottom: 1.5rem; line-height: 1.5; }
            .debug { background: #f5f5f5; padding: 1rem; border-radius: 8px; font-family: monospace; font-size: 0.85rem; text-align: left; overflow-x: auto; margin-bottom: 2rem; color: #333; }
            .btn { display: inline-block; padding: 0.8rem 1.5rem; background: #007aff; color: white; text-decoration: none; border-radius: 8px; font-weight: 500; transition: background 0.2s; }
            .btn:hover { background: #0062cc; }
        </style>
    </head>
    <body>
        <div class="container">
            <h2 class="error-title">Authentication Failed</h2>
            <p class="message">${message}</p>
            ${debugInfo ? `<div class="debug"><strong>Debug Info:</strong><br>${debugInfo}</div>` : ""}
            <a href="/" class="btn">Return to Home (Retry)</a>
        </div>
    </body>
    </html>
    `;
    return new Response(html, {
        status: 403,
        headers: { "Content-Type": "text/html; charset=utf-8" }
    });
}

/**
 * 調用Lark API換取access_token
 */
async function getLarkAccessToken(code) {
    const requestBody = JSON.stringify({
        app_id: CONFIG.LARK_APP_ID,
        app_secret: CONFIG.LARK_APP_SECRET,
        grant_type: "authorization_code",
        code: code
    });

    const response = await fetch(
        "https://open.larksuite.com/open-apis/authen/v1/access_token",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: requestBody
        }
    );

    const data = await response.json();
    if (data.code !== 0) {
        throw new Error(`Lark AccessToken API錯誤：${data.msg}（code: ${data.code}）`);
    }
    return data;
}

/**
 * 調用Lark API獲取用戶信息
 */
async function getLarkUserInfo(accessToken) {
    const response = await fetch(
        "https://open.larksuite.com/open-apis/authen/v1/user_info",
        {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Accept": "application/json"
            }
        }
    );

    const responseJson = await response.json();
    if (responseJson.code !== 0) {
        throw new Error(`Lark UserInfo API Error: ${responseJson.msg} (code: ${responseJson.code})`);
    }

    const userInfo = responseJson.data;
    if (!userInfo || !userInfo.email) {
        const debugInfo = JSON.stringify(responseJson);
        throw new Error(`無法獲取用戶郵箱信息，認證失敗。Lark響應: ${debugInfo}`);
    }
    return userInfo;
}

/**
 * 處理ログアウト
 */
function handleLogout() {
    // Cookie を削除（Max-Age=0 に設定）
    const cookieStr = buildLogoutCookieString();
    return new Response(null, {
        status: 302,
        headers: {
            "Location": "/", // ログイン画面にリダイレクト
            "Set-Cookie": cookieStr,
            "Cache-Control": "no-cache",
            "X-Edge-Function-Ver": "logout-fix-v1"
        }
    });
}

/**
 * 構建登錄Cookie字符串
 */
function buildCookieString() {
    const { name, maxAge, path, httpOnly, secure, sameSite } = CONFIG.COOKIE_CONFIG;
    let cookieStr = `${name}=valid; Max-Age=${maxAge}; Path=${path}`;
    if (httpOnly) cookieStr += "; HttpOnly";
    if (secure) cookieStr += "; Secure";
    if (sameSite) cookieStr += `; SameSite=${sameSite}`;
    return cookieStr;
}

/**
 * ログアウト用Cookieを構築（削除用）
 */
function buildLogoutCookieString() {
    const { name, path, httpOnly, secure, sameSite } = CONFIG.COOKIE_CONFIG;
    let cookieStr = `${name}=; Max-Age=0; Path=${path}`;
    if (httpOnly) cookieStr += "; HttpOnly";
    if (secure) cookieStr += "; Secure";
    if (sameSite) cookieStr += `; SameSite=${sameSite}`;
    return cookieStr;
}
