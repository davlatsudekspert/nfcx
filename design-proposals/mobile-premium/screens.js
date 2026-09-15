import { svg } from './icons.js';
import { status, brandbar, backbar, card, arcs, mono, nav, row, verif, IMG, LOGO } from './parts.js';

export const S = {};

/* ═══════════════════════════════════════════════════════════
   1. BOSH SAHIFA — "men kimman va nima bo'lyapti"
   Karta ekranning qahramoni: ilova ochilganda odam avvalo
   o'z ID'sini ko'radi.
   ═══════════════════════════════════════════════════════════ */
S.home = () => `
<div class="aura"></div><div class="grain"></div>
<div class="scr">
  ${status()}
  ${brandbar()}
  <div class="scroll">
    <div class="gut" style="padding-top:2px">
      <div class="display sm" style="color:var(--ink-2)">Assalomu alaykum,</div>
      <div class="display" style="font-size:43px;margin-top:-5px">Dilshod</div>
      <div class="sub">Yangi aloqalar shu yerdan boshlanadi</div>
    </div>

    <div class="stories">
      <div class="story"><div class="ring" style="background:rgba(255,255,255,.1)"><div><div class="add">+</div></div></div><b>Siz</b></div>
      ${[['Aziz',1],['Madina',2],['Javohir',3],['Lola',4]].map(([n,h],i)=>`
      <div class="story ${i===3?'seen':''}"><div class="ring"><div>${mono(n,51,h)}</div></div><b>${n}</b></div>`).join('')}
    </div>

    <div class="sec"><h3>Mening kartam</h3><a>Barchasi</a></div>
    <div class="gut">${card()}</div>

    <div class="gut" style="display:flex;align-items:center;justify-content:space-between;margin-top:11px">
      <span class="badge"><i></i>Faol</span>
      <a style="font-size:13px;color:var(--ink-2);text-decoration:none">Profilni ochish ›</a>
    </div>

    <div class="gut" style="display:flex;gap:9px;margin-top:13px">
      ${[['idcard','ID katalogi'],['share','Ulashish'],['bag','Buyurtmalar']].map(([ic,t])=>`
      <div class="surf" style="flex:1;padding:10px 8px;display:flex;flex-direction:column;align-items:center;gap:8px">
        <svg viewBox="0 0 24 24" style="width:21px;height:21px;stroke:var(--gold);stroke-width:1.7;fill:none">${svg(ic).replace(/<\/?svg[^>]*>/g,'')}</svg>
        <b style="font-size:12px;font-weight:600;letter-spacing:-.1px">${t}</b>
      </div>`).join('')}
    </div>

    <div class="sec"><h3>Siz uchun</h3><a>Barchasi</a></div>
    <div class="gut">
      <div class="surf" style="overflow:hidden;padding:0">
        <div class="ph" style="height:116px"><img src="${IMG}/card-backgrounds/tashkent.webp"></div>
        <div style="padding:11px 13px 12px">
          <div style="display:flex;align-items:center;gap:10px">
            ${mono('Aziz Rahimov',36,1)}
            <div style="flex:1"><b style="display:block;font-size:14px;font-weight:600">Aziz Rahimov</b>
              <span style="font-size:12px;color:var(--ink-2)">Arxitektor</span></div>
            <svg viewBox="0 0 24 24" style="width:21px;height:21px;stroke:var(--ink-2);stroke-width:1.6;fill:none">${svg('heart').replace(/<\/?svg[^>]*>/g,'')}</svg>
            <svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:var(--ink-2);stroke-width:1.6;fill:none">${svg('book').replace(/<\/?svg[^>]*>/g,'')}</svg>
          </div>
          <div style="font-size:13.5px;color:var(--ink-2);margin-top:9px">Yangi g'oyalar. Yangi tanishuvlar.</div>
        </div>
      </div>
    </div>
    <div style="height:22px"></div>
  </div>
  ${nav('home')}
</div>`;

/* ═══════════════════════════════════════════════════════════
   2. NFC MARKAZI — ilovaning asosiy amali.
   Yorug'lik markazdan tushadi: ko'z to'lqinga qaraydi.
   ═══════════════════════════════════════════════════════════ */
S.nfc = () => `
<div class="aura aura--nfc"></div><div class="grain"></div>
<div class="scr">
  ${status()}
  ${brandbar()}
  <div class="scroll">
    <div class="gut" style="padding-top:4px">
      <div class="display">NFC markazi</div>
      <div class="sub">Bir tegishda yangi aloqa</div>
    </div>

    <div class="gut" style="margin-top:17px">
      <div style="display:flex;gap:5px;padding:5px;background:rgba(255,255,255,.04);
        border:1px solid var(--line-soft);border-radius:var(--r-full)">
        <div class="btn gold sm" style="flex:1;min-height:42px;border-radius:99px;font-size:14.5px">${svg('wave')}Skanerlash</div>
        <div class="btn sm" style="flex:1;min-height:42px;border-radius:99px;background:transparent;color:var(--ink-2);font-size:14.5px">${svg('pen')}Yozish</div>
      </div>
    </div>

    <!-- To'lqin nishoni: uch halqa markazdan tarqaladi -->
    <div style="position:relative;height:206px;display:grid;place-items:center;margin-top:8px">
      <div style="position:absolute;width:212px;height:212px;border-radius:50%;border:1px solid rgba(226,196,128,.10)"></div>
      <div style="position:absolute;width:162px;height:162px;border-radius:50%;border:1px solid rgba(226,196,128,.16)"></div>
      <div style="position:absolute;width:112px;height:112px;border-radius:50%;border:1px solid rgba(226,196,128,.26);
        box-shadow:0 0 44px -6px rgba(226,196,128,.30) inset"></div>
      <div style="position:relative;width:78px;height:78px;border-radius:50%;background:var(--grad-gold-btn);
        display:grid;place-items:center;box-shadow:0 10px 34px -8px rgba(201,164,85,.72),0 1px 0 rgba(255,255,255,.5) inset">
        <img src="${LOGO}" style="width:42px;height:42px;filter:brightness(.3) saturate(.4)">
      </div>
    </div>

    <div class="gut" style="text-align:center;margin-top:-6px">
      <div class="display sm" style="font-size:25px;line-height:1.16">Kartani telefon<br>tepasiga yaqinlashtiring</div>
      <div class="sub" style="font-size:13px">NFC yoqilgan bo'lishi kerak</div>
    </div>

    <div class="gut" style="margin-top:20px;display:grid;gap:10px">
      <div class="btn gold">${svg('wave')}Skanerlashni boshlash</div>
      <div class="btn ghost">${svg('qr')}QR orqali ochish</div>
    </div>

    <div class="sec" style="margin-top:22px"><h3 style="font-size:15px;color:var(--ink-2);font-weight:600">Mening kartam</h3></div>
    <div class="gut">
      <div class="surf" style="display:flex;align-items:center;gap:13px;padding:11px 13px">
        <div class="card gold mini">${arcs()}<div class="face"><div class="top"><div class="b"><img src="${LOGO}"><b>NFCSTORE</b></div></div><div class="code">GLD 777</div></div></div>
        <div style="flex:1"><b style="display:block;font-size:14.5px;font-weight:600">GLD 777</b>
          <span class="badge" style="margin-top:3px"><i></i>Faol</span></div>
        <div class="chev" style="color:var(--ink-3);font-size:19px">›</div>
      </div>
    </div>
    <div style="height:96px"></div>
  </div>
  ${nav('nfc')}
</div>`;

/* ═══════════════════════════════════════════════════════════
   3. ID KATALOGI — tanlov ekrani.
   Har tarif MATERIAL bilan ajraladi, rang bilan emas.
   ═══════════════════════════════════════════════════════════ */
S.catalog = () => `
<div class="aura"></div><div class="grain"></div>
<div class="scr">
  ${status()}
  ${backbar('ID katalogi')}
  <div class="scroll">
    <div class="gut" style="padding-top:4px">
      <div class="display">Sizga xos raqam</div>
      <div class="sub">Profilingiz uchun ID tanlang</div>
    </div>

    <div class="chips" style="margin-top:17px">
      <div class="chip on">Barchasi</div><div class="chip">Gold</div>
      <div class="chip">Silver</div><div class="chip">Premium</div>
    </div>

    <div class="gut" style="margin-top:17px">${card({ code: 'GLD 777', who: 'Bo\'sh', label: 'Gold' })}</div>

    <div class="gut" style="display:flex;align-items:baseline;justify-content:space-between;margin-top:13px">
      <b style="font-size:15.5px;font-weight:700">Gold ID</b>
      <b style="font-size:15.5px;font-weight:700;color:var(--ink-gold)">149 000 so'm</b>
    </div>

    <div class="gut" style="margin-top:15px">
      <div class="surf" style="padding:0;overflow:hidden">
        ${[['bronze','Bronza','49 000 so\'m','BRZ 104'],
           ['silver','Silver','99 000 so\'m','SLV 220'],
           ['noir','Premium ID','199 000 so\'m','PRM 001']].map(([t,n,p,c])=>`
        <div class="row">
          <div class="card ${t} mini" style="width:58px;border-radius:7px;flex:none">${arcs()}
            <div class="face" style="padding:5px 6px"><div class="top"><div class="b"><img src="${LOGO}" style="width:8px;height:8px"><b style="font-size:4.4px;letter-spacing:.6px">NFCSTORE</b></div></div>
            <div class="code" style="font-size:7.5px;letter-spacing:.6px">${c}</div></div></div>
          <div class="tx"><b>${n}</b><span>${p}</span></div>
          <div class="chev">›</div>
        </div>`).join('')}
        <div class="row">
          <div style="width:58px;height:37px;border-radius:7px;flex:none;background:rgba(255,255,255,.05);
            border:1px dashed var(--line);display:grid;place-items:center">
            <img src="${LOGO}" style="width:17px;height:17px;opacity:.5"></div>
          <div class="tx"><b>Bepul ID</b><span>8 xonali</span></div>
          <div class="chev">›</div>
        </div>
      </div>
    </div>

    <div class="gut" style="margin-top:17px"><div class="btn gold">Gold ID tanlash</div></div>
    <div style="height:96px"></div>
  </div>
  ${nav('nfc')}
</div>`;
