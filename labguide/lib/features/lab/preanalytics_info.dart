/// Preanalitika: probirkalar tartibi va qon olishdagi asosiy qoidalar.
/// Manba: WHO guidelines on drawing blood: best practices in phlebotomy.
/// WHO, 2010 (ISBN 978 92 4 159922 1) — to'liq matn o'qib tekshirildi;
/// © WHO 2010, all rights reserved — jadval ko'chirilmagan, faktlar o'z
/// so'zlarimiz bilan, joyi ko'rsatilgan (docs/DECISIONS.md, D-23).
library;

import 'package:material_ui/material_ui.dart';

import '../content/content_model.dart';

class DrawTube {
  const DrawTube({
    required this.name,
    required this.cap,
    required this.colors,
    this.note,
  });

  final LocalizedText name;

  /// Odatdagi qopqoq rangi (manbadagidek) — matn bilan ham beriladi.
  final LocalizedText cap;

  /// Rang belgisi uchun (bitta yoki ikkita — chiziqli/aralash qopqoq).
  /// Bo'sh — manbada rang ko'rsatilmagan.
  final List<Color> colors;
  final LocalizedText? note;
}

/// WHO 2010, 2.2.3 (8-qadam) va 2.3-jadval: plastik vakuum probirkalar
/// uchun tavsiya etilgan tartib (NCCLS 2003 konsensusi asosida).
const drawOrder = <DrawTube>[
  DrawTube(
    name: LocalizedText({
      'uz': 'Gemokultura (qon ekish) flakoni',
      'ru': 'Флакон для гемокультуры',
      'en': 'Blood culture bottle',
    }),
    cap: LocalizedText({
      'uz': 'sariq-qora chiziqli',
      'ru': 'жёлто-чёрный полосатый',
      'en': 'yellow-black striped',
    }),
    colors: [Color(0xFFE8C21A), Color(0xFF222222)],
    note: LocalizedText({
      'uz': 'Ozuqa muhiti (bulyon)',
      'ru': 'Питательная среда (бульон)',
      'en': 'Broth mixture',
    }),
  ),
  DrawTube(
    name: LocalizedText({
      'uz': 'Qo‘shimchasiz probirka',
      'ru': 'Пробирка без добавок',
      'en': 'Non-additive tube',
    }),
    cap: LocalizedText({
      'uz': 'rang ko‘rsatilmagan',
      'ru': 'цвет не указан',
      'en': 'color not specified',
    }),
    colors: [],
  ),
  DrawTube(
    name: LocalizedText({
      'uz': 'Koagulyatsiya probirkasi — natriy sitrat',
      'ru': 'Коагулологическая пробирка — цитрат натрия',
      'en': 'Coagulation tube — sodium citrate',
    }),
    cap: LocalizedText({'uz': 'och ko‘k', 'ru': 'голубая', 'en': 'light blue'}),
    colors: [Color(0xFF8EC9F0)],
    note: LocalizedText({
      'uz': 'To‘liq to‘ldirilishi shart',
      'ru': 'Требуется полное заполнение',
      'en': 'Requires a full draw',
    }),
  ),
  DrawTube(
    name: LocalizedText({
      'uz': 'Ivish faollashtiruvchisi bilan (zardob)',
      'ru': 'С активатором свёртывания (сыворотка)',
      'en': 'Clot activator (serum)',
    }),
    cap: LocalizedText({'uz': 'qizil', 'ru': 'красная', 'en': 'red'}),
    colors: [Color(0xFFD6403A)],
  ),
  DrawTube(
    name: LocalizedText({
      'uz': 'Zardob ajratuvchi probirka (gel bilan)',
      'ru': 'Пробирка с разделительным гелем (сыворотка)',
      'en': 'Serum separator tube (gel)',
    }),
    cap: LocalizedText({
      'uz': 'qizil-kulrang (“yo‘lbars”) yoki tilla rang',
      'ru': 'красно-серая («тигровая») или золотистая',
      'en': 'red-grey (“tiger”) or gold',
    }),
    colors: [Color(0xFFD6403A), Color(0xFFE3B23C)],
    note: LocalizedText({
      'uz': 'Tubida gel bor',
      'ru': 'Гель на дне',
      'en': 'Gel at the bottom',
    }),
  ),
  DrawTube(
    name: LocalizedText({
      'uz': 'Geparin (natriy yoki litiy geparin)',
      'ru': 'Гепарин (натрия или лития гепарин)',
      'en': 'Heparin (sodium or lithium heparin)',
    }),
    cap: LocalizedText({
      'uz': 'to‘q yashil',
      'ru': 'тёмно-зелёная',
      'en': 'dark green',
    }),
    colors: [Color(0xFF1E6B45)],
  ),
  DrawTube(
    name: LocalizedText({
      'uz': 'Plazma ajratuvchi (PST): litiy geparin + gel',
      'ru': 'Пробирка PST: лития гепарин + гель',
      'en': 'PST: lithium heparin + gel separator',
    }),
    cap: LocalizedText({
      'uz': 'och yashil',
      'ru': 'светло-зелёная',
      'en': 'light green',
    }),
    colors: [Color(0xFF8BC98A)],
  ),
  DrawTube(
    name: LocalizedText({'uz': 'EDTA', 'ru': 'ЭДТА', 'en': 'EDTA'}),
    cap: LocalizedText({'uz': 'binafsha', 'ru': 'фиолетовая', 'en': 'purple'}),
    colors: [Color(0xFF7B4BA3)],
    note: LocalizedText({
      'uz':
          'Gematologiya, qon banki (moslik sinovi); to‘liq to‘ldirilishi shart',
      'ru':
          'Гематология, банк крови (проба на совместимость); полное заполнение',
      'en': 'Haematology, blood bank (cross-match); requires a full draw',
    }),
  ),
  DrawTube(
    name: LocalizedText({
      'uz': 'ACD (kislotali sitrat-dekstroza)',
      'ru': 'ACD (кислый цитрат-декстроза)',
      'en': 'ACD (acid-citrate-dextrose)',
    }),
    cap: LocalizedText({
      'uz': 'och sariq',
      'ru': 'бледно-жёлтая',
      'en': 'pale yellow',
    }),
    colors: [Color(0xFFF3E58A)],
  ),
  DrawTube(
    name: LocalizedText({
      'uz': 'Natriy ftorid + kaliy oksalat',
      'ru': 'Фторид натрия + оксалат калия',
      'en': 'Sodium fluoride + potassium oxalate',
    }),
    cap: LocalizedText({
      'uz': 'och kulrang',
      'ru': 'светло-серая',
      'en': 'light grey',
    }),
    colors: [Color(0xFFC7CCD1)],
    note: LocalizedText({
      'uz': 'To‘liq to‘ldirilishi shart (kam to‘ldirilsa gemoliz bo‘lishi mumkin)',
      'ru': 'Полное заполнение (при недоборе возможен гемолиз)',
      'en': 'Requires a full draw (a short draw may cause hemolysis)',
    }),
  ),
];

/// 2.3-jadval izohlari va kapillyar tartib (7.1.3).
const drawOrderNotes = <LocalizedText>[
  LocalizedText({
    'uz':
        'Qopqoq ranglari va qo‘shimchalar ishlab chiqaruvchiga qarab farq '
        'qiladi — tartibni laboratoriyangiz bilan tekshiring.',
    'ru':
        'Цвета крышек и добавки различаются у производителей — сверяйте '
        'порядок с вашей лабораторией.',
    'en':
        'Cap colors and additives vary by manufacturer — confirm the order '
        'with your laboratory.',
  }),
  LocalizedText({
    'uz':
        'Qo‘shimchali probirkalarni yumshoq aylantirib aralashtiring: qon '
        'qo‘shimcha bilan yaxshi aralashmasa, natija noto‘g‘ri bo‘lishi '
        'mumkin. Aylantirishlar soni — laboratoriya ko‘rsatmasiga ko‘ra.',
    'ru':
        'Пробирки с добавками аккуратно переворачивайте: при плохом '
        'смешивании крови с добавкой результат может быть ошибочным. Число '
        'переворотов — по указанию лаборатории.',
    'en':
        'Gently invert tubes with additives: poor mixing with the additive '
        'can give erroneous results. The number of inversions follows your '
        'laboratory’s instruction.',
  }),
  LocalizedText({
    'uz':
        'Faqat oddiy koagulyatsiya tahlili buyurilgan bo‘lsa, bitta och ko‘k '
        'probirka olinishi mumkin; to‘qima suyuqligi bilan ifloslanish '
        'xavotiri bo‘lsa, undan oldin qo‘shimchasiz probirka olinadi.',
    'ru':
        'Если назначена только рутинная коагулограмма, можно взять одну '
        'голубую пробирку; при опасении загрязнения тканевой жидкостью перед '
        'ней берут пробирку без добавок.',
    'en':
        'If a routine coagulation assay is the only test, a single light-blue '
        'tube may be drawn; if tissue-fluid contamination is a concern, draw a '
        'non-additive tube before it.',
  }),
  LocalizedText({
    'uz':
        'Kapillyar (barmoq/tovon) qon olishda tartib teskari: avval '
        'gematologiya, so‘ng biokimyo va qon banki namunalari.',
    'ru':
        'При капиллярном взятии порядок обратный: сначала гематология, затем '
        'биохимия и банк крови.',
    'en':
        'For capillary (skin-puncture) sampling the order is reversed: '
        'hematology first, then chemistry and blood bank.',
  }),
];

/// 1.1.1: gemolizga olib keluvchi omillar.
const haemolysisCauses = <LocalizedText>[
  LocalizedText({
    'uz': 'Juda ingichka (23G va undan ingichka) yoki tomirga nisbatan juda yo‘g‘on igna',
    'ru': 'Слишком тонкая (23G и тоньше) или слишком толстая для вены игла',
    'en': 'A needle too fine (23 gauge or smaller) or too large for the vessel',
  }),
  LocalizedText({
    'uz': 'Shprits porshenini bosib, qonni probirkaga majburan haydash',
    'ru': 'Выдавливание крови из шприца в пробирку нажатием на поршень',
    'en': 'Forcing blood from a syringe into the tube with the plunger',
  }),
  LocalizedText({
    'uz': 'Vena ichidagi yoki markaziy kateterdan qon olish',
    'ru': 'Взятие крови из внутривенного или центрального катетера',
    'en': 'Drawing from an intravenous or central line',
  }),
  LocalizedText({
    'uz':
        'Probirkani kam to‘ldirish (antikoagulyant:qon nisbati 1:9 dan katta)',
    'ru':
        'Недозаполнение пробирки (соотношение антикоагулянт:кровь больше 1:9)',
    'en': 'Underfilling a tube (anticoagulant-to-blood ratio above 1:9)',
  }),
  LocalizedText({
    'uz': 'Qo‘lda qayta to‘ldirilgan probirkalarni qayta ishlatish',
    'ru': 'Повторное использование пробирок, заполненных вручную',
    'en': 'Reusing tubes that were refilled by hand',
  }),
  LocalizedText({
    'uz': 'Probirkani juda qattiq chayqatish',
    'ru': 'Слишком интенсивное перемешивание пробирки',
    'en': 'Mixing a tube too vigorously',
  }),
  LocalizedText({
    'uz': 'Spirt yoki dezinfektant qurimasidan punksiya qilish',
    'ru': 'Пункция до высыхания спирта или антисептика',
    'en': 'Not letting alcohol or disinfectant dry',
  }),
  LocalizedText({
    'uz': 'Juda kuchli vakuum',
    'ru': 'Слишком сильный вакуум',
    'en': 'Too great a vacuum',
  }),
];

/// 2.2.3 (3, 6-qadamlar): jgut.
const tourniquetRules = <LocalizedText>[
  LocalizedText({
    'uz': 'Jgut punksiya joyidan taxminan 4–5 barmoq eni yuqoriga qo‘yiladi.',
    'ru': 'Жгут накладывают примерно на 4–5 пальцев выше места пункции.',
    'en': 'Apply the tourniquet about 4–5 finger widths above the site.',
  }),
  LocalizedText({
    'uz':
        'Jgut ignani chiqarishdan OLDIN bo‘shatiladi; ba’zi qo‘llanmalar uni '
        'qon oqimi boshlanishi bilan va har holda 2 daqiqa bo‘lmasidan oldin '
        'olishni tavsiya qiladi.',
    'ru':
        'Жгут снимают ДО извлечения иглы; некоторые руководства советуют '
        'снимать его, как только пошла кровь, и всегда раньше 2 минут.',
    'en':
        'Release the tourniquet BEFORE withdrawing the needle; some guidelines '
        'suggest removing it as soon as blood flows, and always before 2 '
        'minutes.',
  }),
];

/// 2.2.3 (2, 9-qadamlar): bemorni aniqlash va yorliq.
const identificationRules = <LocalizedText>[
  LocalizedText({
    'uz':
        'Bemordan to‘liq ismini aytishni so‘rang va yo‘llanma uning shaxsiga '
        'mosligini tekshiring.',
    'ru':
        'Попросите пациента назвать полное имя и проверьте, что направление '
        'соответствует его личности.',
    'en':
        'Ask the patient to state their full name and check that the request '
        'form matches their identity.',
  }),
  LocalizedText({
    'uz':
        'Yorliqda odatda: ism va familiya, tibbiy karta raqami, tug‘ilgan sana, '
        'qon olingan sana va vaqt.',
    'ru':
        'На этикетке обычно: имя и фамилия, номер карты, дата рождения, дата и '
        'время взятия крови.',
    'en':
        'Labels typically carry first and last names, file number, date of '
        'birth, and the date and time of collection.',
  }),
  LocalizedText({
    'uz': 'Jo‘natishdan oldin probirka yorliqlari va yo‘llanmalarni qayta tekshiring.',
    'ru': 'Перед отправкой ещё раз сверьте этикетки пробирок и направления.',
    'en': 'Recheck tube labels and forms before dispatch.',
  }),
];
