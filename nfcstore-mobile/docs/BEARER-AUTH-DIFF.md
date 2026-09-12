# Bearer token auth — backend uchun aniq diff

Bu o'zgarishlar **mobil ilova uchun** kerak. Ularni `nfcx` repozitoriyasida
(sayt sessiyasida) o'zingiz qo'llaysiz — mobil loyiha `hosting/` ga tegmaydi.

Uch o'zgarish ham **qo'shimcha (additive)**: veb tomonidagi cookie oqimi
o'zgarmaydi, hech qanday mavjud xatti-harakat buzilmaydi.

## Nega cookie emas

Sayt `nfc_session` — HttpOnly, `SameSite=Lax`, 30 kunlik cookie ishlatadi
(`hosting/worker.js`, `sessionCookieHeader`). React Native da bu ishonchsiz:

- iOS va Android `fetch` cookie jar'lari boshqacha ishlaydi;
- ilova ichidagi WebView (Payme checkout) alohida cookie maydoniga ega;
- ilova fonda uzoq turib qaytganda cookie yo'qolishi mumkin.

Token esa `expo-secure-store` (Android Keystore / iOS Keychain) da yotadi va
har so'rovga sarlavha sifatida qo'shiladi.

Sessiya mexanizmining o'zi **o'zgarmaydi**: xuddi shu `sessions` jadvali, xuddi
shu SHA-256 hash, xuddi shu 30 kunlik muddat. Faqat token yetkazib berish
kanali qo'shiladi.

---

## 1. `getCurrentUser()` — Bearer sarlavhasini ham qabul qilish

**Fayl:** `hosting/worker.js` (~2738-qator)

Bu **eng muhim o'zgarish**: `upstreamUser()` va `requireCompanyOwner()`
hammasi shu funksiyaga tayanadi, demak bitta joydagi uch qator butun
autentifikatsiyalangan API ni mobil uchun ochadi.

```diff
 async function getCurrentUser(request, env) {
-  const token = parseCookies(request)[SESSION_COOKIE];
+  // MOBIL: cookie bo'lmasa `Authorization: Bearer <token>` dan o'qiymiz.
+  // Sessiya mexanizmi bir xil — faqat token yetkazish kanali boshqa.
+  // Veb uchun hech narsa o'zgarmaydi: cookie bor bo'lsa u birinchi.
+  const cookieToken = parseCookies(request)[SESSION_COOKIE];
+  const authHeader = request.headers.get('authorization') || '';
+  const bearer = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
+  const token = cookieToken || (bearer ? bearer[1].trim() : null);
   if (!token) return null;
```

Qolgan qismi (hash, `sessions` JOIN, muddat tekshiruvi) **o'zgarmaydi**.

## 2. `/api/auth/login` — javob tanasida token qaytarish

**Fayl:** `hosting/worker.js` (~4906-qator, `authApi`)

`createUserSession()` allaqachon xom tokenni qaytaradi (`{ token, cookie }`) —
hozir u faqat `Set-Cookie` ga ketib, javob tanasidan tashlab yuboriladi.

```diff
     const session = await createUserSession(env, row.id, request);
-    return jsonWithCookie({ user: { id: row.id, email: publicEmailD1(row.email) } }, 200, session.cookie);
+    // MOBIL: `X-Client: mobile` bo'lsa token tanada ham qaytadi.
+    // Veb bu sarlavhani yubormaydi, demak javobi bitma-bit avvalgidek.
+    const wantsToken = (request.headers.get('x-client') || '').toLowerCase() === 'mobile';
+    return jsonWithCookie({
+      user: { id: row.id, email: publicEmailD1(row.email) },
+      ...(wantsToken ? { token: session.token } : {}),
+    }, 200, session.cookie);
```

## 3. `finishRegistration()` — xuddi shunday

**Fayl:** `hosting/api/auth.js` (~`finishRegistration` oxiri)

```diff
   const s = await H.createUserSession(env, user.id, request);
-  return H.jsonWithCookie({ user: { id: user.id, email: H.publicEmailD1(user.email) } }, 201, s.cookie);
+  const wantsToken = (request.headers.get('x-client') || '').toLowerCase() === 'mobile';
+  return H.jsonWithCookie({
+    user: { id: user.id, email: H.publicEmailD1(user.email) },
+    ...(wantsToken ? { token: s.token } : {}),
+  }, 201, s.cookie);
```

---

## Xavfsizlik bo'yicha izoh

`X-Client: mobile` sarlavhasini **istalgan** mijoz yuborishi mumkin, ya'ni u
himoya emas. Lekin bu xavf tug'dirmaydi: token faqat **muvaffaqiyatli
autentifikatsiyadan keyin**, allaqachon o'sha so'rovga `Set-Cookie` bilan
berilayotgan qiymatning o'zi sifatida qaytariladi. Ya'ni sarlavha yangi
imkoniyat bermaydi — faqat o'sha tokenni o'qishning boshqa shaklini beradi.

Brauzerda XSS orqali o'g'irlanish xavfi ham oshmaydi: veb mijoz bu
sarlavhani yubormaydi, shuning uchun brauzerdagi token HttpOnly cookie
ichida qolaveradi.

Xohlasangiz sarlavha o'rniga `POST /api/auth/login` ga `{ mobile: true }`
maydonini qo'yish ham bir xil natija beradi — men sarlavhani tanladim,
chunki u `register` da ham bir xil ishlaydi va mavjud tana sxemasiga
tegmaydi.

## Mobil tomon tayyor

`src/api/client.ts` allaqachon:

- har so'rovga `X-Client: mobile` qo'yadi;
- token bo'lsa `Authorization: Bearer <token>` qo'shadi;
- tokenni `expo-secure-store` da saqlaydi.

Zaxira yo'l ham bor: backend hali tanada token qaytarmasa, klient uni
`Set-Cookie` sarlavhasidan ajratib olishga harakat qiladi
(`extractTokenFromCookie`). Ishlaydi, lekin mo'rt — shuning uchun yuqoridagi
uch o'zgarish qo'llanganidan keyin o'sha zaxira yo'lni olib tashlash mumkin.
