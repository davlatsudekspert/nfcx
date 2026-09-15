import { svg } from './icons.js';

export const IMG = '../../public';
export const LOGO = '../../mobile/assets/img/logo_mark.png';

/* Status qatori */
export const status = () => `
<div class="status"><span>9:41</span><span class="r">
  <svg viewBox="0 0 18 12" width="17" height="11"><g fill="#F7F4EE">
    <rect x="0" y="7.5" width="3" height="4" rx="1"/><rect x="4.6" y="5.2" width="3" height="6.3" rx="1"/>
    <rect x="9.2" y="2.8" width="3" height="8.7" rx="1"/><rect x="13.8" y=".4" width="3" height="11.1" rx="1"/></g></svg>
  <svg viewBox="0 0 16 12" width="16" height="12"><path d="M8 10.4 6.1 8.5a2.7 2.7 0 0 1 3.8 0zM8 6.9a5.2 5.2 0 0 0-3.7 1.5L2.9 7A7.2 7.2 0 0 1 8 4.9 7.2 7.2 0 0 1 13.1 7l-1.4 1.4A5.2 5.2 0 0 0 8 6.9zM8 2.9A9.2 9.2 0 0 0 1.5 5.6L.1 4.2A11.2 11.2 0 0 1 8 .9a11.2 11.2 0 0 1 7.9 3.3l-1.4 1.4A9.2 9.2 0 0 0 8 2.9z" fill="#F7F4EE"/></svg>
  <svg viewBox="0 0 26 12" width="25" height="11"><rect x=".5" y=".5" width="21" height="11" rx="3" fill="none" stroke="#F7F4EE" stroke-opacity=".45"/><rect x="2" y="2" width="18" height="8" rx="1.8" fill="#F7F4EE"/><path d="M23.2 4.2v3.6a2 2 0 0 0 0-3.6z" fill="#F7F4EE" fill-opacity=".5"/></svg>
</span></div>`;

/* Brend qatori */
export const brandbar = (right = 'bell', dot = true) => `
<div class="appbar">
  <div class="brand"><img src="${LOGO}"><span>NFCSTORE</span></div>
  <div class="iconbtn">${svg(right)}${dot ? '<i class="dot"></i>' : ''}</div>
</div>`;

/* Orqaga + sarlavha */
export const backbar = (title, right = '') => `
<div class="appbar">
  <div class="iconbtn">${svg('chevL')}</div>
  <div class="mid">${title}</div>
  ${right ? `<div class="iconbtn">${svg(right)}</div>` : '<div style="width:38px"></div>'}
</div>`;

/* NFC yoylari — kartada va to'lqin animatsiyasida */
export const arcs = () => `
<svg class="arcs" viewBox="0 0 230 230">
  <circle cx="230" cy="230" r="78"/><circle cx="230" cy="230" r="108"/>
  <circle cx="230" cy="230" r="138"/><circle cx="230" cy="230" r="168"/></svg>`;

/* Oltin (yoki boshqa metall) karta */
export const card = ({ tier = 'gold', code = 'GLD 777', who = 'Dilshod Karimov', label = 'Gold member' } = {}) => `
<div class="card ${tier}">
  ${arcs()}
  <div class="face">
    <div class="top">
      <div class="b"><img src="${LOGO}"><b>NFCSTORE</b></div>
      ${svg('wave3')}
    </div>
    <div>
      <div class="code">${code}</div>
      <div class="who">${who}</div>
      <div class="tier">${label}</div>
    </div>
  </div>
</div>`;

/* Monogram avatar — foto yo'q foydalanuvchi uchun ham premium ko'rinish */
export const mono = (name, size = 56, hue = 0) => {
  const ch = name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const bgs = ['linear-gradient(145deg,#2A2520,#15120F)','linear-gradient(145deg,#2E2419,#171310)',
               'linear-gradient(145deg,#26251F,#131311)','linear-gradient(145deg,#2C2320,#181311)',
               'linear-gradient(145deg,#232821,#121412)'];
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bgs[hue % 5]};
    display:grid;place-items:center;font-family:'Instrument Serif',serif;font-size:${size * .4}px;
    color:var(--ink-gold);letter-spacing:.5px">${ch}</div>`;
};

/* Pastki navigatsiya */
export const nav = (active = 'home') => {
  const it = (k, ic, lb) => `<div class="it ${active === k ? 'on' : ''}">${svg(ic)}<b>${lb}</b></div>`;
  return `<div class="nav">
    ${it('home', 'home', 'Asosiy')}${it('search', 'search', 'Qidiruv')}
    <div class="fab"><div class="d"><img src="${LOGO}"></div><b>NFC</b></div>
    ${it('reels', 'reels', 'Reels')}${it('profile', 'user', 'Profil')}
  </div><div class="homebar"></div>`;
};

/* Ro'yxat qatori */
export const row = ({ ic, title, sub = '', end = '', chev = true }) => `
<div class="row">
  ${ic ? `<div class="ic">${svg(ic)}</div>` : ''}
  <div class="tx"><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</div>
  ${end ? `<div class="end">${end}</div>` : ''}
  ${chev ? '<div class="chev">›</div>' : ''}
</div>`;

export const verif = () => `<span class="verif">${svg('check')}</span>`;
