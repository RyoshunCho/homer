## 背景说明

我是一家日本小公司 (https://lodgegeek.com) 的老板，我有几个员工是从中国大陆远程办公的。

我已在腾讯云 EdgeOne Pages 上部署了基于 GitHub 仓库（https://github.com/RyoshunCho/homer）的静态内部门户网站，域名是 [https://nav.lodgegeek.com](https://nav.lodgegeek.com/)。

该网站是公司内部使用的 portal 站点，我不希望全网公开访问，想通过 Lark 国际版（非中国大陆飞书）的认证功能实现访问鉴权，仅允许我公司的员工（匹配指定邮箱域名）访问。

## 核心需求

1. 实现网站访问鉴权：未登录用户访问 [https://nav.lodgegeek.com](https://nav.lodgegeek.com/) 时，自动跳转到 Lark 国际版登录页面；
2. 员工身份验证：仅允许邮箱域名匹配公司域名的 Lark 账号登录后访问网站；
3. 安全机制：通过 HttpOnly/Secure/SameSite 等属性配置登录 Cookie，避免安全风险；
4. 兼容 EdgeOne Pages 部署规则：函数需适配 EdgeOne Pages 的目录结构和运行格式，路由规则需让所有请求先经过认证逻辑。

## 技术实现要求（基于 EdgeOne Pages）

### 1. 仓库目录结构要求

需严格遵循 EdgeOne Pages 边缘函数的目录规范，最终目录结构如下：

```plaintext
homer/
├── edge-functions/       # EdgeOne Pages 专属边缘函数目录（命名不可修改）
│   └── api/              # API 路由目录（命名不可修改）
│       └── auth.js       # 核心Lark认证函数
├── _routes.json          # EdgeOne Pages 路由规则配置
└── ...（其他homer原有文件） # homer原有静态资源（无需修改）
```

### 2. 核心文件实现

#### （1）edge-functions/api/auth.js（Lark 认证核心函数）

需适配 EdgeOne Pages 的函数导出格式（export default onRequest），包含以下核心逻辑：

- 忽略特定静态资源（如 favicon.ico、assets/ 目录）避免认证循环；
- 检查登录 Cookie 有效性，已登录则直接返回静态资源；
- 未登录则跳转到 Lark 国际版授权页面；
- 处理 Lark 回调的 code 参数，调用 Lark API 换取 access_token 和用户信息；
- 验证用户邮箱域名是否匹配公司域名，验证通过则设置登录 Cookie 并跳回首页；
- 完善的错误处理（缺少 code、API 调用失败、非公司用户等场景）；
- 安全的 Cookie 配置（HttpOnly/Secure/SameSite/Max-Age）。

完整代码（javascript）如下：

```javascript
// ======================== 配置项（需替换为实际信息）========================
const CONFIG = {
  // Lark 应用凭证（开发者后台获取）
  LARK_APP_ID: "替换为Lark App ID",
  LARK_APP_SECRET: "替换为Lark App Secret",
  // 回调URL（需和Lark应用后台配置的完全一致）
  LARK_REDIRECT_URI: "https://nav.lodgegeek.com/api/auth.js",
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
  
  // 1. 忽略特定静态资源，避免认证循环
  const ignorePaths = ["/favicon.ico", "/robots.txt", "/assets/"];
  if (ignorePaths.some(path => url.pathname.startsWith(path))) {
    return fetch(request); // 直接返回静态资源
  }

  // 2. 检查是否已登录（验证Cookie）
  const isLoggedIn = checkLoginCookie(request);
  if (isLoggedIn) {
    return fetch(request); // 已登录，返回静态页面
  }

  // 3. 处理Lark认证回调
  if (url.pathname === "/api/auth.js") {
    return handleLarkCallback(url);
  }

  // 4. 未登录，跳转到Lark授权页面
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
  larkAuthUrl.searchParams.set("redirect_uri", encodeURIComponent(CONFIG.LARK_REDIRECT_URI));
  larkAuthUrl.searchParams.set("response_type", "code");

  return new Response(null, {
    status: 302,
    headers: {
      "Location": larkAuthUrl.toString(),
      "Cache-Control": "no-cache"
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
```

#### （2）_routes.json（路由规则配置）

放在仓库根目录，让所有请求先经过认证函数，认证通过后继续访问原静态资源：

```json
{
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/api/auth.js",
      "continue": true
    }
  ]
}
```

### 3. 额外配置要求

1. Lark 应用配置：
   - 登录 Lark 国际版开发者后台（[open.larksuite.com](https://open.larksuite.com/)）→ 目标应用 → 安全设置 → 新增重定向 URL：https://nav.lodgegeek.com/api/auth.js；
   - 无需额外申请权限，基础认证权限默认开放。
2. 部署流程：
   - 将上述文件提交到 GitHub 仓库 main 分支；
   - 进入 EdgeOne Pages 控制台 → 对应 homer 项目 → 点击「重新部署」；
   - 等待部署完成（1-2 分钟）后测试访问。
3. 日本环境适配：
   - 无需修改 API 地址（Lark 国际版 API 在日本可正常访问）；
   - 保留 Cookie 的 Secure 属性（EdgeOne Pages 强制 HTTPS）。

### 4. 测试验证流程

1. 访问 [https://nav.lodgegeek.com](https://nav.lodgegeek.com/) → 自动跳转 Lark 登录页；
2. 公司 Lark 账号（匹配邮箱域名）登录 → 跳回网站首页并正常访问；
3. 非公司账号登录 → 显示 403 未授权；
4. 已登录状态下关闭浏览器重新打开 → Cookie 有效期内无需重新登录。

## 最终交付要求

请基于以上信息，确保代码可直接运行（仅需替换配置项），适配 EdgeOne Pages 运行环境，兼容 Lark 国际版认证流程，满足日本地区的访问和安全要求。



## 其他参考资料

### Edgeone Pages Functions概览

Pages Functions 是一种 Serverless 架构解决方案，允许您运行服务端代码，而无需配置或管理服务器。它能根据网站访问流量自动扩缩容，并通过 EdgeOne 全球边缘节点提供更强的并发能力。您可使用 Functions 部署 API，并支持连接多种数据库，帮助您更好的实现前后端一体化项目与部署。

﻿

部署时，Pages 会自动识别项目框架并优化配置，基于 EdgeOne 边缘网络实现智能路由与低延迟访问。当前提供了两种类型 Functions：

Node Functions 提供完整的 Node.js 兼容性，支持原生模块与长计算时间，适合深度依赖 Node.js 生态业务场景。

Edge Functions 依托全球边缘节点，提供超低延迟与毫秒级冷启动，适合高并发、延迟敏感业务。

**注意：**

若您需要使用 Next.js 特定语法或框架上下文的 API，建议在 Next.js 的内置 API 路由目录进行开发，Pages 会自动处理部署。

#### 快速开始

在项目的 ./node-functions/api 目录下，使用以下示例代码来创建您的第一个 Node Functions：

```javascript
export default function onRequest(context) {
  return new Response('Hello from Node Functions!');
}
```

或通过模板来部署应用 Edge Functions 的项目。

﻿

在项目的 ./edge-functions/api 目录下，使用以下示例代码来创建您的第一个 Edge Functions：

```javascript
export default function onRequest(context) {
  return new Response('Hello from Edge Functions!');
}
```

或通过模板来部署应用 Edge Functions 的项目。

﻿

#### Node Functions 与 Edge Functions 的区别

| **特性**   | **Node Functions**                            | **Edge Functions**         |
| ---------- | --------------------------------------------- | -------------------------- |
| 运行位置   | 云中心                                        | 全球边缘节点               |
| 冷启动时间 | 相对较长                                      | 毫秒级                     |
| 延迟性能   | 较低                                          | 极低                       |
| 运行时环境 | Node.js Runtime                               | Edge Runtime               |
| 适用场景   | 深度依赖 Node.js 生态复杂数据处理较长执行时间 | 高并发、延迟敏感短执行时间 |



### Edge Functions

#### 概述

Edge Functions 提供了 EdgeOne 边缘节点的 Serverless 代码执行环境，您只需编写业务函数代码并设置触发规则，无需配置和管理服务器等基础设施，即可在靠近用户的边缘节点上弹性、安全地运行代码。

﻿![img](https://write-document-release-1258344699.cos.ap-guangzhou.myqcloud.com/100026466949%2F0bc4971784a011f0ae9d5254001c06ec.png)

#### 优势

**分布式部署**

EdgeOne 拥有超过 3200+ 边缘节点，边缘函数以分布式部署的方式运行在边缘节点。

﻿

**超低延迟**

客户端请求将自动被调度至靠近您用户最近的边缘节点上，命中触发规则触发边缘函数对请求进行处理并响应结果给客户端，可显著降低客户端的访问时延。

﻿

**弹性扩容**

边缘函数可以根据客户端请求数的突增，由近及远的将请求调度至有充足计算资源的边缘节点处理，您无需担忧突峰场景。

﻿

**Serverless 架构**

您无需再关心和维护底层服务器的内存、CPU、网络和其他基础设施资源，可以挪出精力更专注业务代码的开发。

#### 快速开始

在项目的 ./edge-functions/api 目录下新建 hello.ts，使用以下示例代码创建您的第一个 Edge Functions：

```typescript
// 文件路径 ./edge-functions/api/hello.js
// 访问路径 example.com/api/hello
export default function onRequest(context) {
  return new Response('Hello from Edge Functions!');
}
```

**注意：**

在 ./edge-functions 目录下创建 index.js，访问根路径则会进入到该函数而非首页。

在 ./edge-functions 目录下创建 [[id]].js，除根路径外其他所有路径都会进入到该函数，需在函数内处理静态资源的返回。

#### 路由 

Edge Functions 基于 `/edge-functions` 目录结构生成访问路由。您可在项目仓库 /edge-functions 目录下创建任意层级的子目录，参考下述示例。

```bash
...
edge-functions
├── index.js
├── hello-pages.js
├── helloworld.js
├── api
    ├── users
      ├── list.js
      ├── geo.js
      ├── [id].js
    ├── visit
      ├── index.js
    ├── [[default]].js
...
```

上述目录文件结构，经 EdgeOne Pages 平台构建后将生成以下路由。这些路由将 Pages URL 映射到 `/edge-functions` 文件，当客户端访问 URL 时将触发对应的文件代码被运行：

| 文件路径                           | 路由                                                         |
| ---------------------------------- | ------------------------------------------------------------ |
| /edge-functions/index.js           | example.com/                                                 |
| /edge-functions/hello-pages.js     | example.com/hello-pages                                      |
| /edge-functions/helloworld.js      | example.com/helloworld                                       |
| /edge-functions/api/users/list.js  | example.com/api/users/list                                   |
| /edge-functions/api/users/geo.js   | example.com/api/users/geo                                    |
| /edge-functions/api/users/[id].js  | example.com/api/users/1024                                   |
| /edge-functions/api/visit/index.js | example.com/api/visit                                        |
| /edge-functions/api/[[default]].js | example.com/api/books/listexample.com/api/books/1024example.com/api/... |

**说明：**

路由尾部斜杠 / 是可选。`/hello-pages` 和 `/hello-pages/` 将被路由到 /edge-functions/hello-pages.js。

如果没有匹配到 Edge Functions 路由，客户端请求将被路由到 Pages 对应的静态资源。

路由大小写敏感，/helloworld 将被路由到 /edge-functions/helloworld.js，不能被路由到 /edge-functions/HelloWorld.js

﻿

**动态路由**

Edge Functions 支持动态路由，上述示例中一级动态路径 /edge-functions/api/users/[id].js，多级动态路径 /edge-functions/api/[[default]].js。参考下述用法：

| 文件路径                           | 路由                       | 匹配 |
| ---------------------------------- | -------------------------- | ---- |
| /edge-functions/api/users/[id].js  | example.com/api/users/1024 | 是   |
| example.com/api/users/vip/1024     | 否                         |      |
| example.com/api/vip/1024           | 否                         |      |
| /edge-functions/api/[[default]].js | example.com/api/books/list | 是   |
| example.com/api/1024               | 是                         |      |
| example.com/v2/vip/1024            | 否                         |      |

﻿

#### Function Handlers

使用 Functions Handlers 可为 Pages 创建自定义请求处理程序，以及定义 RESTful API 实现全栈应用。支持下述的 Handlers 方法：

| Handlers 方法                                                | 描述                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| `onRequest`(context: EventContext): Response \| Promise<Response> | 匹配 HTTP Methods (`GET`, `POST`, `PATCH`, `PUT`, `DELETE`, `HEAD`, `OPTIONS`) |
| `onRequestGet`(context: EventContext): Response \| Promise<Response> | 匹配 HTTP Methods (`GET`)                                    |
| `onRequestPost`(context: EventContext): Response \| Promise<Response> | 匹配 HTTP Methods (`POST`)                                   |
| `onRequestPatch`(context: EventContext): Response \| Promise<Response> | 匹配 HTTP Methods (`PATCH`)                                  |
| `onRequestPut`(context: EventContext): Response \| Promise<Response> | 匹配 HTTP Methods (`PUT`)                                    |
| `onRequestDelete`(context: EventContext): Response \| Promise<Response> | 匹配 HTTP Methods (`DELETE`)                                 |
| `onRequestHead`(context: EventContext): Response \| Promise<Response> | 匹配 HTTP Methods (`HEAD`)                                   |
| `onRequestOptions`(context: EventContext): Response \| Promise<Response> | 匹配 HTTP Methods (`OPTIONS`)                                |

﻿

**EventContext 对象描述**

context 是传递给 Function Handlers 方法的对象，包含下述属性：

request：客户端请求对象 [Request](https://cloud.tencent.com/document/product/1552/81902)﻿

params：动态路由 `/edge-functions/api/users/[id].js` 参数值

```javascript
export function onRequestGet(context) {
  return new Response(`User id is ${context.params.id}`);
}
```

env：Pages 环境变量

waitUntil：`(task: Promise<any>): void;` 用于通知边缘函数等待 Promise 完成，可延长事件处理的生命周期

﻿

#### Runtime APIs

Edge Functions 基于[边缘函数](https://cloud.tencent.com/document/product/1552/81344)实现，提供了 EdgeOne 边缘节点的 Serverless 代码执行环境。支持 ES6 语法和标准的 Web Service Worker API。其中大部分 Runtime APIs 可参考[边缘函数](https://cloud.tencent.com/document/product/1552/81344)用法，参考下述描述：

| API                                                          | 描述                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| [Cache](https://cloud.tencent.com/document/product/1552/81893) | Cache 基于 Web APIs 标准 [Cache API](https://developer.mozilla.org/en-US/docs/Web/API/Cache) 进行设计。Functions 运行时会在全局注入 caches 对象，该对象提供了一组缓存操作接口。 |
| [Cookies](https://cloud.tencent.com/document/product/1552/83932) | Cookies 提供了一组 cookie 操作接口。                         |
| [Encoding](https://cloud.tencent.com/document/product/1552/81896) | 基于 Web APIs 标准 [TextEncoder](https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder/TextEncoder)、[TextDecoder](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder/TextDecoder) 进行设计，实现了编码器与解码器。 |
| [Fetch](https://cloud.tencent.com/document/product/1552/81897) | 基于 Web APIs 标准 [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) 进行设计。边缘函数运行时可使用 fetch 发起异步请求，获取远程资源。 |
| [Headers](https://cloud.tencent.com/document/product/1552/81903) | Headers 基于 Web APIs 标准 [Headers](https://developer.mozilla.org/en-US/docs/Web/API/Headers) 进行设计。可用于 HTTP request 和 response 的头部操作。 |
| [Request](https://cloud.tencent.com/document/product/1552/81902) | Request 代表 HTTP 请求对象，基于 Web APIs 标准 [Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) 进行设计。 |
| [Response](https://cloud.tencent.com/document/product/1552/81917) | Response 代表 HTTP 响应，基于 Web APIs 标准 [Response](https://developer.mozilla.org/en-US/docs/Web/API/Response) 进行设计。 |
| [Streams](https://cloud.tencent.com/document/product/1552/81914) | ReadableStream 可读流，也称为可读端，基于 Web APIs 标准 [ReadableStream](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) 进行设计。 |
| [Web Crypto](https://cloud.tencent.com/document/product/1552/83933) | Web Crypto API 基于 Web APIs 标准 [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) 进行设计。提供了一组常见的加密操作接口，相比纯 JavaScript 实现的加密接口，Web Crypto API 的性能更高。 |
| [Web Standards](https://cloud.tencent.com/document/product/1552/84091) | 边缘函数基于 V8 JavaScript 引擎设计实现的 Serverless 代码执行环境，提供了以下标准化的 Web APIs。 |

**说明：**

当前 [EdgeOne CLI](https://edgeone.cloud.tencent.com/pages/document/162936923278893056) 调试环境中不支持使用 fetch 访问 EdgeOne 节点缓存或回源。

使用 context.request.eo 可获取客户端 [GEO](https://cloud.tencent.com/document/product/1552/81902#eo) 信息。

Edge Functions 不支持使用 addEventListener，请基于 [Function Handlers](https://edgeone.cloud.tencent.com/pages/document/162936866445025280#7dfbfcb5-f69b-433f-80d0-eff71e99954f)监听客户端请求。

﻿

#### 使用限制

| **内容**       | **限制**   | **说明**                                           |
| -------------- | ---------- | -------------------------------------------------- |
| 代码包大小     | 5 MB       | 单个函数代码包大小最多支持 5 MB                    |
| 请求 body 大小 | 1 MB       | 客户端请求携带 body 最多支持 1 MB                  |
| CPU 时间       | 200 ms     | 函数单次执行分配的 CPU 时间片，不包含 I/O 等待时间 |
| 开发语言       | JavaScript | 目前仅支持 JavaScript，ES2023+                     |

﻿

#### 示例模板



**获取用户访问地理位置：**

预览地址：[https://functions-geolocation.edgeone.run](https://functions-geolocation.edgeone.run/)﻿

源码地址：https://github.com/TencentEdgeOne/pages-templates/tree/main/examples/functions-geolocation﻿

﻿

**使用 KV 记录页面访问数：**

预览地址：[https://functions-kv.edgeone.run](https://functions-kv.edgeone.run/)﻿

源码地址：https://github.com/TencentEdgeOne/pages-templates/tree/main/examples/functions-kv﻿

有关如何使用 KV 存储的详细信息，请参阅 [KV 存储](https://pages.edgeone.ai/zh/document/kv-storage)。

﻿

**连接 supabase 三方数据库：**

预览地址：[https://functions-supabase.edgeone.run](https://functions-supabase.edgeone.run/)﻿

源码地址：https://github.com/TencentEdgeOne/pages-templates/tree/main/examples/functions-supabase﻿