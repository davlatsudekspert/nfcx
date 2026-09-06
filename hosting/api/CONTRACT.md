# hosting/api/* modullari — kontrakt

Har modul: `export async function handle(request, env, url, H)` → `Response` yoki `null` (route topilmasa).
`worker.js` barcha modullarni tartib bilan chaqiradi (`/api/*` uchun, core dispatch'dan KEYIN); hech biri javob bermasa → `404 {error:'not_found'}` (eski o'ziga-proxy olib tashlangan).

`H` — worker.js'dan uzatiladigan yordamchilar (qayta yozma, import qilma):
- `json(body, status=200)`
- `getCurrentUser(request, env)` → `{id,email,phone,isPremium,bannedUntil,...}|null` (nfc_session cookie)
- `requireAdmin(request, env)` → admin `{id, role, ...}|null` (sessiya + IP whitelist); `getCurrentAdmin`
- `getRecord(env, CODE)` → record|null (`rowToRecord` shakli, camelCase); `getRecordOwner(env, CODE)` → user_id|null
- `rowToRecord(row)`, `RECORD_COLUMNS`, `updateRecord(env, code, fields)`
- `cleanStr(v,max)`, `recSafeUrl(v)`, `uploadOrSafeUrl(v)`, `shortText(v,max)`, `safeUrl(v)`, `validCode(code)`, `parseJsonArray(t)`
- `nowTs()` (ISO), `parseDbDate(v)`, `newToken(bytes)`, `sha256Hex(t)`, `hashPassword(p)`, `verifyPassword(p, stored)`
- `reqIp(request)`, `logAdminActivity(env,{action,details,oldValue,newValue,ip})`, `sendTelegramMessage(env, text)` (ADMIN_CHAT_ID ga), `sendTelegramTo(env, chatId, text)`
- `personalIdTierD1(rec)`, `effectiveAccessD1(rec)`, `featureAllowedD1(feature, access)`, `paymentsEnabledD1(env)`
- `ensureCoreSchema(env)`

Qoidalar: har query `.bind()`; egalik tekshiruvi SERVER tomonda (`getRecordOwner === user.id`); javob shakllari `server/index.js` (Express) bilan BIR XIL (frontend `src/lib/db.js` shunga bog'langan); D1 = SQLite (JSONB yo'q → TEXT + JSON.parse; `RETURNING` bor; `ON CONFLICT` bor; `NOW()` yo'q → `H.nowTs()`; `ILIKE` yo'q → `LOWER(x) LIKE LOWER(?)`).
Har modul uchun test: `scripts/test-<modul>.mjs` (`scripts/lib/d1-harness.mjs` orqali, haqiqiy `worker.fetch` bilan).
