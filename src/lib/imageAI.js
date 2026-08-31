// Rasm uchun AI/avtomatik vositalar — Company System Faz 17.
//
// ARXITEKTURA: barcha vositalar shu bitta interfeys orqali chaqiriladi
// (provider abstraction) — kelajakda "fonni olib tashlash"/"sifatni
// oshirish" uchun haqiqiy tashqi provayder (masalan remove.bg, Cloudinary,
// yoki litsenziyasi tekshirilgan client-side model) ulanganda, faqat shu
// faylni almashtirish kifoya — chaqiruvchi kod (UI) o'zgarmaydi.
//
// HOZIRGI HOLAT:
//   - autoCropToContent / centerObject — HAQIQIY ishlaydi, hech qanday
//     tashqi kutubxona/model kerak emas (canvas piksel tahlili).
//   - removeBackground / whitenBackground / enhance — hali ULANMAGAN.
//     Sabab: sifatli fon o'chirish uchun ML model kerak, lekin tekshirilgan
//     bepul variantlar (masalan @imgly/background-removal) AGPL-3.0 bilan
//     litsenziyalangan — tijorat mahsulotida ishlatish uchun manba kodni
//     ochish talabi bilan keladi (yoki pullik litsenziya). Bu — texnik
//     emas, biznes/huquqiy qaror, shuning uchun bu yerda soxta/ishlamaydigan
//     natija qaytarilmaydi — ochiq holda `available:false` qaytariladi.

export const IMAGE_AI_TOOLS = {
  autoCrop: { available: true },
  centerObject: { available: true },
  removeBackground: { available: false, reason: 'Litsenziyalangan provayder hali ulanmagan.' },
  whitenBackground: { available: false, reason: 'Fon o‘chirish provayderiga bog‘liq.' },
  enhance: { available: false, reason: 'Sifat oshirish provayderi hali ulanmagan.' },
};

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Rasmni o‘qib bo‘lmadi.'));
    img.src = dataUrl;
  });
}

// Fon rangini rasmning to'rtta burchagidan o'rtacha oladi — mahsulot/taom
// suratlarida fon odatda bir xil (yoki deyarli bir xil) rangda bo'ladi.
function cornerBackgroundColor(data, w, h) {
  const px = (x, y) => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const corners = [px(0, 0), px(w - 1, 0), px(0, h - 1), px(w - 1, h - 1)];
  return corners.reduce((acc, c) => [acc[0] + c[0] / 4, acc[1] + c[1] / 4, acc[2] + c[2] / 4], [0, 0, 0]);
}

// Fondan "farq qiladigan" piksellarning bounding-box'ini topadi.
function contentBounds(imgData, w, h, threshold = 28) {
  const { data } = imgData;
  const [br, bg, bb] = cornerBackgroundColor(data, w, h);
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const dr = data[i] - br, dg = data[i + 1] - bg, db = data[i + 2] - bb;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null; // farq topilmadi — bir xil fon/bo'sh rasm
  return { minX, minY, maxX, maxY };
}

// "Avtomatik kesish" — fondan farq qiladigan hudud atrofida (kichik
// bo'sh joy bilan) kesadi. Model/tashqi provayder shart emas.
export async function autoCropToContent(dataUrl, { padding = 0.06 } = {}) {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const bounds = contentBounds(ctx.getImageData(0, 0, canvas.width, canvas.height), canvas.width, canvas.height);
  if (!bounds) return { ok: false, dataUrl, reason: 'Kesish uchun aniq chegara topilmadi.' };
  const padX = Math.round((bounds.maxX - bounds.minX) * padding);
  const padY = Math.round((bounds.maxY - bounds.minY) * padding);
  const x = Math.max(0, bounds.minX - padX);
  const y = Math.max(0, bounds.minY - padY);
  const w = Math.min(canvas.width - x, bounds.maxX - bounds.minX + padX * 2);
  const h = Math.min(canvas.height - y, bounds.maxY - bounds.minY + padY * 2);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, w, h);
  return { ok: true, dataUrl: out.toDataURL('image/jpeg', 0.9) };
}

// "Ob'ektni markazlashtirish" — kontentni kvadrat kanvas markaziga
// qo'yadi (fon rangi bilan to'ldirilgan bo'shliq bilan). Katalog/menyu
// kartalarida bir xil o'lchamdagi kvadrat suratlar chiroyliroq ko'rinadi.
export async function centerObject(dataUrl, { size = 800 } = {}) {
  const img = await loadImage(dataUrl);
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = img.width;
  srcCanvas.height = img.height;
  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
  srcCtx.drawImage(img, 0, 0);
  const bounds = contentBounds(srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height), srcCanvas.width, srcCanvas.height);
  const [br, bg, bb] = cornerBackgroundColor(srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height).data, srcCanvas.width, srcCanvas.height);

  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const outCtx = out.getContext('2d');
  outCtx.fillStyle = `rgb(${Math.round(br)},${Math.round(bg)},${Math.round(bb)})`;
  outCtx.fillRect(0, 0, size, size);

  const region = bounds
    ? { x: bounds.minX, y: bounds.minY, w: bounds.maxX - bounds.minX, h: bounds.maxY - bounds.minY }
    : { x: 0, y: 0, w: srcCanvas.width, h: srcCanvas.height };
  const margin = 0.9; // markazdagi ob'ekt atrofida 10% bo'shliq
  const scale = Math.min((size * margin) / region.w, (size * margin) / region.h);
  const dw = region.w * scale;
  const dh = region.h * scale;
  const dx = (size - dw) / 2;
  const dy = (size - dh) / 2;
  outCtx.drawImage(srcCanvas, region.x, region.y, region.w, region.h, dx, dy, dw, dh);
  return { ok: true, dataUrl: out.toDataURL('image/jpeg', 0.9) };
}

// Hali ulanmagan vositalar — chaqiruvchi UI shu javobga qarab
// "tez orada" holatini ko'rsatadi, hech qachon soxta natija bermaydi.
export async function removeBackground() {
  return { ok: false, reason: IMAGE_AI_TOOLS.removeBackground.reason };
}
export async function whitenBackground() {
  return { ok: false, reason: IMAGE_AI_TOOLS.whitenBackground.reason };
}
export async function enhance() {
  return { ok: false, reason: IMAGE_AI_TOOLS.enhance.reason };
}
