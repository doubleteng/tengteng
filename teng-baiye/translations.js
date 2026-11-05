'use strict';
(() => {
  const data = window.ARCHIVE_TRANSLATIONS;
  if (!data) return;
  const names = {EN:'英文',DE:'德文',FR:'法文',JA:'日文',KO:'韩文',IT:'意大利文',ES:'西班牙文',SV:'瑞典文',NL:'荷兰文',CS:'捷克文',PL:'波兰文'};
  const norm = s => s.replace(/\s+/g, ' ').trim();
  const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const reEscape = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const phrasePattern = new RegExp(data.phraseKeys.filter(k=>k.length>2).map(k=>
    (/[A-Za-z]/.test(k[0])?'(?<![A-Za-z])':'')+reEscape(k)+(/[A-Za-z]/.test(k.at(-1))?'(?![A-Za-z])':'')).join('|'),'g');
  function translate(original) {
    const key = norm(original);
    if (!key || key.length > 4000 || /^https?:\/\//.test(key)) return null;
    if (data.entries[key]) return {...data.entries[key], original};
    let languages=new Set(), changed=false, kinds=new Set();
    let zh=key.replace(phrasePattern,match=>{const x=data.entries[match];if(!x)return match;changed=true;languages.add(x.language);kinds.add(x.kind);return x.zh;});
    // Recurring catalogue and platform syntax; identifiers themselves stay verbatim.
    const before=zh;
    zh=zh.replace(/ : Free Download, Borrow, and Streaming : /g,'：免费下载、借阅与在线阅读：')
      .replace(/\bFree Download, Borrow, and Streaming\b/g,'免费下载、借阅与在线阅读')
      .replace(/\bExhibitions\b/g,'展览').replace(/\bExhibition History\b/g,'展览经历')
      .replace(/\bVol (\d+) Iss (\d+)\b/g,'第$1卷第$2期')
      .replace(/\bFile:/g,'文件：').replace(/\bPhoto:/g,'摄影：')
      .replace(/\bPage (\d+) —/g,'第$1页——')
      .replace(/\b(\d+) items \((\d+) leaves\)/g,'$1件（$2叶）');
    if(before!==zh){changed=true;languages.add('EN');}
    if(!changed || zh===key)return null;
    return {zh,original,language:[...languages].join('/'),kind:kinds.size===1&&kinds.has('label')?'label':'translation'};
  }
  function label(code){return (code||'EN').split('/').map(c=>names[c]||'外文').filter((v,i,a)=>a.indexOf(v)===i).join('、');}
  function make(original, zh, code='EN', kind='translation'){
    const span=document.createElement('span');span.className='archive-translation';
    span.dataset.original=original;span.dataset.language=code;span.dataset.translationKind=kind;
    const translated=document.createElement('span');translated.className='translation-zh';translated.textContent=zh;
    const source=document.createElement('span');source.className='translation-original';source.textContent=original;
    source.lang=(code||'EN').split('/')[0].toLowerCase();span.append(translated,source);
    if(kind==='translation'){
      span.tabIndex=0;
      const mark=document.createElement('span');mark.className='translation-mark';mark.textContent='译自'+label(code);
      mark.setAttribute('aria-hidden','true');span.append(mark);
      span.setAttribute('aria-label',zh+'；译自'+label(code)+'。聚焦或点击查看原文。');
    }
    return span;
  }
  const skip='script,style,code,pre,textarea,input,option,noscript,.archive-translation,#translation-tooltip,#language,#reader-lang,[data-no-translation],.brand,.latin,.footer-title';
  function sourceLanguage(node,fallback){
    const context=node.parentElement?.closest('[data-source-language]')?.dataset.sourceLanguage;
    const codes=(context||'').split('/').filter(c=>names[c]);
    return fallback==='EN'&&codes.length===1?codes[0]:fallback;
  }
  function localize(root=document.body){
    if(!root || root.nodeType!==1 || root.closest(skip))return;
    if(root.matches('body') && location.pathname.includes('/catalogue/')){
      root.querySelectorAll('tbody tr').forEach(row=>{
        const item=data.workTitles?.[row.cells[0]?.textContent.trim()], cell=row.cells[1];
        if(item&&cell&&!cell.querySelector('.archive-translation'))cell.replaceChildren(make(item.original,item.zh,item.language));
      });
    }
    const nodes=[];
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(n){
      return n.parentElement?.closest(skip)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;
    }});
    while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes){
      if(!node.parentNode)continue;
      const raw=node.textContent, key=norm(raw), exact=data.entries[key] || (!/[\u3400-\u9fff]/.test(key)?translate(raw):null);
      if(exact){
        node.replaceWith(document.createTextNode(raw.match(/^\s*/)[0]),make(raw.trim(),exact.zh,sourceLanguage(node,exact.language),exact.kind),document.createTextNode(raw.match(/\s*$/)[0]));
        continue;
      }
      // Keep each translated phrase tied to that foreign phrase, even within a Chinese paragraph.
      // A Chinese editorial paragraph is never presented as if it were an original foreign quotation.
      const parts=[];let last=0;
      phrasePattern.lastIndex=0;
      for(const match of raw.matchAll(phrasePattern)){
        const entry=data.entries[match[0]];if(!entry)continue;
        let zh=entry.zh;const after=match.index+match[0].length;
        if(raw[match.index-1]==='《'&&raw[after]==='》'&&zh.startsWith('《')&&zh.endsWith('》'))zh=zh.slice(1,-1);
        parts.push(document.createTextNode(raw.slice(last,match.index)),make(match[0],zh,sourceLanguage(node,entry.language),entry.kind));last=after;
      }
      if(parts.length){parts.push(document.createTextNode(raw.slice(last)));node.replaceWith(...parts);}
    }
  }
  // Original strings stay in the source data; the Chinese reading layer adds the translation.
  window.ArchiveTranslation={translate,localize,html(original,zh,code='EN'){
    return `<span class="archive-translation" data-original="${escape(original)}" data-language="${escape(code)}" data-translation-kind="translation" tabindex="0" aria-label="${escape(zh)}；译自${label(code)}。聚焦或点击查看原文。"><span class="translation-zh">${escape(zh)}</span><span class="translation-original" lang="${escape(code.toLowerCase())}">${escape(original)}</span><span class="translation-mark" aria-hidden="true">译自${label(code)}</span></span>`;
  }};

  let tip,active=null,pinned=false,hideTimer;
  const chinese=()=>!document.documentElement.lang.toLowerCase().startsWith('en');
  function hide(){clearTimeout(hideTimer);if(active)active.removeAttribute('aria-describedby');active=null;pinned=false;if(tip){if(tip.hidePopover&&tip.matches(':popover-open'))tip.hidePopover();tip.hidden=true;}}
  function show(el,pin=false){
    if(!chinese()||el.dataset.translationKind!=='translation')return;
    clearTimeout(hideTimer);if(active&&active!==el)active.removeAttribute('aria-describedby');active=el;pinned=pin;
    if(!tip){
      tip=document.createElement('div');tip.id='translation-tooltip';tip.role='tooltip';tip.setAttribute('popover','manual');
      tip.innerHTML='<div class="translation-tooltip-head"></div><div class="translation-tooltip-text"></div><button type="button" class="translation-tooltip-close" aria-label="关闭原文">×</button>';
      document.body.append(tip);tip.querySelector('button').addEventListener('click',hide);
      tip.addEventListener('pointerenter',()=>clearTimeout(hideTimer));
      tip.addEventListener('pointerleave',()=>{if(!pinned)hideTimer=setTimeout(hide,180);});
    }
    tip.querySelector('.translation-tooltip-head').textContent=label(el.dataset.language)+'原文';
    const text=tip.querySelector('.translation-tooltip-text');text.textContent=el.dataset.original;text.lang=el.dataset.language.split('/')[0].toLowerCase();
    el.setAttribute('aria-describedby',tip.id);tip.hidden=false;
    if(tip.showPopover && !tip.matches(':popover-open'))tip.showPopover();
    const rect=el.getBoundingClientRect(), width=Math.min(620,innerWidth-24);
    tip.style.width=width+'px';tip.style.left=Math.max(12,Math.min(rect.left,innerWidth-width-12))+'px';
    const height=tip.getBoundingClientRect().height;
    tip.style.top=(rect.bottom+height+16<innerHeight?rect.bottom+8:Math.max(12,rect.top-height-8))+'px';
  }
  document.addEventListener('pointerover',e=>{const el=e.target.closest('.archive-translation[data-translation-kind="translation"]');if(el&&(!active||!pinned))show(el);});
  document.addEventListener('pointerout',e=>{if(active&&!pinned&&!active.contains(e.relatedTarget)&&!tip?.contains(e.relatedTarget))hideTimer=setTimeout(hide,180);});
  document.addEventListener('focusin',e=>{const el=e.target.closest('.archive-translation[data-translation-kind="translation"]');if(el)show(el);});
  document.addEventListener('focusout',e=>{if(active&&!pinned&&!tip?.contains(e.relatedTarget))hideTimer=setTimeout(hide,180);});
  document.addEventListener('click',e=>{
    const el=e.target.closest('.archive-translation[data-translation-kind="translation"]');
    if(el&&chinese()){
      // Links and artwork cards still open normally; their small translation label opens the original.
      if(e.target.closest('.translation-mark') || !el.closest('a,button') || matchMedia('(hover: none)').matches){e.preventDefault();e.stopPropagation();active===el&&pinned?hide():show(el,true);}
    }else if(!e.target.closest('#translation-tooltip'))hide();
  },true);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&active){e.preventDefault();e.stopPropagation();hide();}
    if((e.key==='Enter'||e.key===' ')&&e.target.matches('.archive-translation')){e.preventDefault();e.stopPropagation();show(e.target,true);}
  },true);
  window.addEventListener('scroll',()=>{if(active)hide();},true);
  window.addEventListener('resize',hide);
  const pending=new Set();let scheduled=false;
  const observer=new MutationObserver(records=>{
    for(const r of records){
      if(r.type==='attributes'){hide();localizeTitle();syncLanguage();continue;}
      if(r.target.nodeType===1&&r.target.closest('.archive-translation,#translation-tooltip'))continue;
      for(const n of r.addedNodes){const el=n.nodeType===1?n:n.parentElement;if(el&&!el.closest(skip))pending.add(el);}
    }
    if(pending.size&&!scheduled){scheduled=true;queueMicrotask(()=>{scheduled=false;const roots=[...pending];pending.clear();roots.forEach(localize);syncLanguage();});}
  });
  function syncLanguage(){
    document.querySelectorAll('.archive-translation[data-translation-kind="translation"]').forEach(el=>{
      if(chinese()){
        el.tabIndex=0;
        el.setAttribute('aria-label',el.querySelector('.translation-zh').textContent+'；译自'+label(el.dataset.language)+'。聚焦或点击查看原文。');
      }else{
        el.removeAttribute('tabindex');el.removeAttribute('aria-describedby');el.setAttribute('aria-label',el.dataset.original);
      }
    });
  }
  const pageOriginalTitle=document.title;
  function localizeTitle(){const translated=translate(pageOriginalTitle);if(translated)document.title=chinese()?translated.zh:pageOriginalTitle;}
  function start(){localizeTitle();localize(document.body);syncLanguage();observer.observe(document.body,{childList:true,subtree:true});observer.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
