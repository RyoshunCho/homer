# Homer / LodgeGeek Navi Current State

Last updated: 2026-06-28

## Production

- Product name: LodgeGeek Navi
- Production URL: `https://nav.lodgegeek.com`
- Hosting: Tencent EdgeOne Pages
- Deploy flow: push to `main` on `https://github.com/RyoshunCho/homer`
- Build command: `pnpm build`
- Build output: `dist`
- Local build command: `corepack pnpm build`

## Configuration

- Runtime config source: Cloudflare R2 public object, not EdgeOne KV.
- Config object: `config.yml`
- R2 bucket: `homer-config`
- Public config URL: `https://pub-40e4e971626a41c7848a9726fd3fad92.r2.dev/config.yml`
- In-app config editing uses Monaco Editor and the admin-only config editor.
- Keep R2 credentials and admin email settings in EdgeOne environment variables. Do not add secrets to repository files.

## Authentication

- Authentication: Lark international login.
- Allowed users: `@lodgegeek.com` enterprise email users.
- Admin users: configured through environment variable, then matched against the logged-in Lark enterprise email.

## Phone Formatter

- UI component: `src/components/PhoneValidatorWidget.vue`
- Standalone widget page: `public/phone_validator_widget.html`
- The formatter no longer embeds `libphonenumber-js` from a CDN.
- The formatter no longer owns US or China phone-location dictionaries.
- Phone parsing/location service: `https://phone-api.lodgegeek.com/v1/format`
- API docs: `https://phone-api.lodgegeek.com/swagger`
- The header icon next to `Phone No. Formatter` opens the API docs.

## Notes For Future Agents

- Do not reintroduce Cloudflare Workers for phone lookup.
- Do not add local US/China phone dictionaries back into Homer.
- Keep the phone API URL centralized in `PhoneValidatorWidget.vue` and `public/phone_validator_widget.html` unless a project-wide config mechanism is introduced.
- Existing `docs_for_AI/EdgeOne-KV-*` files are historical notes. The current config strategy is Cloudflare R2, not EdgeOne KV.
