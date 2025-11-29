# Lark Authentication Implementation Plan

The goal is to restrict access to the internal portal to employees with `@lodgegeek.com` email addresses using Lark (International) authentication on Tencent EdgeOne Pages.

## User Review Required

> [!IMPORTANT]
> You will need to replace `LARK_APP_ID` and `LARK_APP_SECRET` in `edge-functions/api/auth.js` with your actual Lark App credentials.
> You also need to configure the Redirect URI in the Lark Developer Console to `https://nav.lodgegeek.com/api/auth.js`.

## Proposed Changes

### Cleanup

#### [MODIFY] [package.json](file:///c:/dev/homer/package.json)
- Remove `wrangler` dependency.
- Remove `deploy` script.

#### [DELETE] [wrangler.toml](file:///c:/dev/homer/wrangler.toml)
- Delete the file as it is no longer needed.

### Authentication Implementation

#### [NEW] [edge-functions/api/auth.js](file:///c:/dev/homer/edge-functions/api/auth.js)
- Implement the Lark authentication logic as specified in the requirements.
- Handles login check, redirection to Lark, callback processing, and cookie management.

#### [NEW] [_routes.json](file:///c:/dev/homer/_routes.json)
- Configure routing to ensure all requests go through the authentication function.

## Verification Plan

### Manual Verification
- Deploy the changes to EdgeOne Pages.
- Visit `https://nav.lodgegeek.com`.
- Verify redirection to Lark login page.
- Login with a valid `@lodgegeek.com` account and verify access is granted.
- Login with an invalid account (if possible) and verify access is denied.
