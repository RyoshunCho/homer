// ======================== 配置项（需替换为实际信息）========================
const CONFIG = {
    // Lark 应用凭证（开发者后台获取）
    LARK_APP_ID: "cli_a9aaef5d2df8de1c",
    LARK_APP_SECRET: "FaNO3rtD3WIHR0zMkhtingZ6pGtwfUWK",
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
        return new Response("Lark认证失败：缺少授权码（code）", { status: 400 });
    }

    try {
        // 换取access_token
        const accessTokenData = await getLarkAccessToken(code);
        if (!accessTokenData.access_token) {
            return new Response(`Lark认证失败：${accessTokenData.msg || "获取AccessToken失败"}`, { status: 401 });
        }

        // 获取用户信息
        const userInfo = await getLarkUserInfo(accessTokenData.access_token);
        if (!userInfo || !userInfo.email) {
            return new Response("Lark认证失败：无法获取用户信息", { status: 401 });
        }

        // 验证公司邮箱域名
        const emailDomain = userInfo.email.split("@")[1];
        if (emailDomain !== CONFIG.COMPANY_EMAIL_DOMAIN) {
            return new Response(
                `未授权访问：仅允许${CONFIG.COMPANY_EMAIL_DOMAIN}域名的账号访问`,
                { status: 403 }
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
        return new Response(`服务器内部错误：${error.message}`, { status: 500 });
    }
}

/**
 * 调用Lark API换取access_token
 */
async function getLarkAccessToken(code) {
    const requestBody = JSON.stringify({
        app_id: CONFIG.LARK_APP_ID,
        app_secret: CONFIG.LARK_APP_SECRET,
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
        "https://passport.larksuite.com/suite/passport/oauth/userinfo",
        {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Accept": "application/json"
            }
        }
    );

    const data = await response.json();
    if (!data.email) {
        throw new Error("无法获取用户邮箱信息，认证失败");
    }
    return data;
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
