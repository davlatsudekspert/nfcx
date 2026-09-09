// vCard (.vcf) — "Kontaktni saqlash". Telefon uni ochib kontaktlarga
// qo'shadi, ya'ni odam sahifani yopgandan keyin ham raqamingizni
// yo'qotmaydi. NFC kartaning butun ma'nosi shu.
//
// Bir joyda yozilgan: shaxsiy profil ham, kompaniya ham shu funksiyani
// ishlatadi — aks holda ikkitasi vaqt o'tib bir-biridan farq qilib
// ketardi.

const esc = (v) => String(v == null ? '' : v)
  .replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\;');

// fields: { name, org, title, phone, email, website, note, urls: [], address }
export function buildVcard(fields = {}) {
  const urls = (fields.urls || []).filter(Boolean);
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${esc(fields.name || '')}`,
    fields.org ? `ORG:${esc(fields.org)}` : '',
    fields.title ? `TITLE:${esc(fields.title)}` : '',
    fields.phone ? `TEL;TYPE=CELL:${esc(fields.phone)}` : '',
    fields.email ? `EMAIL:${esc(fields.email)}` : '',
    fields.address ? `ADR;TYPE=WORK:;;${esc(fields.address)};;;;` : '',
    ...urls.map((u) => `URL:${esc(u)}`),
    fields.note ? `NOTE:${esc(fields.note)}` : '',
    'END:VCARD',
  ].filter(Boolean).join('\r\n'); // CRLF — RFC talabi, iOS shunisiz ba'zan ochmaydi
}

export function downloadVcard(fields, fileName = 'contact') {
  const blob = new Blob([buildVcard(fields)], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.vcf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
