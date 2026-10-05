// TEZLIK DIAGNOSTIKASI (2026-10-05).
//
// Savol: "ilova sekin — internetdanmi yoki serverdanmi?". Bunga taxmin
// bilan emas, O'LCHOV bilan javob beriladi:
//
// 1. `x-nfc-timing: 1` sarlavhali so'rovga Worker `server-timing`
//    sarlavhasini qo'shadi: Worker ichida ketgan umumiy vaqt, shundan
//    bazaga (O'zbekistondagi sqld) ketgan vaqt va nechta KETMA-KET
//    borib-kelish ("to'lqin") bo'lgani, hamda so'rovga xizmat qilgan
//    Cloudflare nuqtasi (colo). Sarlavhasiz so'rovlar O'ZGARMAYDI —
//    oddiy foydalanuvchi trafigida hech qanday qo'shimcha ish yo'q.
// 2. `GET /api/diag/speed` — Worker'dan bazagacha bitta borib-kelish
//    (`SELECT 1`) necha ms ekanini 3 marta o'lchaydi.
// 3. `GET /tezlik` — telefonning O'ZIDA ishlaydigan sahifa: har bir
//    so'rovning to'liq vaqtidan server vaqtini ayiradi, qolgani —
//    telefon ↔ Cloudflare (ya'ni foydalanuvchining interneti).
//
// Hech qanday foydalanuvchi ma'lumoti qaytarilmaydi va yozilmaydi.

const STMT_RUNNERS = new Set(['all', 'first', 'run', 'raw']);

/** Bazani o'rab, har bir so'rovning boshlanish/tugash vaqtini yozadi. */
export function timedDb(db, timing) {
  const track = (promise, label = '') => {
    const start = Date.now();
    timing.stmts += 1;
    return Promise.resolve(promise).finally(() => timing.spans.push([start, Date.now(), label]));
  };
  // Vaqtinchalik diagnostika (x-nfc-timing: 2): so'rov turi va jadval nomi —
  // QIYMATLAR YO'Q (bind argumentlari hech qachon yozilmaydi).
  const labelOf = (sql) => {
    const t = String(sql || '').replace(/\s+/g, ' ').trim();
    const verb = (t.match(/^\w+/) || [''])[0].toUpperCase();
    const table = (t.match(/(?:table_info\(|\bFROM\s|\bINTO\s|\bUPDATE\s|\bTABLE(?: IF NOT EXISTS)?\s)\s*"?(\w+)/i) || [])[1] || '';
    return `${verb} ${table}`.trim();
  };
  const wrapStmt = (stmt, label) => new Proxy(stmt, {
    get(target, prop) {
      if (prop === '__nfcInner') return target;
      if (prop === 'bind') return (...args) => wrapStmt(target.bind(...args), label);
      const v = target[prop];
      if (STMT_RUNNERS.has(prop) && typeof v === 'function') return (...args) => track(v.apply(target, args), label);
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
  const unwrap = (s) => (s && s.__nfcInner) || s;
  return new Proxy(db, {
    get(target, prop) {
      if (prop === 'prepare') return (sql) => wrapStmt(target.prepare(sql), labelOf(sql));
      if (prop === 'batch') return (stmts) => track(target.batch((stmts || []).map(unwrap)), `BATCH(${(stmts || []).length})`);
      if (prop === 'exec') return (...args) => track(target.exec(...args));
      const v = target[prop];
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
}

export function newTiming() {
  return { t0: Date.now(), spans: [], stmts: 0 };
}

/**
 * Bir-birining ustiga tushgan so'rovlar bitta "to'lqin" (bitta HTTP
 * pipeline) hisoblanadi; to'lqinlar soni = ketma-ket borib-kelishlar.
 */
export function summarizeTiming(timing, now = Date.now()) {
  const spans = [...timing.spans].sort((a, b) => a[0] - b[0]);
  const trace = [];
  let waves = 0;
  let dbMs = 0;
  let curStart = -1;
  let curEnd = -1;
  for (const [s, e, label] of spans) {
    // `>=`: Workers'da soat faqat I/O da siljiydi — ketma-ket so'rovning
    // boshlanishi oldingisining tugashiga AYNAN teng bo'ladi.
    if (curEnd < 0 || s >= curEnd) {
      if (curEnd >= 0) dbMs += curEnd - curStart;
      waves += 1;
      curStart = s;
      curEnd = e;
    } else if (e > curEnd) {
      curEnd = e;
    }
    trace.push(`${waves}:${label || '?'}`);
  }
  if (curEnd >= 0) dbMs += curEnd - curStart;
  return { totalMs: Math.max(0, now - timing.t0), dbMs, waves, stmts: timing.stmts, trace };
}

export function serverTimingValue(summary, colo) {
  const parts = [
    `total;dur=${summary.totalMs}`,
    `db;dur=${summary.dbMs};desc="waves=${summary.waves} stmts=${summary.stmts}"`,
  ];
  if (colo) parts.push(`colo;desc="${String(colo).replace(/[^A-Za-z0-9]/g, '').slice(0, 8)}"`);
  return parts.join(', ');
}

export function withTimingHeaders(res, summary, colo, detail = false) {
  const out = new Response(res.body, res);
  if (detail) out.headers.set('x-nfc-sql', summary.trace.join(' | ').slice(0, 3000));
  out.headers.set('server-timing', serverTimingValue(summary, colo));
  out.headers.set('x-nfc-waves', String(summary.waves));
  if (colo) out.headers.set('x-nfc-colo', String(colo).replace(/[^A-Za-z0-9]/g, '').slice(0, 8));
  return out;
}

/** Worker → baza: bitta borib-kelish (SELECT 1) uch marta, ketma-ket. */
export async function handleSpeedDiag(request, env) {
  const cf = request.cf || {};
  const pings = [];
  let error = '';
  for (let i = 0; i < 3; i += 1) {
    const t = Date.now();
    try {
      await env.DB.prepare('SELECT 1 AS one').first('one');
      pings.push(Date.now() - t);
    } catch (e) {
      error = String(e?.message || e).slice(0, 120);
      break;
    }
  }
  return new Response(JSON.stringify({
    colo: cf.colo || '',
    country: cf.country || '',
    store: env.UZ_STORE_ACTIVE ? 'uz' : 'd1',
    dbPingMs: pings,
    error,
  }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export const TEZLIK_HTML = `<!doctype html>
<html lang="uz"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>NFCSTORE — tezlik tekshiruvi</title>
<style>
:root{--bg:#F4F4F2;--ink:#1d1d1b;--mut:#6b6b68;--card:#fff;--line:#e4e4e0;--ok:#1f7a3f;--bad:#b3261e;--warn:#9a6700}
@media (prefers-color-scheme:dark){:root{--bg:#111;--ink:#f2f2ef;--mut:#a3a3a0;--card:#1c1c1b;--line:#2c2c2a;--ok:#5fd08a;--bad:#ff8a80;--warn:#f2c14e}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,-apple-system,sans-serif}
main{max-width:640px;margin:0 auto;padding:20px 16px 40px}
h1{font-size:22px;margin:0 0 4px}p{margin:6px 0;color:var(--mut)}
button{font:inherit;font-weight:600;border:0;border-radius:999px;padding:12px 20px;background:var(--ink);color:var(--bg);margin:12px 8px 0 0}
button.sec{background:transparent;color:var(--ink);border:1px solid var(--line)}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px;margin-top:14px;overflow-x:auto}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:13.5px}
th,td{text-align:right;padding:6px 4px;border-bottom:1px solid var(--line);white-space:nowrap}
th:first-child,td:first-child{text-align:left;white-space:normal}
.v{font-weight:700;font-size:17px;margin:4px 0}.ok{color:var(--ok)}.bad{color:var(--bad)}.warn{color:var(--warn)}
pre{white-space:pre-wrap;font-size:12px;color:var(--mut)}
</style></head><body><main>
<h1>Tezlik tekshiruvi</h1>
<p>Telefoningizdan serverga so'rov yuborib, kechikish qayerda ekanini o'lchaydi: internetingizdami yoki serverdami.</p>
<button id="go">Tekshirishni boshlash</button><button id="copy" class="sec" hidden>Natijani nusxalash</button>
<div id="out"></div>
<script>
(function(){
var CODE=(new URLSearchParams(location.search).get('code')||'PPP777').toUpperCase().replace(/[^A-Z0-9]/g,'');
var TRIES=3;
function med(a){var b=a.slice().sort(function(x,y){return x-y});return b.length?b[Math.floor(b.length/2)]:0}
function st(h){var r={total:0,db:0,waves:0,colo:''};if(!h)return r;h.split(',').forEach(function(p){
 var m=p.trim().match(/^(\\w+)(.*)$/);if(!m)return;var d=(p.match(/dur=([\\d.]+)/)||[])[1];var desc=(p.match(/desc="([^"]*)"/)||[])[1]||'';
 if(m[1]==='total')r.total=+d||0;if(m[1]==='db'){r.db=+d||0;r.waves=+((desc.match(/waves=(\\d+)/)||[])[1]||0)}if(m[1]==='colo')r.colo=desc});return r}
async function one(path){var t=performance.now();var res=await fetch(path,{cache:'no-store',credentials:'include',headers:{'x-nfc-timing':'1'}});
 var body=await res.text();var ms=performance.now()-t;var s=st(res.headers.get('server-timing'));
 return {ms:ms,status:res.status,s:s,body:body,cache:res.headers.get('cf-cache-status')||'',place:res.headers.get('cf-placement')||'',bytes:body.length}}
async function measure(label,path){var rows=[];for(var i=0;i<TRIES;i++){try{rows.push(await one(path))}catch(e){rows.push({ms:0,status:0,s:st(''),err:String(e)})}}
 var ok=rows.filter(function(r){return r.status>0});
 return {label:label,path:path,total:med(ok.map(function(r){return r.ms})),server:med(ok.map(function(r){return r.s.total})),
  db:med(ok.map(function(r){return r.s.db})),waves:med(ok.map(function(r){return r.s.waves})),colo:(ok[0]&&ok[0].s.colo)||'',
  status:(ok[0]&&ok[0].status)||0,first:ok[0]&&ok[0].ms,body:ok[0]&&ok[0].body,cache:(ok[0]&&ok[0].cache)||'',place:ok.map(function(r){return r.place}).filter(Boolean).join(',')}}
function f(n){return Math.round(n)+' ms'}
async function run(){var out=document.getElementById('out');out.innerHTML='<div class="card"><p>O\\'lchanmoqda… (taxminan 15–30 soniya)</p></div>';
 var res=[];
 var diag=await measure('Bo\\'sh so\\'rov (internet + Cloudflare)','/api/diag/speed');res.push(diag);
 var dj={};try{dj=JSON.parse(diag.body||'{}')}catch(e){}
 res.push(await measure('Profil ma\\'lumoti','/api/records/'+CODE));
 res.push(await measure('Profil postlari','/api/records/'+CODE+'/posts'));
 res.push(await measure('Lenta / Reels','/api/feed?page=1&limit=15'));
 var img='';try{var fj=JSON.parse(res[3].body||'{}');var it=(fj.feed||[]).filter(function(x){return x.imageUrl})[0];img=it?it.imageUrl:''}catch(e){}
 var media=null;if(img){var u=img.indexOf('http')===0?img:img;var t=performance.now();try{var r=await fetch(u,{cache:'no-store'});var b=await r.arrayBuffer();
  media={ms:performance.now()-t,kb:Math.round(b.byteLength/1024),cache:r.headers.get('cf-cache-status')||r.headers.get('x-nfc-edge')||''}}catch(e){}}
 var net=Math.max(0,diag.total-diag.server);
 var dbRtt=(dj.dbPingMs&&dj.dbPingMs.length)?med(dj.dbPingMs):0;
 var html='<div class="card"><p>Cloudflare nuqtasi: <b>'+(dj.colo||diag.colo||'?')+'</b> · mamlakat: <b>'+(dj.country||'?')+'</b>'+(diag.place?' · server joyi: <b>'+diag.place+'</b>':'')+'</p>';
 html+='<p class="v">Internetingiz (telefon ↔ server): <span class="'+(net>400?'bad':net>150?'warn':'ok')+'">'+f(net)+'</span></p>';
 html+='<p class="v">Server ↔ baza, bitta borib-kelish: <span class="'+(dbRtt>150?'bad':dbRtt>60?'warn':'ok')+'">'+f(dbRtt)+'</span></p></div>';
 html+='<div class="card"><table><tr><th>So\\'rov</th><th>Jami</th><th>Internet</th><th>Server</th><th>Baza</th><th>Ketma-ket</th></tr>';
 res.forEach(function(r){var n=Math.max(0,r.total-r.server);html+='<tr><td>'+r.label+(r.status&&r.status!==200?' ('+r.status+')':'')+'</td><td>'+f(r.total)+'</td><td>'+f(n)+'</td><td>'+f(r.server)+'</td><td>'+f(r.db)+'</td><td>'+(r.waves||'—')+'</td></tr>'});
 if(media)html+='<tr><td>Rasm ('+media.kb+' KB'+(media.cache?', '+media.cache:'')+')</td><td>'+f(media.ms)+'</td><td colspan="4"></td></tr>';
 html+='</table><p>«Jami» — telefoningiz kutgan vaqt. «Internet» — Jami − Server. «Ketma-ket» — server bazaga necha marta navbat bilan borib keldi.</p></div>';
 var prof=res[2];var verdict;
 var netShare=prof.total?Math.max(0,prof.total-prof.server)/prof.total:0;
 if(net>400)verdict='<b class="bad">Asosiy sabab — internet.</b> Telefon bilan server orasidagi bitta so\\'rov '+f(net)+' olyapti.';
 else if(netShare>0.6)verdict='<b class="warn">Ko\\'proq internet.</b> Postlar so\\'rovining '+Math.round(netShare*100)+'% vaqti internetda.';
 else verdict='<b class="bad">Asosiy sabab — server ↔ baza.</b> Postlar so\\'rovining '+Math.round((1-netShare)*100)+'% vaqti serverda ('+(prof.waves||'?')+' ta ketma-ket borib-kelish × ~'+f(dbRtt)+').';
 html+='<div class="card"><p class="v">'+verdict+'</p></div>';
 var txt='TEZLIK '+new Date().toISOString()+'\\ncolo='+(dj.colo||'')+' country='+(dj.country||'')+' placement='+(diag.place||'')+' net='+Math.round(net)+' dbRtt='+Math.round(dbRtt)+'\\n'+
  res.map(function(r){return r.label+': total='+Math.round(r.total)+' server='+Math.round(r.server)+' db='+Math.round(r.db)+' waves='+r.waves+' status='+r.status}).join('\\n')+
  (media?'\\nrasm: '+Math.round(media.ms)+'ms '+media.kb+'KB '+media.cache:'')+'\\nUA: '+navigator.userAgent;
 html+='<div class="card"><pre id="raw"></pre></div>';out.innerHTML=html;document.getElementById('raw').textContent=txt;
 var c=document.getElementById('copy');c.hidden=false;c.onclick=function(){navigator.clipboard&&navigator.clipboard.writeText(txt).then(function(){c.textContent='Nusxalandi ✓'})}}
document.getElementById('go').onclick=function(){this.disabled=true;var b=this;run().finally(function(){b.disabled=false;b.textContent='Qayta tekshirish'})};
})();
</script>
</main></body></html>`;
