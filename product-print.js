(() => {
  'use strict';
  const L=window.Library,E=L.esc;
  const company=()=>L.company?.()||{id:'uniqmag',name:'UNIQMAG',logo:'assets/logo.png'};
  const fileLanguage=language=>L.documentLanguage?.normalize(language??window.LibraryPreferences?.language)||(/^en(?:$|[-_])/i.test(language??window.LibraryPreferences?.language??'')?'en':'zh-CN');
  const words={'产品资料':'Product information','产品资料库':'Product library','待确认':'To be confirmed','未提供':'Not provided','已发布':'Published','已下架':'Archived','待发布':'Pending publication','待发布修改':'Changes pending publication','内部草稿':'Internal draft','品牌':'Brand','当前配色':'Selected variant','SKU 货号':'SKU','完整技术规格':'Technical specifications','尚未录入规格。':'Specifications have not been provided.','包装资料':'Packaging information','当前配色尚未录入适用包装。':'Packaging information has not been provided for this variant.','待核实事项':'Items to verify','产品打印预览':'Product print preview'};
  const translate=(text,language)=>L.documentLanguage?.t(text,language)??(fileLanguage(language)==='en'?(words[text]??text):text);
  const pending=(flag,language)=>flag?`<span class="print-pending">${E(translate('待确认',language))}</span>`:'';
  const value=(text,language)=>E(text===null||text===undefined||String(text).trim()===''?translate('未提供',language):text);
  function photo(url,alt,language){return L.image(url,alt).replace('loading="lazy"','loading="eager"').replace('<span>图片待补充</span>',language==='en'?'<span>Image not provided</span>':'<span>图片待补充</span>');}
  const fallback=brand=>({headerTitle:'产品资料',footerText:brand.name+' · 产品资料库',logoData:'',fontSize:12,margin:14,imagePosition:'left',showSpecs:true,showPackaging:true,showIssues:true});
  const numeric=(value,min,max,otherwise)=>Number.isFinite(Number(value))?Math.min(max,Math.max(min,Number(value))):otherwise;
  function sheet(p,v,config,brand=company(),language=fileLanguage()){
    language=fileLanguage(language);const t=text=>translate(text,language);
    p=L.documentLanguage?.product(p,language)||p;v=L.documentLanguage?.variant(v,language)||v;
    const c={...fallback(brand),...config},fontSize=numeric(c.fontSize,9,16,12),margin=numeric(c.margin,8,25,14);
    const logo=/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(c.logoData||'')?c.logoData:brand.logo;
    const packs=(p.packaging||[]).filter(pack=>!pack.appliesTo||pack.appliesTo===v.id||pack.appliesTo===v.sku);
    const productBrand=L.productBrand?.(p),productBrandName=productBrand?.name||String(p.brand||'').trim();
    const productBrandLogo=L.brandMark?.(p,{className:'print-product-brand'})||'';
    const status=p.status==='published'?'已发布':p.status==='archived'?'已下架':p.status==='review'?'待发布':p.isLive?'待发布修改':'内部草稿';
    const footer=c.footerText===brand.name+' · 产品资料库'?brand.name+' · '+t('产品资料库'):t(c.footerText);
    return `<article class="product-print-sheet${c.imagePosition==='right'?' print-image-right':''}" lang="${language}" data-no-translate style="--print-font-size:${fontSize}px;--print-page-margin:${margin}mm" aria-label="${E(t('产品打印预览'))}"><header class="print-brand"><img src="${E(logo)}" class="print-logo" alt="${E(brand.name)}" loading="eager"><span data-print-data>${E(t(c.headerTitle))}</span></header><section class="print-hero"><div class="print-photo">${photo(v.images?.[0],p.name+' '+(v.colorLabel||v.color||''),language)}</div><div class="print-summary"><div class="print-product-heading">${productBrandLogo}<span class="print-status">${E(t(status))}</span></div><h1 data-print-data>${E(p.name)}</h1><h2 data-print-data>${E(p.type)}</h2><p data-print-data>${E(p.description)}</p><dl><div><dt>${E(t('品牌'))}</dt><dd data-print-data>${value(productBrandName,language)}</dd></div><div><dt>${E(t('当前配色'))}</dt><dd data-print-data>${value(v.colorLabel||v.color,language)}</dd></div><div><dt>${E(t('SKU 货号'))}</dt><dd data-print-data>${value(v.sku,language)}</dd></div></dl></div></section>${c.showSpecs?`<section class="print-section"><h2>${E(t('完整技术规格'))}</h2><table class="print-specs"><tbody>${(p.specs||[]).map(s=>`<tr><th scope="row" data-print-data>${E(s.label||s.key)}</th><td><span data-print-data>${value(s.value,language)}</span>${pending(s.pending,language)}</td></tr>`).join('')||`<tr><td>${E(t('尚未录入规格。'))}</td></tr>`}</tbody></table></section>`:''}${c.showPackaging?`<section class="print-section"><h2>${E(t('包装资料'))}</h2>${packs.map(pack=>`<article class="print-pack"><div><h3><span data-print-data>${E(pack.title)}</span>${pending(pack.pending,language)}</h3><pre data-print-data>${value(pack.text,language)}</pre></div>${pack.image?`<div class="print-pack-photo">${photo(pack.image,p.name+' '+pack.title,language)}</div>`:''}</article>`).join('')||`<p>${E(t('当前配色尚未录入适用包装。'))}</p>`}</section>`:''}${c.showIssues&&(p.issues||[]).length?`<section class="print-section print-issues"><h2>${E(t('待核实事项'))}</h2>${p.issues.map(issue=>`<p data-print-data><strong>${E(t(issue.field))}${language==='en'?': ':'：'}</strong>${E(t(issue.message))}</p>`).join('')}</section>` : ''}<footer class="print-footer"><span data-print-data>${E(footer)}</span><span data-print-data>${E(p.name)} / ${value(v.sku,language)}</span></footer></article>`;
  }
  L.renderPrintSheet=sheet;
  L.openProductPrint=(productId,variantId,templateId)=>{
    if(!L.isStaff()){L.toast('打印仅限内部人员。');return;}
    const p=L.state.products.find(product=>product.id===productId);
    if(!p?.variants?.length){L.toast('请先添加产品配色。');return;}
    const brand={...company()};
    const templates=L.printTemplates?.list()||[{id:'print-default',name:brand.name+' 标准打印模板',config:fallback(brand)}];
    let chosen=templates.find(t=>t.id===(templateId||L.printTemplates?.defaultId()))||templates[0];
    let v=p.variants.find(variant=>variant.id===variantId)||p.variants[0],language=fileLanguage(),generation=0,output=null,oldTitle=null,pageStyle=null;
    const d=L.modal('打印产品资料',`<div class="product-print-toolbar"><label class="field"><span>打印模板</span><select id="product-print-template" data-no-translate>${templates.map(t=>`<option value="${E(t.id)}" ${t.id===chosen.id?'selected':''}>${E(t.name)}</option>`).join('')}</select></label><label class="field"><span>选择配色 / SKU</span><select id="product-print-variant" data-no-translate>${p.variants.map(variant=>`<option value="${E(variant.id)}" ${variant.id===v.id?'selected':''}>${E(variant.colorLabel||variant.color||'配色待补充')} · ${value(variant.sku)}</option>`).join('')}</select></label><label class="field"><span>文件语言</span><select id="product-print-language" aria-label="文件语言" data-no-translate><option value="zh-CN" ${language==='zh-CN'?'selected':''}>中文</option><option value="en" ${language==='en'?'selected':''}>English</option></select></label><button class="btn primary" id="product-print-confirm" disabled>${L.icon('print')}打印 / 另存 PDF</button></div><div class="product-print-options"><p class="product-print-hint">文件语言独立于界面。可在打印窗口选择“另存为 PDF”；自定义内容没有英文资料时保留原文。</p>${L.can('templates')?'<button class="btn small" id="product-print-manage">管理打印模板</button>':''}</div><p class="product-print-ready" role="status"></p><div class="product-print-preview"></div>`,{wide:true});
    d.classList.add('product-print-dialog');
    const preview=d.querySelector('.product-print-preview'),button=d.querySelector('#product-print-confirm'),ready=d.querySelector('.product-print-ready');
    const cleanup=()=>{output?.remove();output=null;pageStyle?.remove();pageStyle=null;if(oldTitle!==null){document.title=oldTitle;oldTitle=null;}};
    function prepare(){
      cleanup();
      if(!d.open||!L.isStaff()||company().id!==brand.id)return;
      oldTitle=document.title;document.title=`${brand.name}_${p.name}_${v.sku||v.colorLabel||v.color||'产品资料'}`;
      // A normal document-flow copy paginates across sheets; the modal itself must not be printed.
      output=document.createElement('div');output.className='product-print-output';output.append(preview.firstElementChild.cloneNode(true));document.body.append(output);
      pageStyle=document.createElement('style');pageStyle.textContent=`@page{size:A4 portrait;margin:${numeric(chosen.config?.margin,8,25,14)}mm}`;document.head.append(pageStyle);
    }
    async function draw(){
      cleanup();const current=++generation;button.disabled=true;ready.textContent='正在准备图片…';preview.innerHTML=sheet(p,v,chosen.config,brand,language);
      const images=[...preview.querySelectorAll('img')];
      await Promise.all(images.map(img=>new Promise(resolve=>{if(img.complete){resolve();return;}const timer=setTimeout(done,10000);function done(){clearTimeout(timer);img.removeEventListener('load',done);img.removeEventListener('error',done);resolve();}img.addEventListener('load',done,{once:true});img.addEventListener('error',done,{once:true});})));
      if(!d.isConnected||current!==generation||company().id!==brand.id)return;
      ready.textContent=images.some(img=>!img.complete||!img.naturalWidth)?'部分图片未加载成功，可关闭预览后重试。':'图片已就绪';button.disabled=false;
    }
    d.querySelector('#product-print-variant').onchange=event=>{v=p.variants.find(variant=>variant.id===event.target.value);draw();};
    d.querySelector('#product-print-template').onchange=event=>{chosen=templates.find(t=>t.id===event.target.value)||templates[0];draw();};
    d.querySelector('#product-print-language').onchange=event=>{language=fileLanguage(event.target.value);draw();};
    d.querySelector('#product-print-manage')?.addEventListener('click',()=>{d.close();L.go('templates?tab=print');});
    button.onclick=()=>{if(!L.isStaff()||company().id!==brand.id){d.close();L.toast('请在当前主体重新打开打印。');return;}prepare();try{window.print();}catch{cleanup();L.toast('无法打开打印窗口，请在浏览器中重试。');}};
    const onRouteChange=()=>{if(d.open)d.close();};
    window.addEventListener('beforeprint',prepare);window.addEventListener('afterprint',cleanup);window.addEventListener('hashchange',onRouteChange);window.addEventListener('companychange',onRouteChange);
    d.addEventListener('close',()=>{generation++;cleanup();window.removeEventListener('beforeprint',prepare);window.removeEventListener('afterprint',cleanup);window.removeEventListener('hashchange',onRouteChange);window.removeEventListener('companychange',onRouteChange);},{once:true});
    draw();
  };
})();
