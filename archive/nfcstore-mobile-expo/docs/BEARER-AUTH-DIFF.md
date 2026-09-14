# Bearer token auth — backend o'zgarishi

> **HOLAT: QO'LLANGAN VA DEPLOY QILINGAN.** PR #54 → `main` (`1bb3ab6`),
> Cloudflare deploy workflow'i `success`. Production'da uch tekshiruv ham
> kutilgan natijani berdi: `X-Client: mobile` bilan login token qaytardi,
> cookie'siz `/me` foydalanuvchini tanidi, sarlavhasiz login esa token
> qaytarmadi — ya'ni veb javobi o'zgarmagan.
>
> Bu hujjat endi **tarixiy yozuv**: nima va nega qilinganini saqlaydi.
> Qayta qo'llash kerak emas.

Uch o'zgarish ham **qo'shimcha (additive)** edi: veb tomonidagi cookie oqimi
o'zgarmadi, hech qanday mavjud xatti-harakat buzilmadi.

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

## Mobil tomon

`src/api/client.ts`:

- har so'rovga `X-Client: mobile` qo'yadi;
- token bo'lsa `Authorization: Bearer <token>` qo'shadi;
- tokenni `expo-secure-store` (Android Keystore / iOS Keychain) da saqlaydi.

Ilgari bu yerda zaxira yo'l bor edi — token javob tanasida bo'lmasa uni
`Set-Cookie` sarlavhasidan ajratib olishga harakat qilinardi. Backend
qo'llanib, deploy qilinib, tasdiqlangandan keyin u **olib tashlandi**: endi
server token bermasligi haqiqiy nosozlik va uni jim yashirib turish faqat
diagnostikani qiyinlashtirardi. `login()` ham, `register()` ham bunday holatda
`no_session_token` bilan to'xtaydi.
