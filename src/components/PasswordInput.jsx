import { useState } from 'react';

// Har qanday parol maydoniga "ko'rsatish/yashirish" tugmasini qo'shadigan
// umumiy o'ram — <input type="password" .../> o'rniga shu ishlatiladi.
// Original `className` inputning o'zida qoladi (uslub o'zgarmaydi), faqat
// tugma uchun joy qo'shiladi; joylashuvga bog'liq sig'im klasslari (masalan
// "w-full", "flex-1") `containerClassName` orqali beriladi.
export default function PasswordInput({ containerClassName = '', className = '', iconClassName = '', ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className={`relative ${containerClassName}`}>
      <input {...props} type={show ? 'text' : 'password'} className={`${className} pr-9`} />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Parolni yashirish" : "Parolni ko'rsatish"}
        title={show ? "Parolni yashirish" : "Parolni ko'rsatish"}
        className={`absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center justify-center opacity-50 transition hover:opacity-90 ${iconClassName}`}
      >
        {show ? (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
