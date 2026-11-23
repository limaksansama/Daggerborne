# Security Summary

**Reviewed Files**: 58 (application modules, Express server, styles, PWA manifest/service worker, datasets, and test suites)
**Issues Resolved**: 6

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Vulnerable Dependency | `package.json` | 16–17 | `@capacitor/android` `6.2.1` had a critical origin-bypass issue allowing remote content loading at the app origin via its internal HTTP proxy path. | Critical | Fixed | Upgraded `@capacitor/android` and `@capacitor/core` to `6.2.3`. |
| Stored XSS via JSON Import & DOM Sinks | `js/views/gm.js`, `js/views/sheet.js`, `js/views/dice.js`, `js/fab.js`, `js/views/chars.js`, `js/views/home.js`, `js/views/compendium.js` | `gm.js:131`, `sheet.js:626`, `dice.js:53`, `fab.js:103`, `chars.js:31` | Imported character IDs, weapon dice/UIDs, companion fields, encounter adversary instances, countdown IDs, and roll history fields were interpolated unescaped into HTML templates. | High | Fixed | Escaped all dynamic values and attributes with `esc()` across all affected views and normalized IDs/enums before storage. |
| Incomplete Import Sanitization & Prototype Pollution | `js/rules.js`, `js/core.js` | `rules.js:268`, `rules.js:357`, `core.js:140`, `core.js:293`, `core.js:310` | `importCharacterFromText`, `importFullBackupFromText`, and `normalizeState` accepted array `traits`, kept `__proto__`/`constructor`/`prototype` keys, and left `weapons`, `inventory`, `companion`, `rolls`, `countdowns`, `encounter.active`, and `cardTokens` unvalidated. | High | Fixed | Added `stripUnsafeKeys()`, strict plain-object checks, schema normalization for all nested character/GM/roll collections, and sanitized `loadSync` parsing. |
| Unsafe Portrait URI Injection | `js/rules.js` | 280 | Imported JSON allowed arbitrary `javascript:`, `http://`, or `data:image/svg+xml` URLs inside `character.portrait`, rendered directly in `<img src>`. | Medium | Fixed | Restricted `portrait` via `sanitizePortrait()` to empty string or base64 raster images (`jpeg`, `jpg`, `png`, `webp`, `gif`) under 2 MB. |
| Unbounded File Import Size | `js/core.js`, `js/views/chars.js`, `js/views/settings.js`, `js/views/sheet.js` | `core.js:4–5`, `chars.js:63`, `settings.js:137`, `sheet.js:1393` | File inputs passed arbitrarily large files directly into `FileReader.readAsText` and `JSON.parse`. | Low | Fixed | Enforced `MAX_CHAR_IMPORT_BYTES` (2 MB) and `MAX_BACKUP_IMPORT_BYTES` (10 MB) before file reading and inside import parsers. |
| Static Root Exposure & Missing Security Headers | `server.js` | 8–34 | `express.static(__dirname)` exposed `server.js`, `package.json`, `bun.lock`, `tests/`, and config files while omitting baseline security headers and disclosing `X-Powered-By`. | Medium | Fixed | Disabled `x-powered-by`, restricted static serving strictly to `/css`, `/js`, `/data`, `/assets`, `/public`, `index.html`, `manifest.webmanifest`, and `sw.js`, and added CSP, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy`. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| Prototype & Payload Sanitization | `js/rules.js`, `js/core.js` | Recursive `stripUnsafeKeys()` removes `__proto__`, `constructor`, and `prototype`; `sanitizeCharacter()` and `normalizeState()` clamp numeric bounds and validate enums/IDs. |
| Safe HTML Rendering | `js/core.js`, `js/views/*.js`, `js/fab.js` | User-supplied and imported strings pass through `esc()` before HTML template interpolation; no `eval()` or unsafe URL execution paths exist. |
| Server File Confinement & Headers | `server.js` | Only allowlisted public web folders and root entry files are served (internal configs/tests return `404`), with a strict `Content-Security-Policy` blocking inline/remote script execution. |
| Local-Only Storage & External Links | `js/core.js`, `js/views/settings.js` | No secrets or credentials exist in client or server code; external documentation links open with `rel="noopener"`. |

## PoC Verification

### Unvalidated JSON Import & Stored DOM Injection
#### Summary
| Field | Value |
|---|---|
| Issue Type | Unsanitized JSON Import & Unescaped HTML Rendering |
| Impact | High |
| Affected File | `js/core.js:310`, `js/rules.js:357`, `js/views/gm.js:260`, `js/views/sheet.js:626` |
| Test Scenario | Import a crafted backup JSON containing `"__proto__": {"polluted": true}`, `portrait: "javascript:alert(1)"`, `id: "\" onmouseover=\"alert(1)"`, `weapons[0].dice: "d6\" onclick=\""`, and an encounter instance with `type: "<svg onload=alert(1)>"` and `uid: "\" onclick=\"alert(1)"`. |

#### How It Was Fixed
Import handlers now parse JSON through `stripUnsafeKeys()`, require plain-object payloads within size limits, validate and normalize all nested fields in `sanitizeCharacter()` and `normalizeState()`, restrict `portrait` to safe raster base64 data URIs, and escape every dynamic value rendered into HTML templates with `esc()`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Crafted backup string enters `importFullBackupFromText(evilBackup, 'replace')` at `js/core.js:310`. | Size check passes (< 10 MB) and payload enters `safeJsonParse()`. |
| 2 | `safeJsonParse()` at `js/core.js:136` invokes `stripUnsafeKeys()` (`js/rules.js:268`), discarding `__proto__` before passing objects onward. | Prototype chain remains untouched (`({}).polluted === undefined`). |
| 3 | `sanitizeCharacter()` (`js/rules.js:357`) invokes `sanitizeId()` (`js/rules.js:287`), `sanitizePortrait()` (`js/rules.js:280`), and `sanitizeWeapon()` (`js/rules.js:293`). | Unsafe `id`, `portrait`, and `dice` are neutralized to safe IDs, `""`, and `"d6"`. |
| 4 | `normalizeState()` (`js/core.js:140`) invokes `sanitizeEncounterInst()` (`js/core.js:86`) and `sanitizeCountdown()` (`js/core.js:74`), normalizing `uid` and field lengths. | Malicious encounter/countdown IDs are replaced with safe generated UIDs. |
| 5 | Views (`chars.js:31`, `sheet.js:626`, `gm.js:260`, `dice.js:53`) render the stored records through `esc(...)`. | Any remaining HTML metacharacters render inertly as escaped text (`&lt;svg...`). |

#### Conclusion
**Fix Verified** - Verified by `tests/rules.test.js` and `tests/app.test.js`, confirming that prototype pollution, `javascript:` portrait URLs, and attribute/tag injection payloads are neutralized at import time and escaped at render time.

### Express Static Root Disclosure
#### Summary
| Field | Value |
|---|---|
| Issue Type | Sensitive File Exposure via Unrestricted Static Directory |
| Impact | Medium |
| Affected File | `server.js:22-34` |
| Test Scenario | Request `GET /package.json`, `GET /server.js`, `GET /bun.lock`, `GET /tests/app.test.js`, and `GET /.git/HEAD` against the running server. |

#### How It Was Fixed
Replaced `express.static(__dirname)` with explicit static mounts solely for `/css`, `/js`, `/data`, `/assets`, and `/public` (ignoring dotfiles), plus an explicit route table (`ROOT_FILES`) for `/`, `/index.html`, `/manifest.webmanifest`, and `/sw.js`, alongside `app.disable('x-powered-by')` and HTTP security headers.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Client sends `GET /package.json` or `GET /server.js` to Express in `server.js`. | Security headers middleware sets `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and `Content-Security-Policy`. |
| 2 | Path does not match `/css`, `/js`, `/data`, `/assets`, `/public` (`server.js:22`) or `ROOT_FILES` (`server.js:25`). | Static and root handlers are bypassed. |
| 3 | Fallback handler checks `path.extname(req.path)` (`server.js:43`) and reaches `res.status(404).end()` (`server.js:48`). | **Handled Safely** (`404 Not Found` returned). |

#### Conclusion
**Fix Verified** - Verified by `tests/security.test.js` spawning `server.js` on an ephemeral port and confirming `200` + security headers on web assets and `404` on all internal/configuration paths.
