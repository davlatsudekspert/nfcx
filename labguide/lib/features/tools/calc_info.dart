/// Klinik kalkulyatorlarning formulasi, cheklovlari va manbalari (3 tilda).
///
/// Matn formulaning kodi bilan birga versiyalanadi (formula o'zgarsa,
/// izoh ham shu commit'da o'zgaradi). Har bir cheklov birlamchi manbadan
/// tekshirilgan (docs/DECISIONS.md, D-18); manbada yo'q da'vo yozilmaydi.
library;

import '../content/content_model.dart';

enum ClinicalCalc { egfr, acr, anionGap, calcium, ldl, osmolality, hba1c }

class CalcSource {
  const CalcSource({
    required this.id,
    required this.citation,
    required this.url,
  });

  final String id;

  /// Bibliografik yozuv (tilga bog'liq emas). Jild/sahifa yozilmaydi —
  /// faqat tekshirilgan maydonlar: mualliflar, sarlavha, jurnal, yil, DOI.
  final String citation;
  final String url;
}

class CalcRef {
  const CalcRef(this.source, this.locator);
  final CalcSource source;

  /// Manba ichidagi joy (jadval, bo'lim).
  final String locator;
}

class CalcInfo {
  const CalcInfo({
    required this.formula,
    required this.limitations,
    required this.refs,
  });

  final List<LocalizedText> formula;
  final List<LocalizedText> limitations;
  final List<CalcRef> refs;
}

LocalizedText _all(String s) => LocalizedText({'uz': s, 'ru': s, 'en': s});

/// Analit kartasidan tegishli kalkulyatorga o'tish (kiritiladigan analitlar).
const Map<String, List<ClinicalCalc>> calculatorsByAnalyte = {
  'creatinine': [ClinicalCalc.egfr],
  'egfr': [ClinicalCalc.egfr],
  'urine-acr': [ClinicalCalc.acr],
  'sodium': [ClinicalCalc.anionGap, ClinicalCalc.osmolality],
  'chloride': [ClinicalCalc.anionGap],
  'potassium': [ClinicalCalc.anionGap],
  'albumin': [ClinicalCalc.calcium, ClinicalCalc.anionGap],
  'calcium': [ClinicalCalc.calcium],
  'cholesterol-total': [ClinicalCalc.ldl],
  'hdl-c': [ClinicalCalc.ldl],
  'ldl-c': [ClinicalCalc.ldl],
  'triglycerides': [ClinicalCalc.ldl],
  'non-hdl-c': [ClinicalCalc.ldl],
  'glucose-plasma-fasting': [ClinicalCalc.osmolality],
  'urea': [ClinicalCalc.osmolality],
  'hba1c': [ClinicalCalc.hba1c],
};

abstract final class CalcSources {
  static const inker2021 = CalcSource(
    id: 'calc-inker-2021',
    citation:
        'Inker LA, et al. New creatinine- and cystatin C-based equations to '
        'estimate GFR without race. N Engl J Med. 2021. '
        'doi:10.1056/NEJMoa2102953',
    url: 'https://doi.org/10.1056/NEJMoa2102953',
  );
  static const nkf2021 = CalcSource(
    id: 'calc-nkf-ckd-epi-2021',
    citation:
        'National Kidney Foundation. CKD-EPI creatinine equation (2021). '
        'kidney.org',
    url: 'https://www.kidney.org/ckd-epi-creatinine-equation-2021',
  );
  static const kdigo2012 = CalcSource(
    id: 'calc-kdigo-2012',
    citation:
        'KDIGO 2012 CKD guideline. Chapter 1: Definition and classification '
        'of CKD. Kidney Int Suppl. 2013. doi:10.1038/kisup.2012.64',
    url: 'https://doi.org/10.1038/kisup.2012.64',
  );
  static const kraut2007 = CalcSource(
    id: 'calc-kraut-2007',
    citation:
        'Kraut JA, Madias NE. Serum anion gap: its uses and limitations in '
        'clinical medicine. Clin J Am Soc Nephrol. 2007. '
        'doi:10.2215/CJN.03020906',
    url: 'https://doi.org/10.2215/CJN.03020906',
  );
  static const figge1998 = CalcSource(
    id: 'calc-figge-1998',
    citation:
        'Figge J, et al. Anion gap and hypoalbuminemia. Crit Care Med. 1998. '
        'doi:10.1097/00003246-199811000-00019',
    url: 'https://doi.org/10.1097/00003246-199811000-00019',
  );
  static const payne1973 = CalcSource(
    id: 'calc-payne-1973',
    citation:
        'Payne RB, et al. Interpretation of serum calcium in patients with '
        'abnormal serum proteins. Br Med J. 1973. doi:10.1136/bmj.4.5893.643',
    url: 'https://doi.org/10.1136/bmj.4.5893.643',
  );
  static const friedewald1972 = CalcSource(
    id: 'calc-friedewald-1972',
    citation:
        'Friedewald WT, et al. Estimation of the concentration of '
        'low-density lipoprotein cholesterol in plasma, without use of the '
        'preparative ultracentrifuge. Clin Chem. 1972. '
        'doi:10.1093/clinchem/18.6.499',
    url: 'https://doi.org/10.1093/clinchem/18.6.499',
  );
  static const sampson2020 = CalcSource(
    id: 'calc-sampson-2020',
    citation:
        'Sampson M, et al. A new equation for calculation of low-density '
        'lipoprotein cholesterol in patients with normolipidemia and/or '
        'hypertriglyceridemia. JAMA Cardiol. 2020. '
        'doi:10.1001/jamacardio.2020.0013',
    url: 'https://doi.org/10.1001/jamacardio.2020.0013',
  );
  static const atp3 = CalcSource(
    id: 'calc-ncep-atp3',
    citation:
        'NCEP Adult Treatment Panel III, full report. National Heart, Lung, '
        'and Blood Institute. 2002',
    url:
        'https://www.nhlbi.nih.gov/files/docs/resources/heart/'
        'atp-3-cholesterol-full-report.pdf',
  );
  static const rasouli2016 = CalcSource(
    id: 'calc-rasouli-2016',
    citation:
        'Rasouli M. Basic concepts and practical equations on osmolality: '
        'biochemical approach. Clin Biochem. 2016. '
        'doi:10.1016/j.clinbiochem.2016.06.001',
    url: 'https://doi.org/10.1016/j.clinbiochem.2016.06.001',
  );
  static const lynd2008 = CalcSource(
    id: 'calc-lynd-2008',
    citation:
        'Lynd LD, et al. An evaluation of the osmole gap as a screening test '
        'for toxic alcohol poisoning. BMC Emerg Med. 2008. '
        'doi:10.1186/1471-227X-8-5',
    url: 'https://doi.org/10.1186/1471-227X-8-5',
  );
  static const nathan2008 = CalcSource(
    id: 'calc-nathan-2008',
    citation:
        'Nathan DM, et al. Translating the A1C assay into estimated average '
        'glucose values. Diabetes Care. 2008. doi:10.2337/dc08-0545',
    url: 'https://doi.org/10.2337/dc08-0545',
  );
  static const ngsp = CalcSource(
    id: 'calc-ngsp-ifcc',
    citation: 'NGSP. IFCC standardization of HbA1c. ngsp.org',
    url: 'https://ngsp.org/ifcc.asp',
  );

  static const all = [
    inker2021,
    nkf2021,
    kdigo2012,
    kraut2007,
    figge1998,
    payne1973,
    friedewald1972,
    sampson2020,
    atp3,
    rasouli2016,
    lynd2008,
    nathan2008,
    ngsp,
  ];
}

final Map<ClinicalCalc, CalcInfo> calcInfo = {
  ClinicalCalc.egfr: CalcInfo(
    formula: [
      const LocalizedText({
        'uz':
            'eGFR = 142 × min(Scr/κ, 1)^α × max(Scr/κ, 1)^−1.200 × '
            '0.9938^yosh × 1.012 [ayol]',
        'ru':
            'eGFR = 142 × min(Scr/κ, 1)^α × max(Scr/κ, 1)^−1.200 × '
            '0.9938^возраст × 1.012 [женщины]',
        'en':
            'eGFR = 142 × min(Scr/κ, 1)^α × max(Scr/κ, 1)^−1.200 × '
            '0.9938^age × 1.012 [if female]',
      }),
      const LocalizedText({
        'uz': 'Ayol: κ = 0.7, α = −0.241; erkak: κ = 0.9, α = −0.302',
        'ru': 'Женщины: κ = 0.7, α = −0.241; мужчины: κ = 0.9, α = −0.302',
        'en': 'Female: κ = 0.7, α = −0.241; male: κ = 0.9, α = −0.302',
      }),
      const LocalizedText({
        'uz':
            'Scr — mg/dL. µmol/L qiymat kreatininning molyar massasi '
            '(113.12 g/mol) bo‘yicha o‘tkaziladi (≈ ÷ 88.4).',
        'ru':
            'Scr — мг/дл. Значение в мкмоль/л пересчитывается по молярной '
            'массе креатинина (113,12 г/моль) (≈ ÷ 88,4).',
        'en':
            'Scr in mg/dL. µmol/L values are converted with the creatinine '
            'molar mass (113.12 g/mol) (≈ ÷ 88.4).',
      }),
    ],
    limitations: const [
      LocalizedText({
        'uz':
            'Tenglama 18 yosh va undan katta ishtirokchilarda ishlab '
            'chiqilgan; bolalar uchun hisoblanmaydi.',
        'ru':
            'Уравнение разработано на участниках 18 лет и старше; у детей '
            'не рассчитывается.',
        'en':
            'The equation was developed in participants aged 18 or older; '
            'it is not calculated for children.',
      }),
      LocalizedText({
        'uz':
            'IDMS bo‘yicha standartlashtirilgan kreatinin qiymatlari uchun '
            'mo‘ljallangan (NKF).',
        'ru':
            'Предназначено для значений креатинина, стандартизованных по '
            'IDMS (NKF).',
        'en': 'Designed for creatinine values standardized to IDMS (NKF).',
      }),
      LocalizedText({
        'uz':
            'G toifasi — faqat KDIGO 2012 tasnifi. Buyrak shikastlanishi '
            'belgilari bo‘lmasa, G1 va G2 surunkali buyrak kasalligi '
            'mezonlariga mos kelmaydi.',
        'ru':
            'Категория G — только классификация KDIGO 2012. Без признаков '
            'повреждения почек G1 и G2 не соответствуют критериям ХБП.',
        'en':
            'The G category is the KDIGO 2012 classification only. Without '
            'evidence of kidney damage, G1 and G2 do not meet the criteria '
            'for CKD.',
      }),
    ],
    refs: const [
      CalcRef(CalcSources.inker2021, 'Table 2; Methods'),
      CalcRef(CalcSources.nkf2021, 'Equation'),
      CalcRef(CalcSources.kdigo2012, 'Table 5'),
    ],
  ),
  ClinicalCalc.acr: CalcInfo(
    formula: const [
      LocalizedText({
        'uz': 'ACR (mg/mmol) = albumin (mg/L) ÷ kreatinin (mmol/L)',
        'ru': 'ACR (мг/ммоль) = альбумин (мг/л) ÷ креатинин (ммоль/л)',
        'en': 'ACR (mg/mmol) = albumin (mg/L) ÷ creatinine (mmol/L)',
      }),
      LocalizedText({
        'uz':
            'ACR (mg/g) = albumin (mg/L) ÷ kreatinin (g/L); 1 mmol = 113.12 mg',
        'ru': 'ACR (мг/г) = альбумин (мг/л) ÷ креатинин (г/л); 1 ммоль = 113,12 мг',
        'en': 'ACR (mg/g) = albumin (mg/L) ÷ creatinine (g/L); 1 mmol = 113.12 mg',
      }),
    ],
    limitations: const [
      LocalizedText({
        'uz':
            'KDIGO chegaralari: A1 < 3 mg/mmol (< 30 mg/g), A2 3–30 '
            '(30–300), A3 > 30 (> 300). Toifa siz kiritgan birlik tizimida '
            'aniqlanadi.',
        'ru':
            'Пороги KDIGO: A1 < 3 мг/ммоль (< 30 мг/г), A2 3–30 (30–300), '
            'A3 > 30 (> 300). Категория определяется в той системе единиц, '
            'в которой вы ввели данные.',
        'en':
            'KDIGO cut-offs: A1 < 3 mg/mmol (< 30 mg/g), A2 3–30 (30–300), '
            'A3 > 30 (> 300). The category is determined in the unit system '
            'you entered.',
      }),
      LocalizedText({
        'uz': 'A toifasi — faqat KDIGO 2012 tasnifi, tashxis emas.',
        'ru': 'Категория A — только классификация KDIGO 2012, не диагноз.',
        'en':
            'The A category is the KDIGO 2012 classification only, not a '
            'diagnosis.',
      }),
    ],
    refs: const [CalcRef(CalcSources.kdigo2012, 'Table 6')],
  ),
  ClinicalCalc.anionGap: CalcInfo(
    formula: [
      _all('AG = Na⁺ − (Cl⁻ + HCO₃⁻)'),
      _all('AG(K) = (Na⁺ + K⁺) − (Cl⁻ + HCO₃⁻)'),
      const LocalizedText({
        'uz': 'AG(alb) = AG + 2.5 × (normal albumin − albumin), g/dL',
        'ru': 'AG(альб) = AG + 2.5 × (нормальный альбумин − альбумин), г/дл',
        'en': 'AG(alb) = AG + 2.5 × (normal albumin − albumin), g/dL',
      }),
    ],
    limitations: const [
      LocalizedText({
        'uz':
            'Ko‘p klinitsistlar kaliyni hisobga olmaydi, shuning uchun '
            'kaliyli qiymat alohida ko‘rsatiladi (Kraut va Madias).',
        'ru':
            'Многие клиницисты не учитывают калий, поэтому значение с калием '
            'показано отдельно (Kraut и Madias).',
        'en':
            'Many clinicians omit potassium, so the value with potassium is '
            'shown separately (Kraut and Madias).',
      }),
      LocalizedText({
        'uz':
            'Figge 1998: albumin har 1 g/dL ga kamayganda anion farq '
            '2.5 mmol/L ga kamayadi. Boshqa tadqiqotlarda bu ko‘rsatkich '
            'taxminan 2.3 yoki 1.5–1.9 mmol/L (Kraut va Madias sharhi).',
        'ru':
            'Figge 1998: на каждый 1 г/дл снижения альбумина анионный '
            'интервал снижается на 2,5 ммоль/л. В других работах — около '
            '2,3 или 1,5–1,9 ммоль/л (обзор Kraut и Madias).',
        'en':
            'Figge 1998: for each 1 g/dL fall in albumin, the anion gap falls '
            'by 2.5 mmol/L. Other studies report about 2.3 or 1.5–1.9 mmol/L '
            '(Kraut and Madias review).',
      }),
      LocalizedText({
        'uz':
            'Figge “normal albumin” qiymatini bermaydi — laboratoriyangiz '
            'qabul qilgan qiymatni kiriting.',
        'ru':
            'Figge не приводит значение «нормального альбумина» — введите '
            'значение, принятое в вашей лаборатории.',
        'en':
            'Figge does not give a “normal albumin” value — enter the value '
            'your laboratory uses.',
      }),
    ],
    refs: const [
      CalcRef(CalcSources.kraut2007, 'Calculation of the anion gap'),
      CalcRef(CalcSources.figge1998, 'Abstract'),
    ],
  ),
  ClinicalCalc.calcium: CalcInfo(
    formula: const [
      LocalizedText({
        'uz': 'Ca(tuzatilgan) = Ca − albumin + 4.0 (Ca mg/dL, albumin g/dL)',
        'ru': 'Ca(скорр.) = Ca − альбумин + 4.0 (Ca мг/дл, альбумин г/дл)',
        'en': 'Ca(adjusted) = Ca − albumin + 4.0 (Ca mg/dL, albumin g/dL)',
      }),
      LocalizedText({
        'uz':
            'SI: Ca mmol/L × 4.0078 → mg/dL (40.078 g/mol); albumin g/L ÷ 10 '
            '→ g/dL; natija yana mmol/L da ko‘rsatiladi.',
        'ru':
            'СИ: Ca ммоль/л × 4,0078 → мг/дл (40,078 г/моль); альбумин г/л '
            '÷ 10 → г/дл; результат снова показывается в ммоль/л.',
        'en':
            'SI: Ca mmol/L × 4.0078 → mg/dL (40.078 g/mol); albumin g/L ÷ 10 '
            '→ g/dL; the result is shown back in mmol/L.',
      }),
    ],
    limitations: const [
      LocalizedText({
        'uz':
            'Payne formulasi bitta laboratoriya namunalarida kalsiyning '
            'albuminga regressiyasidan chiqarilgan.',
        'ru':
            'Формула Payne выведена из регрессии кальция на альбумин по '
            'образцам одной лаборатории.',
        'en':
            'The Payne formula was derived from the regression of calcium on '
            'albumin in one laboratory’s specimens.',
      }),
      LocalizedText({
        'uz':
            'Boshqa kalkulyatorlarda 0.8 koeffitsiyentli variant ham '
            'uchraydi; bu yerda Payne 1973 maqolasidagi formula ishlatilgan, '
            'shuning uchun natijalar farq qilishi mumkin.',
        'ru':
            'В других калькуляторах встречается вариант с коэффициентом 0,8; '
            'здесь использована формула из статьи Payne 1973, поэтому '
            'результаты могут различаться.',
        'en':
            'Other calculators may use a variant with a 0.8 coefficient; this '
            'one uses the formula from the Payne 1973 paper, so results can '
            'differ.',
      }),
    ],
    refs: const [CalcRef(CalcSources.payne1973, 'Abstract')],
  ),
  ClinicalCalc.ldl: CalcInfo(
    formula: const [
      LocalizedText({
        'uz': 'non-HDL = UX − HDL',
        'ru': 'ХС не-ЛПВП = ОХС − ХС ЛПВП',
        'en': 'non-HDL = TC − HDL',
      }),
      LocalizedText({
        'uz': 'Friedewald: LDL = UX − HDL − TG/5 (mg/dL)',
        'ru': 'Фридевальд: ХС ЛПНП = ОХС − ХС ЛПВП − ТГ/5 (мг/дл)',
        'en': 'Friedewald: LDL = TC − HDL − TG/5 (mg/dL)',
      }),
      LocalizedText({
        'uz':
            'Sampson: LDL = UX/0.948 − HDL/0.971 − (TG/8.56 + TG × '
            'non-HDL/2140 − TG²/16100) − 9.44 (mg/dL)',
        'ru':
            'Сэмпсон: ХС ЛПНП = ОХС/0.948 − ХС ЛПВП/0.971 − (ТГ/8.56 + ТГ × '
            'ХС не-ЛПВП/2140 − ТГ²/16100) − 9.44 (мг/дл)',
        'en':
            'Sampson: LDL = TC/0.948 − HDL/0.971 − (TG/8.56 + TG × '
            'non-HDL/2140 − TG²/16100) − 9.44 (mg/dL)',
      }),
      LocalizedText({
        'uz':
            'UX — umumiy xolesterin. mmol/L: xolesterin × 38.666, TG × 88.545 '
            '→ mg/dL (386.66 va triolein 885.45 g/mol); natija yana mmol/L da.',
        'ru':
            'ОХС — общий холестерин. ммоль/л: холестерин × 38,666, ТГ × '
            '88,545 → мг/дл (386,66 и триолеин 885,45 г/моль); результат '
            'снова в ммоль/л.',
        'en':
            'TC — total cholesterol. mmol/L: cholesterol × 38.666, TG × '
            '88.545 → mg/dL (386.66 and triolein 885.45 g/mol); the result '
            'is shown back in mmol/L.',
      }),
    ],
    limitations: const [
      LocalizedText({
        'uz':
            'Friedewald: xilomikronli namunalarda qo‘llanmaydi; III tip '
            'giperlipoproteinemiyada noto‘g‘ri yuqori natija beradi; TG '
            '400 mg/dL (≈ 4.5 mmol/L) dan oshsa ishonchli emas.',
        'ru':
            'Фридевальд: не применим к образцам с хиломикронами; при '
            'гиперлипопротеинемии III типа даёт ошибочно высокий результат; '
            'при ТГ выше 400 мг/дл (≈ 4,5 ммоль/л) ненадёжен.',
        'en':
            'Friedewald: not applicable to samples containing chylomicrons; '
            'erroneously high in type III hyperlipoproteinaemia; not reliable '
            'when TG exceeds 400 mg/dL (≈ 4.5 mmol/L).',
      }),
      LocalizedText({
        'uz':
            'NCEP ATP III: Friedewald hisobi och qoringa olingan namunani '
            'talab qiladi.',
        'ru': 'NCEP ATP III: расчёт по Фридевальду требует образца натощак.',
        'en':
            'NCEP ATP III: the Friedewald estimate requires a fasting '
            'sample.',
      }),
      LocalizedText({
        'uz':
            'Sampson: TG 800 mg/dL (≈ 9.0 mmol/L) gacha tekshirilgan; III tip '
            'giperlipidemiyali bemorlar tadqiqotga kiritilmagan.',
        'ru':
            'Сэмпсон: проверено при ТГ до 800 мг/дл (≈ 9,0 ммоль/л); пациенты '
            'с гиперлипидемией III типа в исследование не включались.',
        'en':
            'Sampson: validated for TG up to 800 mg/dL (≈ 9.0 mmol/L); '
            'patients with type III hyperlipidaemia were excluded.',
      }),
    ],
    refs: const [
      CalcRef(CalcSources.friedewald1972, 'Results; Discussion'),
      CalcRef(CalcSources.sampson2020, 'Equation 2; Conclusions'),
      CalcRef(CalcSources.atp3, 'Section III.2.b'),
    ],
  ),
  ClinicalCalc.osmolality: CalcInfo(
    formula: const [
      LocalizedText({
        'uz': 'mg/dL: 2 × Na + glyukoza/18 + BUN/2.8',
        'ru': 'мг/дл: 2 × Na + глюкоза/18 + АМК/2.8',
        'en': 'mg/dL: 2 × Na + glucose/18 + BUN/2.8',
      }),
      LocalizedText({
        'uz': 'mmol/L: 2 × Na + glyukoza + mochevina',
        'ru': 'ммоль/л: 2 × Na + глюкоза + мочевина',
        'en': 'mmol/L: 2 × Na + glucose + urea',
      }),
      LocalizedText({
        'uz': 'Osmolyal farq = o‘lchangan − hisoblangan',
        'ru': 'Осмоляльный зазор = измеренная − расчётная',
        'en': 'Osmolal gap = measured − calculated',
      }),
    ],
    limitations: const [
      LocalizedText({
        'uz':
            'Rasouli 2016 bu formulani plazma osmolyalligini hisoblashning '
            'eng oddiy va eng yaxshi formulasi deb baholaydi; boshqa '
            'formulalar boshqacha natija beradi.',
        'ru':
            'Rasouli 2016 оценивает эту формулу как самую простую и лучшую '
            'для расчёта осмоляльности плазмы; другие формулы дают иные '
            'результаты.',
        'en':
            'Rasouli 2016 rates this as the simplest and best formula for '
            'calculating plasma osmolality; other formulas give different '
            'results.',
      }),
      LocalizedText({
        'uz':
            'Bu hisobda etanol hadi yo‘q (Lynd 2008 formulasida etanol '
            'alohida qo‘shiladi).',
        'ru':
            'В этом расчёте нет слагаемого для этанола (в формуле Lynd 2008 '
            'этанол добавляется отдельно).',
        'en':
            'This calculation has no ethanol term (the Lynd 2008 formula '
            'adds ethanol separately).',
      }),
    ],
    refs: const [
      CalcRef(CalcSources.rasouli2016, 'Abstract'),
      CalcRef(CalcSources.lynd2008, 'Table 1'),
    ],
  ),
  ClinicalCalc.hba1c: CalcInfo(
    formula: [
      _all('NGSP (%) = 0.09148 × IFCC (mmol/mol) + 2.152'),
      _all('eAG (mg/dL) = 28.7 × A1C − 46.7'),
      _all('eAG (mmol/L) = 1.5944 × A1C − 2.594'),
    ],
    limitations: const [
      LocalizedText({
        'uz':
            'ADAG: glikemiyasi barqaror 1 va 2-tip diabetli hamda diabetsiz '
            'kattalar. Anemiya, gemoglobinopatiyalar, eritrotsitlar '
            'almashinuvi yuqoriligi, surunkali buyrak yoki jigar kasalligi '
            'istisno qilingan; bolalar va homiladorlar o‘rganilmagan.',
        'ru':
            'ADAG: взрослые с СД 1 и 2 типа и без диабета со стабильной '
            'гликемией. Исключались анемия, гемоглобинопатии, повышенный '
            'обмен эритроцитов, хронические болезни почек или печени; дети '
            'и беременные не изучались.',
        'en':
            'ADAG: adults with type 1 or type 2 diabetes and without '
            'diabetes, with stable glycaemia. Anaemia, haemoglobinopathies, '
            'high red-cell turnover and chronic kidney or liver disease were '
            'exclusions; children and pregnant women were not studied.',
      }),
      LocalizedText({
        'uz':
            'eAG — baho: bashorat xatosining standart chetlanishi 15.7 mg/dL '
            '(0.87 mmol/L).',
        'ru':
            'eAG — оценка: стандартное отклонение ошибки прогноза 15,7 мг/дл '
            '(0,87 ммоль/л).',
        'en':
            'eAG is an estimate: the standard deviation of the prediction '
            'error was 15.7 mg/dL (0.87 mmol/L).',
      }),
      LocalizedText({
        'uz':
            'eAG faqat A1C 4–12 % oralig‘ida hisoblanadi: ADAG regressiyasi '
            'va 2-jadvali shu oraliqqa tayanadi.',
        'ru':
            'eAG рассчитывается только для A1C 4–12 %: на этот диапазон '
            'опираются регрессия и таблица 2 ADAG.',
        'en':
            'eAG is calculated only for A1C 4–12 %: the ADAG regression and '
            'Table 2 rest on this range.',
      }),
    ],
    refs: const [
      CalcRef(CalcSources.ngsp, 'Master equation'),
      CalcRef(CalcSources.nathan2008, 'Results; Table 2; Methods'),
    ],
  ),
};
