// ======================== 配置项（需替换为实际信息）========================
const CONFIG = {
    // Lark 应用凭证（开发者后台获取）
    LARK_APP_ID: "cli_a9a1d7e481389e1b",
    LARK_APP_SECRET: "JIpx57OYudZrj4FwSyO9gb4tGBaMwNfC",
    // 回调URL（需和Lark应用后台配置的完全一致）
    LARK_REDIRECT_URI: "https://nav.lodgegeek.com/auth/callback",
    // 公司邮箱域名（例如 lodgegeek.com）
    COMPANY_EMAIL_DOMAIN: "lodgegeek.com",
    // 登录Cookie配置
    COOKIE_CONFIG: {
        name: "lark_internal_auth",
        maxAge: 2592000, // 30天（1个月）有效期（60秒*60分*24小时*30天）
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Strict"
    }
};

// ======================== EdgeOne Pages 函数入口（固定格式）========================
export default function onRequest(context) {
    const request = context.request;
    return handleRequest(request);
}

// ======================== 核心处理逻辑 ========================
async function handleRequest(request) {
    const url = new URL(request.url);
    console.log(`[Debug] Request: ${request.method} ${url.pathname}`);

    // 1. 忽略特定静态资源，避免认证循环
    const ignorePaths = ["/favicon.ico", "/robots.txt", "/assets/", "/resources/", "/icons/", "/manifest.json"];
    if (ignorePaths.some(path => url.pathname.startsWith(path))) {
        console.log(`[Debug] Ignoring path: ${url.pathname}`);
        return fetch(request); // 直接返回静态资源
    }

    // 2. 检查是否已登录（验证Cookie）
    const isLoggedIn = checkLoginCookie(request);
    console.log(`[Debug] Login status: ${isLoggedIn}`);

    if (isLoggedIn) {
        const response = await fetch(request);
        const newResponse = new Response(response.body, response);
        newResponse.headers.set("X-Debug-Auth", "logged_in");
        return newResponse;
    }

    // 3. 处理Lark认证回调
    if (url.pathname === "/auth/callback") {
        console.log(`[Debug] Handling callback`);
        return handleLarkCallback(url);
    }

    // 4. 未登录，跳转到Lark授权页面
    console.log(`[Debug] Redirecting to Lark`);
    return redirectToLarkAuth();
}

// ======================== 辅助函数 ========================
/**
 * 检查登录Cookie是否有效
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
 * 跳转到Lark国际版授权页面
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
            "X-Debug-Auth": "redirecting"
        }
    });
}

/**
 * 处理Lark认证回调
 */
async function handleLarkCallback(url) {
    const code = url.searchParams.get("code");
    if (!code) {
        return createErrorResponse("Lark认证失败", "缺少授权码（code）");
    }

    try {
        // 换取access_token
        const accessTokenData = await getLarkAccessToken(code);
        const accessToken = accessTokenData.data?.access_token;
        if (!accessToken) {
            return createErrorResponse("Lark认证失败", accessTokenData.msg || "获取AccessToken失败");
        }

        // 获取用户信息
        const userInfo = await getLarkUserInfo(accessToken);
        if (!userInfo || !userInfo.email) {
            return createErrorResponse("Lark认证失败", "无法获取用户信息");
        }

        // 验证公司邮箱域名（必须使用企业邮箱 enterprise_email）
        const enterpriseEmail = userInfo.enterprise_email;

        // 如果没有企业邮箱，显示详细错误信息
        if (!enterpriseEmail) {
            return createErrorResponse(
                "无法获取企业邮箱",
                `请确保：<br>1. Lark应用已开启"获取用户受雇信息"权限<br>2. Lark管理后台已启用邮箱服务<br>3. 用户已设置企业邮箱<br><br>当前用户信息：<br><pre>${JSON.stringify(userInfo, null, 2)}</pre>`
            );
        }

        const emailDomain = enterpriseEmail.split("@")[1];

        if (emailDomain !== CONFIG.COMPANY_EMAIL_DOMAIN) {
            return createErrorResponse(
                `未授权访问：仅允许 ${CONFIG.COMPANY_EMAIL_DOMAIN}域名的账号访问`,
                `企业邮箱：${enterpriseEmail}<br>个人邮箱：${userInfo.email || '未设置'}`
            );
        }

        // 验证通过，设置Cookie并跳回首页
        const cookieStr = buildCookieString();
        return new Response(null, {
            status: 302,
            headers: {
                "Location": "/", // 跳回homer首页
                "Set-Cookie": cookieStr,
                "Cache-Control": "no-cache"
            }
        });

    } catch (error) {
        console.error("Lark回调处理异常：", error);
        return createErrorResponse("服务器内部错误", error.message);
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
 * 调用Lark API换取access_token
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
        throw new Error(`Lark AccessToken API错误：${data.msg}（code: ${data.code}）`);
    }
    return data;
}

/**
 * 调用Lark API获取用户信息
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
        throw new Error(`无法获取用户邮箱信息，认证失败。Lark响应: ${debugInfo}`);
    }
    return userInfo;
}

/**
 * 构建登录Cookie字符串
 */
function buildCookieString() {
    const { name, maxAge, path, httpOnly, secure, sameSite } = CONFIG.COOKIE_CONFIG;
    let cookieStr = `${name}=valid; Max-Age=${maxAge}; Path=${path}`;
    if (httpOnly) cookieStr += "; HttpOnly";
    if (secure) cookieStr += "; Secure";
    if (sameSite) cookieStr += `; SameSite=${sameSite}`;
    return cookieStr;
}
