-- EMAILGA YUBORILADIGAN TASDIQLASH KODLARI.
--
-- Egasining talabi: "ro'yxatdan o'tishda emailga kod kelsin", "email
-- bilan kirsa email orqali tasdiqlash".
--
-- Nima uchun ALOHIDA jadval, `phone_otp_codes` emas: u yerdagi ustun
-- `phone TEXT(32)` — telefon raqami uchun. Email 120 belgigacha
-- bo'lishi mumkin va u telefon emas. Ikkalasini bitta ustunga tiqish
-- keyinchalik "bu qator telefonmi yoki emailmi?" degan chalkashlikni
-- tug'diradi va tozalash skriptlarini ham buzadi.
--
-- Tuzilishi `phone_otp_codes` bilan ATAYLAB bir xil: ikkala kanal
-- uchun kod yaratish/tekshirish mantiqi bir xil ishlaydi.
CREATE TABLE IF NOT EXISTS "email_otp_codes" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "email" TEXT (160) NOT NULL,
  "code" TEXT (64) NOT NULL,
  "purpose" TEXT (20) DEFAULT 'register' NOT NULL,
  "expires_at" TEXT NOT NULL,
  "used" INTEGER DEFAULT 0 NOT NULL,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS "email_otp_codes_lookup_idx"
  ON "email_otp_codes" ("email", "purpose", "created_at" DESC);
