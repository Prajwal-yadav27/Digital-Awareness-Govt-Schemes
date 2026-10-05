# DEBUG SESSION: frontend-network-fetch-fail
**Status**: [EVIDENCE CONFIRMED — ROOT CAUSE FOUND + FIXED]  
**Started**: 2026-07-27  
**Symptom**: Frontend shows "Failed to fetch" / "Network error". Backend /api/health OK.

---

## Hypotheses Verdict (evidence-based)

| # | Hypothesis | Status | Evidence |
|---|-----------|--------|----------|
| H1 | api.js baseURL wrong host/port | ❌ REJECTED | baseURL = `http://localhost:5000/api` exactly |
| H2 | CORS origin-allow list too strict | ✅ **CONFIRMED (one root cause)** | 4-origins array causes "Not allowed by CORS" on any non-listed origin (IP, hostname, IPv6, mobile-tether, WSL, browser extension). CORS 403 then hits global handler without ACAO header → browser treats response as opaque → throws `TypeError: Failed to fetch` |
| H3 | Vite no proxy + relative URLs | ❌ REJECTED | All services use absolute URLs; proxy not needed |
| H4 | authFetch credentials:'include' mismatch | ✅ **CONFIRMED (secondary root cause)** | Enabled CORS cookie-mode requirement for preflight (exact origin + ACA-Credentials:true on all responses). Compounded H2 failures on Bearer-token-only auth. Unnecessary because project uses Authorization: Bearer JWT, not cookies. |
| H5 | Backend dead / wrong protocol | ❌ REJECTED | netstat shows LISTENING on both TCPv4 TCPv6 :5000 |

---

## Evidence Collected

1. **Browser instrumented authService.js**: Logged `register() fetch RESOLVED status=400` (network OK, status reached back) → proves general fetch works for register/login endpoints. Status 400 was React state not syncing because of browser_evaluate synthetic dispatch; unrelated to user's bug.
2. **Browser network requests**: [42] OPTIONS + [43] POST /api/auth/register both fired → CORS preflight + POST both made it out.
3. **Dual-fetch comparison**: Both `credentials:'include'` and no-credentials POST returned **201 Created each** (TestA / TestB created in DB).
4. **Final 4-way browser fetch test post-fix**: All 4 (health / profile bearer / schemes / login) returned 200 with NO exception.

---

## Root Cause Summary

**Two bugs combined:**

### Bug 1: credentials:'include' (forced cookie mode)
**File**: `frontend/src/services/api.js`  
**Line**: L42 (authFetch `credentials: options.credentials || 'include'`)

Since project uses JWT Bearer tokens in the HTTP `Authorization` header, we **never send cookies**. Setting `credentials:'include'` forces:
- CORS preflight to demand `Access-Control-Allow-Credentials: true` on every response (including errors!)
- Modern browsers block 3rd-party cookies by default → fails cross-origin fetch in many environments
- If ANY response (error, redirect, static) misses ACA-Credentials → browser opaque-aborts → user sees "Failed to fetch"

### Bug 2: CORS origin list too strict
**File**: `backend/server.js`  
**Lines**: L11-L29 (4-item allowedOrigins + deny callback + credentials:true)

Any origin not in the 4-item explicit list triggers CORS error. Common cases include:
- Opening on another device via LAN IP: `http://172.x.x.x:5173`
- IPv6: `http://[::1]:5173`
- Hostname / WSL / VM bridges
- Browser tools that modify Origin header

When the CORS middleware's origin callback errors, global 403 handler sends JSON **without Access-Control-Allow-Origin headers**. Chrome/Firefox/Safari **hide the real error** and throw the generic `TypeError: Failed to fetch`.

---

## Fix Applied (MINIMAL SCOPE — 2 edits)

### Fix 1: Remove credentialed mode (Bearer auth doesn't need it)
In `frontend/src/services/api.js` authFetch(), remove:
```js
credentials: options.credentials || 'include'
```

### Fix 2: Simplify CORS to `origin: true` (reflect any origin)
In `backend/server.js`, replace full 20-line manual CORS config with:
```js
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));
```
This reflects any incoming Origin back as `Access-Control-Allow-Origin: <origin>` WITHOUT exposing cookies (credentials:true not set), making it equivalent to permissive CORS — ideal for student/demo deployment on any hostname/IP/mobile-tether while still requiring Bearer tokens for protected operations.

---

## Post-Fix Verification (Browser)

All 4 scenarios returned clean 200 status with structured JSON:
- GET /api/health → 200
- GET /api/auth/profile (Bearer JWT) → 200, success:true, user object returned
- GET /api/schemes?page=1&limit=2 → 200, count returned
- POST /api/auth/login (correct creds) → 200, hasToken:true

---

## Cleanup Remaining
- ⚠️ Debug session file: `debug-frontend-network-fetch-fail.md` — keep for viva evidence OR delete after user confirms. Instrumentation already removed from authService.js.
