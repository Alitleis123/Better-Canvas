/* Synthetic dashboard for local browser testing. No school login or account data. */
(async () => {
  await auditReady;
  const s = BC.cloneDefaults();
  Object.assign(s.dashboard, { courseSearch: true, showInlineGrade: false, showProgressBar: false, showBadges: false, autoHideConcluded: false, layout: 'grid' });
  const style = document.createElement('style'); style.textContent = `
    *{box-sizing:border-box}body{margin:0;background:white;color:#333}a{text-decoration:none;color:inherit}
    .ic-app-header{position:fixed;inset:0 auto 0 0;width:88px;background:#19222c;z-index:5}#menu{display:block;padding:0;list-style:none}
    #menu a{display:block;padding:18px 5px;text-align:center;color:white;font-size:11px}#menu b{display:block;font-size:22px;margin-bottom:6px}
    #main{margin-left:88px;width:auto;padding:34px;display:flex;gap:30px}.ic-Layout-contentMain{flex:1;min-width:0;background:white}
    #right-side{width:290px;flex:none;padding-top:4px}.ic-Dashboard-header{position:sticky;top:0;z-index:5}.ic-Dashboard-header__layout{display:flex;justify-content:space-between;align-items:center;background:white}
    .ic-Dashboard-header__title{margin:0;font-size:32px} .ic-DashboardCard{background:white;border-radius:8px;overflow:hidden}
    .ic-DashboardCard__header_image{height:160px}.ic-DashboardCard__header_hero{height:100%;background:red;opacity:.6}
    .ic-DashboardCard__link{display:block}.ic-DashboardCard__header-title{margin:6px 0;font-size:16px;line-height:1.5}
    .ic-DashboardCard__header-subtitle{font-size:11px}.ic-DashboardCard__action-container{padding:14px 20px;font-size:14px;display:flex;gap:18px}
    #right-side h2{font-size:17px;margin:0 0 20px}#right-side p{padding:14px 0;margin:0;border-top:1px solid #8883;font-size:13px;line-height:1.7}
    #settings{display:none}#right-side .meta{font-size:11px;opacity:.6}
  `;document.head.append(style);
  document.querySelector('#menu').outerHTML='<header class="ic-app-header"><ul id="menu">'+['◈|Dashboard','▤|Courses','◷|Calendar','▱|Inbox','⚙|Settings'].map((x,i)=>{const[a,b]=x.split('|');return `<li class="ic-app-header__menu-list-item ${i?'':'ic-app-header__menu-list-item--active'}"><a class="ic-app-header__menu-list-link" href="#"><b>${a}</b><span class="menu-item__text">${b}</span></a></li>`}).join('')+'</ul></header>';
  const box=document.querySelector('#DashboardCard_Container');
  box.innerHTML=Array.from({length:32},(_,i)=>`<div class="ic-DashboardCard"><div class="ic-DashboardCard__header"><div class="ic-DashboardCard__header_image" style="background-image:linear-gradient(red,blue)"><div class="ic-DashboardCard__header_hero"></div></div><a class="ic-DashboardCard__link" href="/courses/${100+i*48}"><div class="ic-DashboardCard__header_content"><div class="ic-DashboardCard__header-subtitle">${['BIO 240','ART 210','CS 110','ENGL 270','COMM 375','SOC 232'][i%6]} · FALL SEMESTER</div><h3 class="ic-DashboardCard__header-title"><span>${['Ecology & the Environment','Visual Culture','Foundations of Computing','Creative Writing','Film & Media Studies','Statistical Analysis'][i%6]}</span></h3></div></a></div><div class="ic-DashboardCard__action-container"><span>▤</span><span>☷</span><span>♧</span><span>▱</span></div></div>`).join('');
  const content=document.createElement('section');content.className='ic-Layout-contentMain';content.innerHTML='<div class="ic-Dashboard-header"><div class="large ic-Dashboard-header__layout"><h1 class="ic-Dashboard-header__title">Dashboard</h1><span>Autumn semester</span></div></div>';document.querySelector('#main').prepend(content);content.append(box);
  const aside=document.querySelector('#right-side');aside.innerHTML='<section><h2>This week</h2><p>Read chapter 5<br><span class="meta">Ecology · Tomorrow</span></p><p>Visual analysis draft<br><span class="meta">Art · Wednesday</span></p><p>Finish project proposal<br><span class="meta">Computing · Friday</span></p></section><section><h2>Recent feedback</h2><p>Research reflection<br><span class="meta">Feedback available</span></p></section>';document.querySelector('#main').append(aside);
  window.sceneState=s;
  window.applyScene=(id)=>{BC.applyTheme(s,BC.PRESET_THEMES.find(p=>p.id===id));BC.features.theming.apply(s,{});BC.features.cosmetics.apply(s,{});BC.features.dashboard.apply(s,{page:'dashboard'});};
  s.todo.mode = 'custom';
  applyScene('anime-reverie'); await BC.storage.save(s, undefined, { replace: true });
  BC.applyNow = () => { const x = BC.storage.current; BC.features.theming.apply(x,{});BC.features.cosmetics.apply(x,{});BC.features.dashboard.apply(x,{page:'dashboard'}); };
  document.querySelector('#right-side section').classList.add('Sidebar__TodoListContainer');
  BC.features.settingsPanel.apply(); BC.features.settingsPanel.open('themes');
  return { errors: auditErrors, themes: BC.PRESET_THEMES.length };
})()