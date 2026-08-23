// "Chiroyli nomlar ro'yxati" — sayt formatiga moslashtirilgan eksklyuziv
// kodlar to'plami (3 lotin harfi + 3 raqam). Narxlar bu yerda saqlanmaydi —
// ular priceForCode() orqali joriy savdolar soniga qarab jonli hisoblanadi.
//
// Toifalar:
//   top    — uchala harf bir xil + maxsus raqam (×6 harf)
//   middle — ikkita harf bir xil + maxsus raqam (×2.5 harf)
//   nick   — mashhur nik-nomlar (VIP uslubidagi tanish so'zlar)

export const PREMIUM_GROUPS = [
  {
    id: 'top',
    label: 'Top daraja',
    desc: 'Uchala harf bir xil + maxsus raqam (AAA000) — eng yuqori toifa.',
    codes: [
      'AAA000', 'VVV000', 'TTT000', 'SSS000', 'KKK000', 'MMM000', 'BBB000', 'ZZZ000', 'RRR000', 'GGG000',
      'AAA777', 'VVV777', 'TTT777', 'SSS777', 'KKK777', 'MMM777', 'BBB777', 'ZZZ777', 'RRR777', 'GGG777',
    ],
  },
  {
    id: 'middle',
    label: "O'rta daraja",
    desc: 'Ikkita harf bir xil + "000" yoki "777" kombinatsiyasi.',
    codes: [
      'AAB000', 'ABA000', 'VVA000', 'AVV000', 'SSA000', 'ASS000', 'TTA000', 'ATT000',
      'MMA000', 'AMM000', 'KKA000', 'AKK000', 'BBA000', 'ABB000', 'GGA000', 'AGG000',
      'AAB777', 'ABA777', 'VVA777', 'AVV777', 'SSA777', 'ASS777', 'TTA777', 'ATT777',
      'MMA777', 'AMM777', 'KKA777', 'AKK777', 'BBA777', 'ABB777', 'GGA777', 'AGG777',
    ],
  },
  {
    id: 'nick',
    label: 'Nik-nomlar',
    desc: 'Tanish/mashhur so\'zlar — VIP uslubidagi nomlar.',
    codes: [
      'VIP777', 'TOP777', 'MAX777', 'PRO777', 'ALI777', 'BEK777', 'JON777', 'NUR777',
      'DON777', 'GUL777', 'BOY777', 'SHO777', 'TEZ777', 'SIR777', 'XON777', 'KUB777',
      'ACE777', 'ISH777', 'OSH777', 'YER777',
    ],
  },
];

export function findPremiumGroup(code) {
  return PREMIUM_GROUPS.find((g) => g.codes.includes(code)) || null;
}
