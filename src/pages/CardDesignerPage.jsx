import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../lib/i18n.jsx';

// Jismoniy NFC karta uchun bosma dizayn generatori — matn, rang, fon
// (teri rangi yoki o'z rasmi) va logotipni tanlab, old/orqa tomonni
// canvas'da chizib, PNG holida yuklab olish imkonini beradi.
// Asl mustaqil HTML/JS versiyasidan React'ga o'tkazilgan: chizish
// mantig'i (drawEmbossText, drawNfcIcon va h.k.) sof funksiyalar
// sifatida saqlangan, faqat holat React state'ga ko'chirilgan.

const FONT_OPTIONS = [
  { value: 'Arial', label: "Zamonaviy (Arial)" },
  { value: 'Georgia', label: 'Klassik (Georgia)' },
  { value: "'Courier New'", label: 'Texnik (Courier)' },
  { value: "'Trebuchet MS'", label: 'Yengil (Trebuchet)' },
];

// Eslatma: logotip/QR pozitsiyasi endi oldindan belgilangan variantlar
// emas — sichqoncha bilan sudrab, canvas ichida istalgan joyga qo'yiladi.

// Yozuv rangi palitralari — gradient uch nuqtali (top/mid/bot) yoki
// "mixed" uchun ko'p bosqichli chiziqli gradient.
const TEXT_COLORS = {
  gold: { top: '#fdf3d0', mid: '#e8c46b', bot: '#8a6a1f', shadow: 'rgba(0,0,0,.7)' },
  silver: { top: '#ffffff', mid: '#d6d6d6', bot: '#7a7a7a', shadow: 'rgba(0,0,0,.7)' },
  rose: { top: '#ffe3c2', mid: '#e6a468', bot: '#8a4e22', shadow: 'rgba(0,0,0,.7)' },
  white: { top: '#ffffff', mid: '#f0f0f0', bot: '#b8b8b8', shadow: 'rgba(0,0,0,.6)' },
  redgold: { top: '#ffd27a', mid: '#e0563f', bot: '#7a1f14', shadow: 'rgba(0,0,0,.7)' },
  black: { top: '#3a3a3a', mid: '#1a1a1a', bot: '#000000', shadow: 'rgba(255,255,255,.08)' },
  emerald: { top: '#c9f7e0', mid: '#4fcf9a', bot: '#1f6b48', shadow: 'rgba(0,0,0,.7)' },
  sapphire: { top: '#dceeff', mid: '#6fa8e8', bot: '#2a4f8a', shadow: 'rgba(0,0,0,.7)' },
  mixed: { stops: [[0, '#ffd27a'], [0.35, '#ff6b9d'], [0.7, '#8a6bff'], [1, '#6bd6ff']], shadow: 'rgba(0,0,0,.7)' },
};

// Swatch tugmalarida ko'rinadigan chip ranglari (Uzbek nomlar bilan) —
// haqiqiy render gradientidan mustaqil, faqat tanlov uchun ko'rgazma.
const TEXT_SWATCHES = [
  { id: 'gold', label: 'Oltin', css: 'linear-gradient(135deg,#f8e8b0,#c9a24b)' },
  { id: 'silver', label: 'Kumush', css: 'linear-gradient(135deg,#f2f2f2,#b8b8b8)' },
  { id: 'rose', label: "Pushti-tilla", css: 'linear-gradient(135deg,#f7c98a,#c97b3f)' },
  { id: 'white', label: 'Oq', css: '#ffffff' },
  { id: 'redgold', label: "Qizil-tilla", css: 'linear-gradient(135deg,#ff6b5b,#c9a24b)' },
  { id: 'black', label: 'Qora', css: 'linear-gradient(135deg,#3a3a3a,#111)' },
  { id: 'emerald', label: "Zumrad-yashil", css: 'linear-gradient(135deg,#7ee8c1,#2f9e6b)' },
  { id: 'sapphire', label: "Ko'k-kumush", css: 'linear-gradient(135deg,#9fd0ff,#3f6fc9)' },
  { id: 'mixed', label: 'Aralash rangdor', css: 'linear-gradient(120deg,#ffd27a,#ff6b9d,#8a6bff,#6bd6ff)' },
];

// Fon (teri) rang juftliklari — radial gradient uchun a/b, "mixed" uchun stops.
const BG_COLORS = {
  black: { a: '#1c1c1e', b: '#050505' },
  navy: { a: '#2c3a4d', b: '#0a1017' },
  brown: { a: '#4a2f1e', b: '#150c07' },
  carbon: { a: '#232323', b: '#050505' },
  red: { a: '#6b1f1f', b: '#1a0505' },
  gold: { a: '#5c4a1a', b: '#1a1405' },
  white: { a: '#e8e3d5', b: '#a8a290' },
  green: { a: '#1f5c3d', b: '#051a10' },
  purple: { a: '#5a2a7a', b: '#180820' },
  mixed: { stops: [[0, '#2b0f3a'], [0.5, '#8a1f4f'], [1, '#c9701f']] },
};

const BG_SWATCHES = [
  { id: 'black', label: 'Qora', css: '#101012' },
  { id: 'navy', label: "Ko'k-qora", css: '#1c2430' },
  { id: 'brown', label: 'Jigar', css: '#2b1a12' },
  { id: 'carbon', label: 'Karbon', css: '#141414', ring: true },
  { id: 'red', label: 'Qizil', css: '#4a1010' },
  { id: 'gold', label: 'Tilla', css: '#4a3a10' },
  { id: 'white', label: "Oq teri", css: '#d8d3c4' },
  { id: 'green', label: "Zumrad-yashil", css: '#142218' },
  { id: 'purple', label: 'Binafsha', css: '#241033' },
  { id: 'mixed', label: 'Aralash gradient', css: 'linear-gradient(135deg,#2b0f3a,#8a1f4f,#c9701f)' },
];

// --- Sof canvas chizish yordamchilari (React holatidan mustaqil) ---

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawLeatherTexture(ctx, w, h) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    d[i] = Math.min(255, Math.max(0, d[i] + n));
    d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n));
    d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n));
  }
  ctx.putImageData(imgData, 0, 0);
}

function drawCoverImage(ctx, img, x, y, w, h) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx, sy, sw, sh;
  if (imgRatio > boxRatio) {
    sh = img.height;
    sw = sh * boxRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / boxRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function makeTextGradient(ctx, cx, cy, size, colorSet, w) {
  if (colorSet.stops) {
    const grad = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
    colorSet.stops.forEach(([pos, color]) => grad.addColorStop(pos, color));
    return grad;
  }
  const grad = ctx.createLinearGradient(cx, cy - size / 2, cx, cy + size / 2);
  grad.addColorStop(0, colorSet.top);
  grad.addColorStop(0.5, colorSet.mid);
  grad.addColorStop(1, colorSet.bot);
  return grad;
}

function drawEmbossText(ctx, text, cx, cy, size, colorSet, font) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${size}px ${font}, sans-serif`;
  const textWidth = ctx.measureText(text).width;

  ctx.fillStyle = colorSet.shadow;
  ctx.fillText(text, cx - 2, cy + 3);

  ctx.fillStyle = makeTextGradient(ctx, cx, cy, size, colorSet, textWidth);
  ctx.fillText(text, cx, cy);

  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 0.6;
  ctx.strokeText(text, cx, cy - 1);

  ctx.restore();
  return textWidth;
}

function drawSubText(ctx, text, cx, cy, colorSet, font) {
  if (!text) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const size = 30;
  ctx.font = `500 ${size}px ${font}, sans-serif`;
  const textWidth = ctx.measureText(text).width;

  ctx.fillStyle = colorSet.shadow;
  ctx.fillText(text, cx - 1, cy + 2);

  ctx.fillStyle = makeTextGradient(ctx, cx, cy, size, colorSet, textWidth);
  ctx.globalAlpha = 0.9;
  ctx.fillText(text, cx, cy);

  ctx.restore();
}

function drawNfcIcon(ctx, cx, cy, scale, colorSet) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  const grad = ctx.createLinearGradient(0, -20, 0, 20);
  grad.addColorStop(0, colorSet.top);
  grad.addColorStop(1, colorSet.bot);
  ctx.strokeStyle = grad;
  ctx.fillStyle = grad;
  ctx.lineCap = 'round';

  ctx.font = '700 26px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', -14, 2);

  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(4, 2, 10 + i * 9, -0.7, 0.7);
    ctx.stroke();
  }
  ctx.restore();
}

// Logotip yoki QR-kodni berilgan NISBIY (0..1) koordinatada chizadi —
// bu koordinata endi oldindan belgilangan pozitsiyalar (pastda-markazda
// va h.k.) o'rniga TO'G'RIDAN-TO'G'RI sichqoncha bilan sudrab
// o'zgartiriladi (pastga qarang: onCanvasPointerDown/Move/Up).
function drawPositionedImage(ctx, w, h, image, xy, targetH) {
  if (!image || !xy) return null;
  const targetW = targetH * (image.width / image.height);
  const x = xy.x * w - targetW / 2;
  const y = xy.y * h - targetH / 2;
  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.drawImage(image, x, y, targetW, targetH);
  ctx.restore();
  // Keyinchalik "bosilganmi" tekshirish (drag) uchun hitbox qaytaramiz.
  return { x, y, w: targetW, h: targetH };
}

// To'liq render — bitta tomonni (state.side) canvas'ga chizadi.
function renderCard(ctx, w, h, state) {
  ctx.clearRect(0, 0, w, h);
  const colorSet = TEXT_COLORS[state.textColor];

  roundRectPath(ctx, 0, 0, w, h, 42);
  ctx.save();
  ctx.clip();

  if (state.bgMode === 'image' && state.bgImage) {
    drawCoverImage(ctx, state.bgImage, 0, 0, w, h);
    ctx.fillStyle = `rgba(0,0,0,${state.darken / 100})`;
    ctx.fillRect(0, 0, w, h);
  } else {
    const bg = BG_COLORS[state.bgColor];
    let grad;
    if (bg.stops) {
      grad = ctx.createLinearGradient(0, 0, w, h);
      bg.stops.forEach(([pos, color]) => grad.addColorStop(pos, color));
    } else {
      grad = ctx.createRadialGradient(w * 0.35, h * 0.25, 50, w * 0.5, h * 0.5, w * 0.8);
      grad.addColorStop(0, bg.a);
      grad.addColorStop(1, bg.b);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    drawLeatherTexture(ctx, w, h);
  }

  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, w * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  ctx.restore();

  ctx.save();
  roundRectPath(ctx, 6, 6, w - 12, h - 12, 38);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  const text = state.side === 'front' ? state.frontText : state.backText;
  const subText = state.side === 'front' ? state.frontSubText : state.backSubText;
  let fontSize = state.fontSize;
  if (text.length > 10) fontSize = Math.min(fontSize, fontSize * (10 / text.length) * 1.3);

  // Matn markazi endi qattiq belgilangan emas — sichqoncha bilan
  // sudraladigan state.textXY (nisbiy 0..1) orqali boshqariladi.
  const textXY = state.textXY || { x: 0.5, y: 0.5 };
  const cx = textXY.x * w;
  const mainY = subText ? textXY.y * h - 24 : textXY.y * h;
  const mainWidth = drawEmbossText(ctx, (text || ' ').toUpperCase(), cx, mainY, fontSize, colorSet, state.font);

  if (subText) {
    drawSubText(ctx, subText, cx, mainY + fontSize / 2 + 30, colorSet, state.font);
  }

  if (state.side === 'back' && state.showNfc) {
    drawNfcIcon(ctx, w / 2, h / 2 + 150, 1.8, colorSet);
  }

  // Hitbox'lar — drag qilish uchun (qaysi elementga sichqoncha bosilgani).
  const hitboxes = {};
  hitboxes.logo = drawPositionedImage(ctx, w, h, state.logoImage, state.logoXY, state.logoSize || 70);
  // MUHIM: QR-kod faqat ORQA tomonda ko'rsatiladi (old tomonda hech qachon).
  if (state.showQr && state.side === 'back') {
    hitboxes.qr = drawPositionedImage(ctx, w, h, state.qrImage, state.qrXY, state.qrSize || 150);
  }

  // ORQA tomondagi o'zgarmas "nfcstore.uz" yozuvi.
  if (state.side === 'back') {
    const wm = state.wmXY || { x: 0.5, y: 0.9 };
    const wmSize = state.wmSize || 26;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${wmSize}px ${state.font}, sans-serif`;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText('nfcstore.uz', wm.x * w - 1, wm.y * h + 2);
    ctx.fillStyle = state.wmColor || '#ffffff';
    ctx.fillText('nfcstore.uz', wm.x * w, wm.y * h);
    const wmW = ctx.measureText('nfcstore.uz').width;
    ctx.restore();
    hitboxes.wm = { x: wm.x * w - wmW / 2 - 14, y: wm.y * h - wmSize / 2 - 12, w: wmW + 28, h: wmSize + 24 };
  }
  // Matn uchun taxminiy hitbox (o'lchangan kenglik asosida).
  hitboxes.text = { x: cx - mainWidth / 2 - 14, y: mainY - fontSize / 2 - 14, w: mainWidth + 28, h: fontSize + 28 };
  return hitboxes;
}

function loadImageFromFile(file, onLoaded) {
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => onLoaded(img);
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function ToggleGroup({ options, value, onChange }) {
  const { t } = useLanguage();
  return (
    <div className="flex gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-lg border px-3 py-2.5 text-center text-xs font-semibold transition-colors ${
            value === opt.value
              ? 'border-accent/60 bg-accent/10 text-accent'
              : 'border-white/10 bg-base-100 text-base-content/50 hover:text-base-content/80'
          }`}
        >
          {t(opt.label)}
        </button>
      ))}
    </div>
  );
}

function SwatchRow({ items, value, onChange }) {
  const { t } = useLanguage();
  return (
    <div className="mt-2 flex flex-wrap gap-2.5">
      {items.map((s) => (
        <button
          key={s.id}
          type="button"
          title={t(s.label)}
          onClick={() => onChange(s.id)}
          className={`h-7 w-7 shrink-0 rounded-full transition-shadow ${
            value === s.id ? 'ring-2 ring-white ring-offset-2 ring-offset-base-200' : ''
          } ${s.ring ? 'ring-1 ring-white/30' : ''}`}
          style={{ background: s.css }}
        />
      ))}
    </div>
  );
}

function Label({ children }) {
  return <label className="mb-1.5 block text-[14px] font-semibold uppercase tracking-wider text-base-content/45">{children}</label>;
}

function FieldGroup({ title, children }) {
  return (
    <div className="mt-6 border-t border-white/10 pt-5 first:mt-0 first:border-t-0 first:pt-0">
      <div className="mb-3 text-xs font-bold uppercase tracking-widest text-accent">{title}</div>
      {children}
    </div>
  );
}

export default function CardDesignerPage({ embedded = false, code = '' } = {}) {
  const { t } = useLanguage();
  const canvasRef = useRef(null);
  const bgFileRef = useRef(null);
  const logoFileRef = useRef(null);
  const hitboxesRef = useRef({});
  const dragRef = useRef(null); // 'logo' | 'qr' | null — hozir qaysi element sudralyapti

  const [side, setSide] = useState('front');
  const [frontText, setFrontText] = useState(code || 'VIP001');
  const [frontSubText, setFrontSubText] = useState('');
  const [backText, setBackText] = useState('NFCSTORE.UZ');
  const [backSubText, setBackSubText] = useState('');
  const [showNfc, setShowNfc] = useState(true);
  const [textColor, setTextColor] = useState('gold');
  const [bgColor, setBgColor] = useState('black');
  const [bgMode, setBgMode] = useState('color');
  const [bgImage, setBgImage] = useState(null);
  const [darken, setDarken] = useState(35);
  const [font, setFont] = useState('Arial');
  const [fontSize, setFontSize] = useState(92);
  const [logoImage, setLogoImage] = useState(null);
  // Endi pozitsiyalar oldindan belgilangan variantlar emas — sichqoncha
  // bilan sudrab, canvas ichida istalgan joyga qo'yiladi (nisbiy 0..1).
  const [logoXY, setLogoXY] = useState({ x: 0.5, y: 0.86 });
  const [showQr, setShowQr] = useState(true);
  const [qrImage, setQrImage] = useState(null);
  const [qrXY, setQrXY] = useState({ x: 0.86, y: 0.16 });
  const [qrSize, setQrSize] = useState(150);
  // QR manbasi: 'auto' — profil kodidan avtomatik, 'manual' — o'zi kiritgan havola.
  const [qrMode, setQrMode] = useState('auto');
  const [qrManualLink, setQrManualLink] = useState('');
  const [qrColor, setQrColor] = useState('#111111');
  // Matn joyi HAR TOMON UCHUN alohida (old/orqa matnlari butunlay boshqa
  // uzunlikda bo'lishi mumkin, shuning uchun umumiy pozitsiya noqulay).
  const [frontTextXY, setFrontTextXY] = useState({ x: 0.5, y: 0.5 });
  const [backTextXY, setBackTextXY] = useState({ x: 0.5, y: 0.5 });
  const textXY = side === 'front' ? frontTextXY : backTextXY;
  const setTextXY = side === 'front' ? setFrontTextXY : setBackTextXY;
  // ORQA tomondagi o'zgarmas "nfcstore.uz" yozuvi — matni qat'iy, lekin
  // joyi/o'lchami/rangi sozlanadi (sichqoncha bilan suriladi).
  const [wmXY, setWmXY] = useState({ x: 0.5, y: 0.9 });
  const [wmSize, setWmSize] = useState(26);
  const [wmColor, setWmColor] = useState('#ffffff');

  // QR-kod — profilga (nfcstore.uz/<KOD>) avtomatik havola qiladi, YOKI
  // foydalanuvchi o'zi kiritgan (qo'lda) havolaga ishora qiladi.
  useEffect(() => {
    if (!showQr) { setQrImage(null); return; }
    let link;
    if (qrMode === 'manual') {
      link = qrManualLink.trim();
      if (!link) { setQrImage(null); return; }
      if (!/^https?:\/\//i.test(link)) link = 'https://' + link;
    } else {
      const qrCode = (code || frontText || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!qrCode) { setQrImage(null); return; }
      link = `https://nfcstore.uz/${qrCode}`;
    }
    let cancelled = false;
    import('qrcode').then((QRCode) => {
      const canvas = document.createElement('canvas');
      QRCode.toCanvas(canvas, link, { margin: 1, width: 240, color: { dark: qrColor, light: '#00000000' } }, (err) => {
        if (!cancelled && !err) setQrImage(canvas);
      });
    });
    return () => { cancelled = true; };
  }, [showQr, code, frontText, qrMode, qrManualLink, qrColor]);

  const buildState = useCallback((overrides) => ({
    side, frontText, frontSubText, backText, backSubText, showNfc,
    textColor, bgColor, bgMode, bgImage, darken, font, fontSize,
    logoImage, logoXY, showQr, qrImage, qrXY, qrSize, textXY,
    wmXY, wmSize, wmColor, ...overrides,
  }), [side, frontText, frontSubText, backText, backSubText, showNfc,
    textColor, bgColor, bgMode, bgImage, darken, font, fontSize, logoImage, logoXY, showQr, qrImage, qrXY, qrSize, textXY,
    wmXY, wmSize, wmColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    hitboxesRef.current = renderCard(canvas.getContext('2d'), canvas.width, canvas.height, buildState()) || {};
  }, [buildState]);

  // Ko'rsatilgan (CSS) o'lcham bilan haqiqiy canvas piksellari (1280x800)
  // orasidagi nisbatni hisoblab, sichqoncha koordinatasini canvas
  // koordinatasiga aylantiradi.
  const pointerToCanvasXY = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };
  const hitTest = (px, py, box) => box && px >= box.x && px <= box.x + box.w && py >= box.y && py <= box.y + box.h;

  const onCanvasPointerDown = (e) => {
    const { x, y } = pointerToCanvasXY(e);
    const hb = hitboxesRef.current;
    if (hitTest(x, y, hb.qr)) dragRef.current = 'qr';
    else if (hitTest(x, y, hb.wm)) dragRef.current = 'wm';
    else if (hitTest(x, y, hb.logo)) dragRef.current = 'logo';
    else if (hitTest(x, y, hb.text)) dragRef.current = 'text';
    else dragRef.current = null;
  };
  const onCanvasPointerMove = (e) => {
    if (!dragRef.current) return;
    const canvas = canvasRef.current;
    const { x, y } = pointerToCanvasXY(e);
    const nx = Math.min(1, Math.max(0, x / canvas.width));
    const ny = Math.min(1, Math.max(0, y / canvas.height));
    if (dragRef.current === 'logo') setLogoXY({ x: nx, y: ny });
    else if (dragRef.current === 'qr') setQrXY({ x: nx, y: ny });
    else if (dragRef.current === 'wm') setWmXY({ x: nx, y: ny });
    else if (dragRef.current === 'text') setTextXY({ x: nx, y: ny });
  };
  const onCanvasPointerUp = () => { dragRef.current = null; };

  const onPickBgImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    loadImageFromFile(file, setBgImage);
  };
  const onPickLogo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    loadImageFromFile(file, setLogoImage);
  };

  const downloadCurrent = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const name = (side === 'front' ? frontText : backText).replace(/[^a-z0-9]/gi, '_') || 'card';
    const link = document.createElement('a');
    link.download = `nfc_card_${side}_${name}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const downloadBoth = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    renderCard(ctx, canvas.width, canvas.height, buildState({ side: 'front' }));
    let link = document.createElement('a');
    link.download = `nfc_card_front_${(frontText || 'card').replace(/[^a-z0-9]/gi, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    renderCard(ctx, canvas.width, canvas.height, buildState({ side: 'back' }));
    link = document.createElement('a');
    link.download = `nfc_card_back_${(backText || 'card').replace(/[^a-z0-9]/gi, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    // Ko'rinishni foydalanuvchi qaysi tomonda turgan bo'lsa, o'shanga qaytaramiz.
    renderCard(ctx, canvas.width, canvas.height, buildState());
  };

  const inp = 'input input-bordered input-sm mt-1 w-full bg-base-100';

  // Ichki (profil/bandlash oqimiga joylashtirilgan) holatda sahifa
  // sarlavhasi va tashqi <main> qobig'i kerak emas — faqat vosita o'zi.
  const toolBody = (
    <div className="mt-10 grid gap-8 lg:grid-cols-[380px_1fr]">
        <div className="max-h-[calc(100vh-140px)] overflow-y-auto rounded-2xl border border-white/10 bg-base-200/40 p-5 lg:sticky lg:top-6 lg:self-start">
          <FieldGroup title={t("Tomon")}>
            <ToggleGroup
              options={[{ value: 'front', label: 'OLD TOMON' }, { value: 'back', label: 'ORQA TOMON' }]}
              value={side}
              onChange={setSide}
            />
            <div className="mt-4">
              <Label>{t('Old tomon asosiy matni')}</Label>
              <input className={inp} maxLength={18} value={frontText} onChange={(e) => setFrontText(e.target.value)} />
            </div>
            <div className="mt-3">
              <Label>{t("Old tomon qo'shimcha matni (ixtiyoriy)")}</Label>
              <input className={inp} maxLength={28} placeholder={t("masalan: Aziz Karimov")} value={frontSubText} onChange={(e) => setFrontSubText(e.target.value)} />
            </div>
            <div className="mt-3">
              <Label>{t('Orqa tomon asosiy matni')}</Label>
              <input className={inp} maxLength={18} value={backText} onChange={(e) => setBackText(e.target.value)} />
            </div>
            <div className="mt-3">
              <Label>{t("Orqa tomon qo'shimcha matni (ixtiyoriy)")}</Label>
              <input className={inp} maxLength={28} placeholder={t("masalan: +998 90 000 00 00")} value={backSubText} onChange={(e) => setBackSubText(e.target.value)} />
            </div>

            <div className="mt-4">
              <Label>{t('Shrift')}</Label>
              <select className="select select-bordered select-sm mt-1 w-full bg-base-100" value={font} onChange={(e) => setFont(e.target.value)}>
                {FONT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
              </select>
            </div>

            <div className="mt-3">
              <Label>{t('Asosiy matn o\'lchami:')} {fontSize}px</Label>
              <input type="range" min={40} max={140} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="range range-xs range-primary mt-1" />
              <p className="mt-1 text-[14px] text-base-content/40">{t("Katta harf kerak bo'lsa — slayderni o'ngga suring")}</p>
            </div>

            <div className="mt-4">
              <Label>{t('Orqa tomonda NFC belgisi')}</Label>
              <ToggleGroup
                options={[{ value: true, label: 'Ha' }, { value: false, label: "Yo'q" }]}
                value={showNfc}
                onChange={setShowNfc}
              />
            </div>
          </FieldGroup>

          <FieldGroup title={t("Yozuv rangi")}>
            <SwatchRow items={TEXT_SWATCHES} value={textColor} onChange={setTextColor} />
          </FieldGroup>

          <FieldGroup title={t("Fon turi")}>
            <ToggleGroup
              options={[{ value: 'color', label: 'Teri rang' }, { value: 'image', label: 'Rasm yuklash' }]}
              value={bgMode}
              onChange={setBgMode}
            />
            {bgMode === 'color' ? (
              <div className="mt-4">
                <Label>{t('Teri foni rangi')}</Label>
                <SwatchRow items={BG_SWATCHES} value={bgColor} onChange={setBgColor} />
              </div>
            ) : (
              <div className="mt-4">
                <Label>{t("O'z rasmingizni fon qiling")}</Label>
                <input ref={bgFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickBgImage} />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => bgFileRef.current && bgFileRef.current.click()}>
                  {t('Rasm tanlash')}
                </button>
                <p className="mt-2 text-[14px] text-base-content/40">{t("Rasm avtomatik karta o'lchamiga moslanadi (crop qilinadi)")}</p>
                <div className="mt-3">
                  <Label>{t("Rasm qorong'uligi (matn o'qilishi uchun)")}</Label>
                  <input type="range" min={0} max={80} value={darken} onChange={(e) => setDarken(Number(e.target.value))} className="range range-xs range-primary mt-1" />
                </div>
                {bgImage && (
                  <button type="button" className="btn btn-ghost btn-xs mt-3" onClick={() => { setBgImage(null); if (bgFileRef.current) bgFileRef.current.value = ''; }}>
                    {t('Rasmni olib tashlash')}
                  </button>
                )}
              </div>
            )}
          </FieldGroup>

          <FieldGroup title={t("Logotip (ixtiyoriy)")}>
            <Label>{t('Logotip rasm yuklash')}</Label>
            <input ref={logoFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickLogo} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => logoFileRef.current && logoFileRef.current.click()}>
              {t('Rasm tanlash')}
            </button>
            <p className="mt-2 text-xs text-base-content/45">{t("Joyini o'zgartirish uchun kartadagi logotipni sichqoncha bilan ushlab, istalgan joyga suring.")}</p>
            {logoImage && (
              <button type="button" className="btn btn-ghost btn-xs mt-3" onClick={() => { setLogoImage(null); if (logoFileRef.current) logoFileRef.current.value = ''; }}>
                {t('Logotipni olib tashlash')}
              </button>
            )}
          </FieldGroup>

          <FieldGroup title={t("QR-kod")}>
            <label className="flex cursor-pointer items-center gap-2.5">
              <input type="checkbox" className="checkbox checkbox-sm" checked={showQr} onChange={(e) => setShowQr(e.target.checked)} />
              <span className="text-sm">{t("Profilga havola qiluvchi QR-kod qo'shish")}</span>
            </label>
            <p className="mt-2 text-xs text-base-content/45">{t("Faqat ORQA tomonda chiqadi, joyini sichqoncha bilan suring.")}</p>

            {showQr && (
              <>
                <div className="mt-3 flex gap-1.5">
                  <button
                    type="button"
                    className={`btn btn-xs flex-1 ${qrMode === 'auto' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setQrMode('auto')}
                  >
                    {t('Avtomatik (kod)')}
                  </button>
                  <button
                    type="button"
                    className={`btn btn-xs flex-1 ${qrMode === 'manual' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setQrMode('manual')}
                  >
                    {t("Qo'lda havola")}
                  </button>
                </div>

                {qrMode === 'auto' ? (
                  <p className="mt-2 text-xs text-base-content/45">
                    {code || frontText
                      ? <>{t('Havola:')} <span className="font-mono">nfcstore.uz/{(code || frontText).toUpperCase()}</span></>
                      : t("Old tomon matni (kod) kiritilgach QR avtomatik hosil bo'ladi.")}
                  </p>
                ) : (
                  <input
                    value={qrManualLink}
                    onChange={(e) => setQrManualLink(e.target.value)}
                    placeholder={t("https://... yoki t.me/...")}
                    className="input input-bordered input-sm mt-2 w-full bg-base-100 font-mono text-xs"
                  />
                )}

                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="color"
                    value={qrColor}
                    onChange={(e) => setQrColor(e.target.value)}
                    className="h-8 w-8 cursor-pointer rounded-lg border border-white/15 bg-transparent p-0"
                  />
                  <span className="text-xs text-base-content/60">{t('QR-kod rangi')}</span>
                </div>

                <div className="mt-3">
                  <Label>{t('QR-kod o\'lchami')} ({qrSize}px)</Label>
                  <input type="range" min={60} max={280} step={10} value={qrSize} onChange={(e) => setQrSize(Number(e.target.value))} className="range range-xs range-primary mt-1" />
                </div>
              </>
            )}
          </FieldGroup>

          <FieldGroup title={t("Matn joyi")}>
            <p className="text-xs text-base-content/45">{t('Asosiy matnni ({s} tomon) kartaning o\'zida sichqoncha bilan ushlab, istalgan joyga suring.', { s: side === 'front' ? t('old') : t('orqa') })}</p>
            <button type="button" className="btn btn-ghost btn-xs mt-2" onClick={() => setTextXY({ x: 0.5, y: 0.5 })}>
              {t('Markazga qaytarish')}
            </button>
          </FieldGroup>

          {side === 'back' && (
            <FieldGroup title={t('"nfcstore.uz" yozuvi (o\'zgarmas)')}>
              <p className="text-xs text-base-content/45">{t('Matni o\'zgarmaydi, lekin joyi/o\'lchami/rangi sozlanadi. Kartada sichqoncha bilan ushlab suring.')}</p>
              <div className="mt-2">
                <Label>{t('O\'lcham')} ({wmSize}px)</Label>
                <input type="range" min={12} max={60} value={wmSize} onChange={(e) => setWmSize(Number(e.target.value))} className="range range-xs range-primary mt-1" />
              </div>
              <div className="mt-3 flex items-center gap-3">
                <input type="color" value={wmColor} onChange={(e) => setWmColor(e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded-lg border border-white/15 bg-transparent p-0" />
                <span className="text-xs text-base-content/60">{t('Rangi')}</span>
              </div>
              <button type="button" className="btn btn-ghost btn-xs mt-3" onClick={() => { setWmXY({ x: 0.5, y: 0.9 }); setWmSize(26); setWmColor('#ffffff'); }}>
                {t('Andozaga qaytarish')}
              </button>
            </FieldGroup>
          )}

          <FieldGroup title={t("Yuklab olish")}>
            <button type="button" className="btn btn-block bg-gradient-to-br from-[#f8e8b0] to-[#c9a24b] text-[#1a1408] hover:brightness-105 border-none" onClick={downloadCurrent}>
              {t('PNG yuklab olish (joriy tomon)')}
            </button>
            <button type="button" className="btn btn-block btn-ghost mt-2.5 border border-white/10" onClick={downloadBoth}>
              {t('Ikkala tomonni yuklash')}
            </button>
          </FieldGroup>
        </div>

        <div className="flex flex-col items-center gap-4">
          <canvas
            ref={canvasRef}
            width={1280}
            height={800}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerUp}
            onPointerLeave={onCanvasPointerUp}
            className="w-full max-w-[520px] touch-none rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
          />
          <p className="max-w-[420px] text-center text-xs text-base-content/50">
            {t("Chop etish uchun 1280×800px, yuqori sifat. Logotip va QR-kodni sichqoncha bilan sudrab, joyini o'zgartiring.")}
          </p>
        </div>
      </div>
  );

  if (embedded) return toolBody;

  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 sm:px-10 lg:px-14 pb-16">
      <section className="pt-14">
        <span className="inline-flex items-center gap-2 font-mono text-xs tracking-wider text-base-content/70">
          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-accent"></span>
          {t('Karta dizayni')}
        </span>
        <h1 className="mt-4 max-w-xl text-4xl font-extrabold leading-tight tracking-tight">
          {t('NFC karta')} <span className="bg-gradient-to-br from-white to-base-content/50 bg-clip-text text-transparent">{t('dizaynini yarating')}</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm text-base-content/60">
          {t('Matn, rang, fon va logotipni tanlab, jismoniy NFC kartangiz uchun bosma dizaynni shu yerda yarating va tayyor rasmni PNG holida yuklab oling.')}
        </p>
      </section>
      {toolBody}
    </main>
  );
}
