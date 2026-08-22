// "Chiroyli nomlar ro'yxati" — sayt formatiga moslashtirilgan eksklyuziv
// kodlar to'plami (3 lotin harfi + 2 raqam). Narxlar bu yerda saqlanmaydi —
// ular priceFor() orqali joriy savdolar soniga qarab jonli hisoblanadi.
//
// Toifalar:
//   top    — uchala harf bir xil + maxsus raqam (×6 harf)
//   middle — ikkita harf bir xil + maxsus raqam (×2.5 harf)
//   nick   — mashhur nik-nomlar (VIP uslubidagi tanish so'zlar)

export const PREMIUM_GROUPS = [
  {
    id: 'top',
    label: 'Top daraja',
    desc: 'Uchala harf bir xil + maxsus raqam (VVV00) — eng yuqori toifa.',
    codes: [
      'AAA00', 'VVV00', 'TTT00', 'SSS00', 'KKK00', 'MMM00', 'BBB00', 'ZZZ00', 'RRR00', 'GGG00',
      'AAA77', 'VVV77', 'TTT77', 'SSS77', 'KKK77', 'MMM77', 'BBB77', 'ZZZ77', 'RRR77', 'GGG77',
    ],
  },
  {
    id: 'middle',
    label: "O'rta daraja",
    desc: "Ikkita harf bir xil + \"00\" yoki \"77\" kombinatsiyasi.",
    codes: [
      'AAB00', 'ABA00', 'VVA00', 'AVV00', 'SSA00', 'ASS00', 'TTA00', 'ATT00',
      'MMA00', 'AMM00', 'KKA00', 'AKK00', 'BBA00', 'ABB00', 'GGA00', 'AGG00',
      'AAB77', 'ABA77', 'VVA77', 'AVV77', 'SSA77', 'ASS77', 'TTA77', 'ATT77',
      'MMA77', 'AMM77', 'KKA77', 'AKK77', 'BBA77', 'ABB77', 'GGA77', 'AGG77',
    ],
  },
  {
    id: 'nick',
    label: 'Nik-nomlar',
    desc: 'Tanish/mashhur so\'zlar — VIP uslubidagi nomlar.',
    codes: [
      'VIP77', 'TOP77', 'MAX77', 'PRO77', 'ALI77', 'BEK77', 'JON77', 'NUR77',
      'DON77', 'GUL77', 'BOY77', 'SHO77', 'TEZ77', 'SIR77', 'XON77', 'KUB77',
      'ACE77', 'ISH77', 'OSH77', 'YER77',
    ],
  },
];

export function findPremiumGroup(code) {
  return PREMIUM_GROUPS.find((g) => g.codes.includes(code)) || null;
}
