// Umumiy ekran-generator. Tuzilma `body[data-variant]` orqali o'zgaradi (CSS + bir nechta DOM shoxlari).
(function () {
  const qs = new URLSearchParams(location.search);
  const lang = ['uz', 'ru', 'en'].includes(qs.get('lang')) ? qs.get('lang') : 'uz';
  const only = qs.get('screen');
  const T = window.NFC_I18N[lang];
  const V = document.body.dataset.variant; // v1|v2|v3|v4
  document.documentElement.lang = lang;

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const icon = (n) => ({
    nfc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 8.5a8 8 0 0 1 12 0M8.5 11.5a4.5 4.5 0 0 1 7 0M12 15.5v.01"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>',
    tg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 4 3 11l6 2 2 6 3-4 5 3z"/></svg>',
    ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v3h16v-3"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.6m-7.6 7 7.6 4.6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m5 12 5 5L20 7"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V10m6 10V4m6 16v-7m4 7H2"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 8h12l1 13H5zM9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4m8-4v4"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 2.9 6.6 7.1.6-5.4 4.7 1.7 7.1L12 17.3 5.7 21l1.7-7.1L2 9.2l7.1-.6z"/></svg>',
  }[n] || '');

  const nfcCard = (code, name, cls = '') => `
    <div class="nfc-card ${cls}">
      <div class="nfc-card__top"><span class="nfc-card__brand">NFCSTORE</span><span class="nfc-card__chip">${icon('nfc')}</span></div>
      <div class="nfc-card__code">${esc(code)}</div>
      <div class="nfc-card__bottom"><span class="nfc-card__name">${esc(name)}</span><span class="nfc-card__since">MEMBER SINCE 2026</span></div>
    </div>`;

  const langSwitch = () => `<div class="lang">${['uz', 'ru', 'en'].map((l) => `<a href="?lang=${l}${only ? '&screen=' + only : ''}" class="${l === lang ? 'is-on' : ''}">${l.toUpperCase()}</a>`).join('')}</div>`;

  const topnav = (cta = true) => `
    <header class="topnav">
      <a class="brand" href="#"><span class="brand__mark">N</span><span class="brand__name">NFCSTORE</span></a>
      <nav class="topnav__links">${T.nav.map((n) => `<a href="#">${esc(n)}</a>`).join('')}</nav>
      <div class="topnav__right">${langSwitch()}<a class="btn btn--ghost" href="#">${esc(T.login)}</a>${cta ? `<a class="btn btn--primary" href="#">${esc(T.cta)}</a>` : ''}<button class="topnav__burger" aria-label="menu">${icon('menu')}</button></div>
    </header>`;

  const footer = () => `
    <footer class="footer">
      <div class="footer__brand"><span class="brand__mark">N</span> NFCSTORE<p>${esc(T.heroKicker)}</p></div>
      ${T.footer.map((h, i) => `<div><h5>${esc(h)}</h5>${[[T.nav[0], T.nav[1], T.nav[3]], [T.nav[2], T.nav[4], 'Aloqa'], ['Terms', 'Privacy']][i].map((x) => `<a href="#">${esc(x)}</a>`).join('')}</div>`).join('')}
      <div class="footer__copy">© 2026 NFCSTORE</div>
    </footer>`;

  // ───────── 1. HOME
  const home = () => `
  <section class="screen screen--home" id="home">
    ${topnav()}
    <section class="hero">
      <div class="hero__text">
        <span class="kicker">${esc(T.heroKicker)}</span>
        <h1>${esc(T.heroTitle)}</h1>
        <p class="lead">${esc(T.heroText)}</p>
        <div class="hero__cta"><a class="btn btn--primary btn--lg" href="#">${esc(T.cta)}</a><a class="btn btn--ghost btn--lg" href="#">${esc(T.cta2)}</a></div>
        <ul class="hero__bul">${T.heroBul.map((b) => `<li>${icon('check')}${esc(b)}</li>`).join('')}</ul>
        <form class="idcheck" onsubmit="return false"><label>${esc(T.checkLabel)}</label><div class="idcheck__row"><span class="idcheck__prefix">nfcstore.uz/</span><input value="ABZ007" aria-label="NFC ID"><button class="btn btn--primary btn--icon" aria-label="check">${icon('search')}</button></div></form>
      </div>
      <div class="hero__visual">${nfcCard('AAA 000', 'SIZNING ISMINGIZ', 'nfc-card--hero')}<div class="hero__glow"></div><div class="hero__tag hero__tag--a">${icon('nfc')} NFC TAP</div><div class="hero__tag hero__tag--b">${icon('bolt')} 0.3s</div></div>
    </section>

    <section class="section who">
      <h2 class="h2">${esc(T.who)}</h2>
      <div class="who__grid">
        <article class="card who__card who__card--p"><span class="who__ic">${icon('user')}</span><h3>${esc(T.whoP)}</h3><p>${esc(T.whoPd)}</p><a class="btn btn--primary" href="#">${esc(T.whoBtnP)}</a></article>
        <article class="card who__card who__card--c"><span class="who__ic">${icon('bag')}</span><h3>${esc(T.whoC)}</h3><p>${esc(T.whoCd)}</p><a class="btn btn--secondary" href="#">${esc(T.whoBtnC)}</a></article>
      </div>
    </section>

    <section class="section how">
      <h2 class="h2">${esc(T.how)}</h2>
      <ol class="how__steps">${T.steps.map(([h, p], i) => `<li class="card"><span class="how__n">0${i + 1}</span><h3>${esc(h)}</h3><p>${esc(p)}</p></li>`).join('')}</ol>
    </section>

    <section class="section plans">
      <h2 class="h2">${esc(T.plans)}</h2>
      <div class="plans__grid">
        ${[[T.planFree, '0', T.perOnce, T.planFreeF, ''], [T.planPro, '20 000', T.perOnce, T.planProF, 'is-pop'], [T.planBiz, '199 000', T.perMonth, T.planBizF, '']].map(([n, p, per, f, c]) => `
        <article class="card plan ${c}">${c ? `<span class="plan__pop">${esc(T.popular)}</span>` : ''}<h3>${esc(n)}</h3><div class="plan__price"><b>${p}</b> <small>so‘m ${esc(per)}</small></div><ul>${f.map((x) => `<li>${icon('check')}${esc(x)}</li>`).join('')}</ul><a class="btn ${c ? 'btn--primary' : 'btn--secondary'}" href="#">${esc(T.choose)}</a></article>`).join('')}
      </div>
    </section>

    <section class="section trust"><h2 class="h2">${esc(T.trust)}</h2><div class="trust__row">${T.trustItems.map(([h, p]) => `<div class="trust__item"><b>${esc(h)}</b><span>${esc(p)}</span></div>`).join('')}</div></section>

    <section class="section faq"><h2 class="h2">${esc(T.faq)}</h2><div class="faq__list">${T.faqs.map(([q, a], i) => `<details class="card" ${i === 0 ? 'open' : ''}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></section>
    ${footer()}
  </section>`;

  // ───────── 2. PERSONAL PUBLIC PROFILE
  const profile = () => `
  <section class="screen screen--profile" id="profile">
    <div class="phone-stage">
      <div class="pub">
        <div class="pub__top"><a class="pub__back" href="#">‹ NFCSTORE</a><span class="pub__id">nfcstore.uz/vip001</span>${langSwitch()}</div>
        <div class="pub__cover"></div>
        <div class="pub__avatar"><img src="data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><radialGradient id="g" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="#f3d9a4"/><stop offset="1" stop-color="#8a5a2b"/></radialGradient></defs><rect width="100" height="100" fill="url(#g)"/><circle cx="50" cy="40" r="18" fill="#2b1d12"/><ellipse cx="50" cy="90" rx="32" ry="26" fill="#2b1d12"/></svg>')}" alt=""></div>
        <h1 class="pub__name">Muhammad <span class="verified" title="verified">${icon('check')}</span></h1>
        <div class="pub__role">${esc(T.role)}</div>
        <span class="badge badge--gold">${icon('star')} EKSLYUZIV</span>
        <p class="pub__bio">${esc(T.bio)}</p>
        <div class="pub__stats"><div><b>1 284</b><span>${esc(T.views)}</span></div><div><b>212</b><span>${esc(T.followers)}</span></div><div><b>11 kun</b><span>${esc(T.since)}</span></div></div>
        <div class="pub__actions"><button class="btn btn--secondary btn--sm">${esc(T.follow)}</button><button class="btn btn--ghost btn--sm">${icon('share')} ${esc(T.share)}</button></div>
        <div class="tabs"><button class="is-on">${esc(T.tabs[0])}</button><button>${esc(T.tabs[1])}</button></div>
        <div class="pub__links">
          <a class="link" href="#">${icon('phone')}<span>${esc(T.call)}</span></a>
          <a class="link" href="#">${icon('tg')}<span>Telegram</span></a>
          <a class="link" href="#">${icon('ig')}<span>Instagram</span></a>
          <a class="link" href="#">${icon('pin')}<span>${esc(T.map)}</span></a>
          <a class="link" href="#">${icon('globe')}<span>davlatsudekspert.uz</span></a>
        </div>
        <a class="btn btn--primary btn--lg btn--block pub__save" href="#">${icon('dl')} ${esc(T.save)}</a>
        <div class="pub__foot">Powered by <b>NFCSTORE</b></div>
      </div>
    </div>
  </section>`;

  // ───────── 3. PERSONAL DASHBOARD
  const dnavIcons = ['home', 'user', 'phone', 'grid', 'nfc', 'chart', 'gear'];
  const dashboard = () => `
  <section class="screen screen--dash" id="dashboard">
    ${topnav(false)}
    <div class="dash">
      <aside class="dash__nav"><div class="dash__me"><span class="avatar avatar--sm">M</span><div><b>Muhammad</b><small>VIP001 · ${esc(T.labels.primary)}</small></div></div>
        <nav>${T.dnav.map((n, i) => `<a href="#" class="${i === 1 ? 'is-on' : ''}">${icon(dnavIcons[i])}<span>${esc(n)}</span></a>`).join('')}</nav></aside>
      <main class="dash__main">
        <div class="dash__head"><div><span class="kicker">${esc(T.dashSub)}</span><h1>${esc(T.dnav[1])}</h1></div>
          <div class="dash__headr"><span class="unsaved">● ${esc(T.unsaved)}</span><button class="btn btn--primary">${esc(T.saveBtn)}</button></div></div>
        <div class="progress"><div class="progress__bar"><i style="width:64%"></i></div><span>${esc(T.completion)} · <b>64%</b></span></div>
        <div class="stats">${T.stats.map(([l, v]) => `<div class="stat card"><b>${v}</b><span>${esc(l)}</span></div>`).join('')}</div>
        <ol class="steps">${T.dsteps.map(([h, p], i) => `<li class="card step ${i < 4 ? 'is-done' : ''} ${i === 4 ? 'is-cur' : ''}"><span class="step__n">${i < 4 ? icon('check') : i + 1}</span><div><b>${esc(h)}</b><small>${esc(p)}</small></div><span class="step__st">${i < 4 ? esc(T.done) : esc(T.todo)}</span></li>`).join('')}</ol>
        <form class="form card" onsubmit="return false">
          <h3>${esc(T.dsteps[0][0])}</h3>
          <div class="form__row"><label>${esc(T.nameL)}<input value="Muhammad"></label><label>${esc(T.roleL)}<input value="${esc(T.role)}"></label></div>
          <label>${esc(T.bioL)}<textarea rows="3">${esc(T.bio)}</textarea></label>
          <div class="form__row"><label>${esc(T.phoneL)}<input value="+998 90 123 45 67"><small class="hint">${icon('lock')} ${esc(T.dsteps[6][1])}</small></label><label>${esc(T.tgL)}<input value="@muhammad"></label></div>
          <div class="form__actions"><button class="btn btn--primary">${esc(T.saveBtn)}</button><span class="ok">${icon('check')} ${esc(T.saved)} · 14:02</span></div>
        </form>
      </main>
      <aside class="dash__preview"><div class="phone"><div class="phone__screen">
        <div class="mini"><div class="mini__avatar">M</div><b>Muhammad</b><small>${esc(T.role)}</small>
        <div class="mini__links"><span>${icon('phone')} ${esc(T.call)}</span><span>${icon('tg')} Telegram</span><span>${icon('ig')} Instagram</span></div>
        <span class="btn btn--primary btn--sm btn--block">${esc(T.save)}</span></div>
      </div></div><p class="muted center">${esc(T.preview)}</p></aside>
      <nav class="bottomnav">${T.dnav.slice(0, 5).map((n, i) => `<a href="#" class="${i === 1 ? 'is-on' : ''}">${icon(dnavIcons[i])}<span>${esc(n)}</span></a>`).join('')}</nav>
    </div>
  </section>`;

  // ───────── 4. COMPANY DASHBOARD
  const cnavIcons = ['home', 'bag', 'grid', 'cal', 'pin', 'user', 'chart', 'bolt', 'gear'];
  const company = () => `
  <section class="screen screen--company" id="company">
    ${topnav(false)}
    <div class="dash dash--company">
      <aside class="dash__nav"><div class="dash__me"><span class="avatar avatar--sm avatar--sq">EQ</span><div><b>${esc(T.cname)}</b><small>company/elite · <span class="badge badge--ok">${esc(T.statuses[0])}</span></small></div></div>
        <nav>${T.cnav.map((n, i) => `<a href="#" class="${i === 0 ? 'is-on' : ''}">${icon(cnavIcons[i])}<span>${esc(n)}</span></a>`).join('')}</nav></aside>
      <main class="dash__main">
        <div class="dash__head"><div><span class="kicker">${esc(T.cdash)}</span><h1>${esc(T.cnav[0])}</h1></div><div class="dash__headr"><button class="btn btn--secondary">${icon('share')} ${esc(T.share)}</button><button class="btn btn--primary">${esc(T.addItem)}</button></div></div>
        <div class="stats stats--4">${T.cstats.map(([l, v]) => `<div class="stat card"><b>${v}</b><span>${esc(l)}</span></div>`).join('')}</div>
        <div class="two">
          <section class="card"><div class="card__head"><h3>${esc(T.catalog)}</h3><a href="#" class="muted">${esc(T.view)} →</a></div>
            <ul class="list">${T.items.map(([n, p]) => `<li><span class="thumb"></span><div><b>${esc(n)}</b><small>${esc(p)}</small></div><span class="badge badge--ok">${esc(T.statuses[0])}</span></li>`).join('')}</ul></section>
          <section class="card"><div class="card__head"><h3>${esc(T.bookings)}</h3><a href="#" class="muted">${esc(T.view)} →</a></div>
            <div class="table-wrap"><table class="table"><thead><tr><th>${esc(T.atable[1])}</th><th>${esc(T.catalog)}</th><th>${esc(T.status)}</th></tr></thead><tbody>${T.bookRows.map(([a, b, c], i) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td><td><span class="badge ${['badge--info', 'badge--ok', 'badge--muted'][i]}">${esc(c)}</span></td></tr>`).join('')}</tbody></table></div></section>
        </div>
      </main>
      <nav class="bottomnav">${T.cnav.slice(0, 5).map((n, i) => `<a href="#" class="${i === 0 ? 'is-on' : ''}">${icon(cnavIcons[i])}<span>${esc(n)}</span></a>`).join('')}</nav>
    </div>
  </section>`;

  // ───────── 5. COMPANY PUBLIC
  const companyPublic = () => `
  <section class="screen screen--cpub" id="company-public">
    <div class="cpub">
      <div class="cpub__hero"><div class="cpub__heroin">
        <span class="avatar avatar--lg avatar--sq">EQ</span>
        <div><span class="badge badge--gold">${icon('check')} ${esc(T.cpubTag)}</span><h1>${esc(T.cname)}</h1><p>${esc(T.items[0][0])} · Toshkent</p></div>
        <div class="cpub__btns">${T.cpubBtns.map((b, i) => `<a class="btn ${i === 3 ? 'btn--primary' : 'btn--secondary'}" href="#">${icon(['phone', 'tg', 'pin', 'cal'][i])} ${esc(b)}</a>`).join('')}</div>
      </div></div>
      <div class="cpub__body">
        <section class="card"><h3>${esc(T.cpubAbout)}</h3><p>${esc(T.cpubAboutT)}</p></section>
        <section><h3 class="h3">${esc(T.catalog)}</h3><div class="cgrid">${T.items.map(([n, p]) => `<article class="card citem"><span class="thumb thumb--lg"></span><b>${esc(n)}</b><small>${esc(p)}</small></article>`).join('')}</div></section>
        <div class="two">
          <section class="card"><h3>${esc(T.branches)}</h3><ul class="list list--plain"><li>${icon('pin')} Chilonzor, Bunyodkor 12</li><li>${icon('pin')} Yunusobod, Amir Temur 108</li></ul></section>
          <section class="card"><h3>${esc(T.team)}</h3><div class="avatars"><span class="avatar">A</span><span class="avatar">D</span><span class="avatar">S</span><span class="avatar avatar--more">+6</span></div></section>
        </div>
      </div>
    </div>
  </section>`;

  // ───────── 6. ADMIN
  const anavIcons = ['home', 'user', 'bag', 'nfc', 'cal', 'bolt', 'grid', 'gear'];
  const admin = () => `
  <section class="screen screen--admin" id="admin">
    <div class="adm">
      <aside class="adm__nav"><div class="brand"><span class="brand__mark">N</span> ${esc(T.admin)}</div><nav>${T.anav.map((n, i) => `<a href="#" class="${i === 0 ? 'is-on' : ''}">${icon(anavIcons[i])}<span>${esc(n)}</span></a>`).join('')}</nav><div class="adm__me"><span class="avatar avatar--sm">SA</span><small>super_admin</small></div></aside>
      <main class="adm__main">
        <div class="adm__bar"><label class="search">${icon('search')}<input placeholder="${esc(T.search)}"></label>${langSwitch()}<span class="badge badge--ok">● live</span></div>
        <h1>${esc(T.anav[0])}</h1>
        <div class="stats stats--4">${T.akpi.map(([l, v, d]) => `<div class="stat card"><span>${esc(l)}</span><b>${v}</b><small class="delta">${esc(d)}</small></div>`).join('')}</div>
        <section class="card"><div class="card__head"><h3>${esc(T.aorders)}</h3><div class="chips"><span class="chip is-on">${esc(T.statuses[0])}</span><span class="chip">${esc(T.statuses[1])}</span><span class="chip">${esc(T.statuses[3])}</span></div></div>
          <div class="table-wrap"><table class="table"><thead><tr>${T.atable.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${T.arows.map(([id, u, a, s], i) => `<tr><td><code>${id}</code></td><td>${esc(u)}</td><td>${a} so‘m</td><td><span class="badge ${['badge--ok', 'badge--warn', 'badge--muted'][i]}">${esc(s)}</span></td><td><button class="btn btn--ghost btn--xs">${esc(T.view)}</button> <button class="btn btn--secondary btn--xs">${esc(T.confirm)}</button></td></tr>`).join('')}</tbody></table></div>
          <div class="pager"><span>1–20 / 412</span><button class="btn btn--ghost btn--xs">‹</button><button class="btn btn--ghost btn--xs">›</button></div></section>
      </main>
      <nav class="bottomnav">${T.anav.slice(0, 5).map((n, i) => `<a href="#" class="${i === 0 ? 'is-on' : ''}">${icon(anavIcons[i])}<span>${esc(n)}</span></a>`).join('')}</nav>
    </div>
  </section>`;

  // ───────── 7. PAYME
  const paymeLogo = `<span class="payme"><i>P</i>ayme</span>`;
  const payme = () => `
  <section class="screen screen--payme" id="payme">
    <div class="pay">
      <div class="card pay__card">
        <div class="pay__head"><h2>${esc(T.payTitle)}</h2>${paymeLogo}</div>
        <div class="pay__order"><small>${esc(T.payOrder)} #10412</small><b>${esc(T.payItem)}</b>${nfcCard('VIP 001', 'MUHAMMAD', 'nfc-card--mini')}</div>
        <div class="pay__amount"><span>${esc(T.payAmount)}</span><b>199 000 <small>so‘m</small></b></div>
        <button class="btn btn--payme btn--lg btn--block">${paymeLogo} ${esc(T.payBtn)}</button>
        <p class="muted small">${esc(T.payNote)}</p>
        <div class="pay__secure">${icon('lock')} ${esc(T.paySecure)}</div>
      </div>
      <div class="pay__states">${T.payStates.map((s, i) => `<div class="card pay__state pay__state--${['pending', 'processing', 'success', 'cancel', 'fail'][i]}"><span class="dot"></span><b>${esc(s)}</b>${i === 2 ? `<small>${esc(T.payAfter)}</small>` : ''}</div>`).join('')}</div>
    </div>
  </section>`;

  // ───────── 8. NEWS
  const news = () => `
  <section class="screen screen--news" id="news">
    ${topnav()}
    <div class="newsp">
      <div class="newsp__head"><h1>${esc(T.news)}</h1><div class="chips"><span class="chip is-on">${esc(T.allNews)}</span>${T.newsItems.map((n) => `<span class="chip">${esc(n[1])}</span>`).join('')}</div></div>
      <div class="newsp__grid">
        <article class="card news news--lead"><span class="thumb thumb--cover"></span><div class="news__body"><span class="badge badge--info">${esc(T.newsItems[0][1])}</span><h2>${esc(T.newsItems[0][0])}</h2><p>${esc(T.newsItems[0][3])}</p><div class="news__meta"><span>${esc(T.author)}</span><span>${esc(T.newsItems[0][2])}</span><a href="#">${esc(T.readMore)} →</a></div></div></article>
        ${T.newsItems.slice(1).map((n) => `<article class="card news"><span class="thumb thumb--cover"></span><div class="news__body"><span class="badge badge--muted">${esc(n[1])}</span><h3>${esc(n[0])}</h3><p>${esc(n[3])}</p><div class="news__meta"><span>${esc(n[2])}</span><a href="#">${esc(T.readMore)} →</a></div></div></article>`).join('')}
      </div>
    </div>
  </section>`;

  // ───────── 9. COMPONENTS
  const components = () => `
  <section class="screen screen--comp" id="components">
    <div class="comp">
      <h1>${esc(T.comp)}</h1>
      <div class="comp__grid">
        <div class="card"><h3>Buttons</h3><div class="row"><button class="btn btn--primary">${esc(T.btnP)}</button><button class="btn btn--secondary">${esc(T.btnS)}</button><button class="btn btn--ghost">${esc(T.btnG)}</button><button class="btn btn--danger">${esc(T.btnD)}</button></div><div class="row"><button class="btn btn--primary btn--sm">sm</button><button class="btn btn--primary">md</button><button class="btn btn--primary btn--lg">lg</button><button class="btn btn--primary" disabled>disabled</button></div></div>
        <div class="card"><h3>Status</h3><div class="row">${T.statuses.map((s, i) => `<span class="badge ${['badge--ok', 'badge--warn', 'badge--info', 'badge--muted', 'badge--muted'][i]}">${esc(s)}</span>`).join('')}<span class="badge badge--gold">${icon('star')} Premium</span></div></div>
        <form class="card form" onsubmit="return false"><h3>${esc(T.formT)}</h3><label>${esc(T.nameL)}<input placeholder="Muhammad"></label><label>${esc(T.phoneL)}<input class="is-err" value="+998 9"><small class="err">Format: +998 XX XXX XX XX</small></label><label class="check"><input type="checkbox" checked> ${esc(T.heroBul[1])}</label><button class="btn btn--primary">${esc(T.saveBtn)}</button></form>
        <div class="card modal-demo"><div class="modal"><h3>${esc(T.modalT)}</h3><p>${esc(T.modalB)}</p><div class="modal__actions"><button class="btn btn--ghost">${esc(T.cancel)}</button><button class="btn btn--danger">${esc(T.del)}</button></div></div></div>
        <div class="card"><h3>${esc(T.cardT)}</h3>${nfcCard('ABZ 007', 'AZIZBEK', 'nfc-card--mini')}</div>
        <div class="card"><h3>${esc(T.tableT)}</h3><div class="table-wrap"><table class="table"><thead><tr><th>ID</th><th>${esc(T.status)}</th><th></th></tr></thead><tbody><tr><td><code>VIP001</code></td><td><span class="badge badge--ok">${esc(T.statuses[0])}</span></td><td><button class="btn btn--ghost btn--xs">${esc(T.edit)}</button></td></tr><tr><td><code>ZOZ707</code></td><td><span class="badge badge--warn">${esc(T.statuses[1])}</span></td><td><button class="btn btn--ghost btn--xs">${esc(T.edit)}</button></td></tr></tbody></table></div>
        <div class="card"><h3>Skeleton / empty</h3><div class="skel"></div><div class="skel skel--short"></div><div class="empty">${icon('grid')}<span>—</span></div></div>
      </div>
    </div>
  </section>`;

  const screens = { home, profile, dashboard, company, 'company-public': companyPublic, admin, payme, news, components };
  const order = ['home', 'profile', 'dashboard', 'company', 'company-public', 'admin', 'payme', 'news', 'components'];
  const labels = { home: '1 · ' + T.nav[0].replace(/.*/, 'Home'), profile: '2 · Public profile (personal)', dashboard: '3 · Personal dashboard', company: '4 · Company dashboard', 'company-public': '5 · Company public', admin: '6 · Admin', payme: '7 · Payme', news: '8 · News', components: '9 · Components' };
  const app = document.getElementById('app');
  app.innerHTML = (only && screens[only] ? [only] : order).map((k) => `<div class="frame"><div class="frame__label">${labels[k]}</div>${screens[k]()}</div>`).join('');
})();
