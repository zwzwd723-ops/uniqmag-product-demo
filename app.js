(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paths = {
    grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    list:'M8 5h13 M8 12h13 M8 19h13 M3 5h.01 M3 12h.01 M3 19h.01',
    layers:'m12 3 10 5-10 5L2 8z M2 12l10 5 10-5 M2 16l10 5 10-5',
    box:'m12 3 9 5v9l-9 5-9-5V8z M3 8l9 5 9-5 M12 13v9 M7.5 5.5l9 5',
    alert:'M12 8v5 M12 17h.01 M10.3 3.8 1.8 18.5a1.5 1.5 0 0 0 1.3 2.2h17.8a1.5 1.5 0 0 0 1.3-2.2L13.7 3.8a2 2 0 0 0-3.4 0',
    search:'m21 21-5.2-5.2 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    upload:'M12 16V3 m-4 4 4-4 4 4 M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5',
    download:'M12 3v13 m-4-4 4 4 4-4 M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5',
    arrow:'M5 12h14 m-5-5 5 5-5 5',
    copy:'M9 9h11v12H9z M15 5V2H3v14h3',
    close:'m6 6 12 12 M6 18 18 6',
    info:'M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    print:'M6 9V3h12v6 M6 17H3V9h18v8h-3 M6 14h12v7H6z M17 12h.01',
    check:'m5 12 4 4L20 5',
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.box}"/></svg>`;
  const baseline = window.CATALOG;
  let catalog = baseline;
  let db;
  let view = 'products', category = 'all', query = '', display = 'grid';
  let selected = {}, activeProduct = null, detailTab = 'overview', activeImage = 0;
  let pendingImport = null, importing = false, importTicket = 0, toastTimer;
  const totalVariants = () => catalog.products.reduce((sum,p) => sum+p.variants.length,0);
  const totalIssues = () => catalog.products.reduce((sum,p) => sum+p.issues.length,0);
  const getVariant = p => p.variants.find(v=>v.id===selected[p.id]) || p.variants[0];
  const colorStyle = (v) => /^#[a-f\d]{3,8}$/i.test(v.swatch || '') ? v.swatch : '#a9a0b6';
  const safeImage = v => /^(assets\/[\w./-]+|data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+)$/.test(v || '') ? v : '';
  const image = (src,alt,cls='') => safeImage(src) ? `<img src="${esc(safeImage(src))}" alt="${esc(alt)}" class="${cls}" loading="lazy">` : `<span class="image-placeholder ${cls}">${icon('box')}<span>图片待补充</span></span>`;
  const blank = v => v === null || v === undefined || v === '';
  const info = {products:['全部产品','产品资料库','查找产品规格、颜色版本与包装资料。'],variants:['型号与配色','型号与配色','按颜色、货号与表中供货状态查找产品。'],packaging:['包装资料','包装与装箱资料','零售盒、快递包装与整箱资料，按系列归档。'],review:['待确认资料','待确认资料','保留原文与来源，待核对的信息集中在这里。']};
  function toast(text) { const el=$('#toast');el.textContent=text;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3300); }
  function matches(p) {
    if(category!=='all' && p.category!==category) return false;
    if(!query) return true;
    return [p.name,p.type,p.description,...p.tags,...p.variants.flatMap(v=>[v.color,v.colorLabel,v.sku,v.id]),...p.specs.map(s=>s.value)].join(' ').toLowerCase().includes(query.toLowerCase());
  }
  function variantMatches(p,v) {
    if(!query) return true;
    return [p.id,p.type,v.color,v.colorLabel,v.sku,v.id].join(' ').toLowerCase().includes(query.toLowerCase());
  }
  function renderShell() {
    $('#navigation').innerHTML=[['products','grid',catalog.products.length],['variants','layers',totalVariants()],['packaging','box',''],['review','alert',totalIssues()]].map(([id,ic,n])=>`<button class="nav-item ${view===id?'active':''}" data-nav="${id}" aria-label="${info[id][0]}" ${view===id?'aria-current="page"':''}>${icon(ic)}<span class="nav-text">${info[id][0]}</span><span class="nav-count">${n}</span></button>`).join('');
    $('#page-title').textContent=info[view][1];$('#page-intro').textContent=info[view][2];$('#breadcrumb-current').textContent=info[view][0];
    $('#collection-stats').innerHTML=`<div><strong>${catalog.products.length.toString().padStart(2,'0')}</strong><span>产品系列</span></div><div><strong>${totalVariants()}</strong><span>型号 / 配色</span></div>`;
    $('#categories').innerHTML=[['all','全部'],['keyboard','键盘'],['controller','控制器'],['tv','电视棒']].map(([id,label])=>`<button class="category-tab ${category===id?'active':''}" data-category="${id}" aria-pressed="${category===id}">${label}</button>`).join('');
    $('.view-switch').hidden=view!=='products';
    $('#grid-button').classList.toggle('active',display==='grid');$('#grid-button').setAttribute('aria-pressed',display==='grid');$('#list-button').classList.toggle('active',display==='list');$('#list-button').setAttribute('aria-pressed',display==='list');
    $('#source-label').textContent=`数据来源：${catalog.source.filename} · ${catalog.source.importedAt?.slice(0,10)||'日期未记录'}`;
  }
  function render() {
    renderShell();const products=catalog.products.filter(matches);
    $('#result-count').textContent=`${products.length} 个产品系列`;
    let html='';
    if(!products.length) html=`<div class="empty">${icon('search')}<h2>没有找到匹配的产品</h2><p>试试产品型号、颜色或货号，也可以清除筛选。</p><button class="button subtle" data-reset>清除筛选</button></div>`;
    else if(view==='products') html=display==='grid'?renderCards(products):renderProductTable(products);
    else if(view==='variants') html=renderVariants(products);
    else if(view==='packaging') html=renderPackaging(products);
    else html=renderReview(products);
    $('#content').innerHTML=html;
  }
  function renderCards(products) {
    return `<div class="product-grid">${products.map(p=>{const v=getVariant(p);return `<article class="product-card" data-product="${esc(p.id)}"><button class="card-image" data-open="${esc(p.id)}" aria-label="查看 ${esc(p.name)} 产品详情"><span class="model-watermark">${esc(p.name)}</span>${image(v.images[0],`${p.name} ${v.colorLabel||v.color}`)}<span class="type-tag">${esc(p.categoryLabel)}</span><span class="image-count">${p.variants.length} ${p.variants.length>1?'COLORS':'VERSION'}</span></button><div class="card-body"><div class="card-title-line"><button class="product-link" data-open="${esc(p.id)}"><h2>${esc(p.name)}</h2></button><button class="icon-button card-arrow" data-open="${esc(p.id)}" aria-label="查看 ${esc(p.name)}">${icon('arrow')}</button></div><p class="card-subtitle">${esc(p.type)}</p><div class="card-tags">${p.tags.slice(0,3).map(t=>`<span>${esc(t)}</span>`).join('')}</div><div class="card-bottom"><div class="swatches">${p.variants.map(x=>`<button class="swatch ${x.id===v.id?'active':''}" style="--swatch:${colorStyle(x)}" data-swatch="${esc(x.id)}" data-series="${esc(p.id)}" title="${esc(x.colorLabel||x.color)}" aria-label="${esc(p.id)} ${esc(x.colorLabel||x.color)}" aria-pressed="${x.id===v.id}"></button>`).join('')}<span class="variant-count">${p.variants.length} 个版本</span></div>${p.issues.length?'<span class="card-state">有待确认资料</span>':'<span class="card-state">资料已收录</span>'}</div></div></article>`}).join('')}</div>`;
  }
  function renderProductTable(products) {
    return `<div class="table-wrap"><table class="product-table"><thead><tr><th>产品</th><th>类别</th><th>颜色版本</th><th>主要特性</th><th>资料</th><th></th></tr></thead><tbody>${products.map(p=>`<tr><td><button class="product-link table-product" data-open="${esc(p.id)}">${image(getVariant(p).images[0],p.name)}<span><strong>${esc(p.name)}</strong><small>${esc(p.type)}</small></span></button></td><td>${esc(p.categoryLabel)}</td><td>${p.variants.length} 款</td><td>${esc(p.tags.slice(0,2).join(' / '))}</td><td>${p.issues.length} 项待核对</td><td><button class="icon-button" data-open="${esc(p.id)}" aria-label="查看${esc(p.name)}">${icon('arrow')}</button></td></tr>`).join('')}</tbody></table></div>`;
  }
  function renderVariants(products) {
    const rows=products.flatMap(p=>p.variants.filter(v=>variantMatches(p,v)).map(v=>({p,v})));
    $('#result-count').textContent=`${rows.length} 个颜色 / 型号条目`;
    return `<div class="table-wrap"><table class="product-table"><thead><tr><th>产品 / 配色</th><th>货号</th><th>表中供货状态</th><th>条码资料</th><th></th></tr></thead><tbody>${rows.map(({p,v})=>`<tr><td><button class="product-link table-product" data-open="${esc(p.id)}" data-variant="${esc(v.id)}">${image(v.images[0],p.name+' '+(v.colorLabel||v.color))}<span><strong>${esc(p.name)}</strong><small>${esc(v.colorLabel||v.color||'颜色待确认')}</small></span></button></td><td>${blank(v.sku)?'<span class="badge">待补充</span>':esc(v.sku)}</td><td>${v.availability?'<span class="badge">表中标注售罄</span>':'<span class="muted">未提供</span>'}</td><td>${v.barcodeImage?'已收录图片':'<span class="muted">未提供</span>'}</td><td><button class="icon-button" data-open="${esc(p.id)}" data-variant="${esc(v.id)}" aria-label="查看${esc(p.name)} ${esc(v.colorLabel)}">${icon('arrow')}</button></td></tr>`).join('')}</tbody></table></div>`;
  }
  function renderPackaging(products) {
    return `<div class="pack-grid">${products.map(p=>`<article class="pack-card"><div class="pack-card-top"><div><h2>${esc(p.name)}</h2><p>${esc(p.type)}</p></div><button class="button subtle" data-open="${esc(p.id)}" data-tab="packaging">查看包装 ${icon('arrow')}</button></div><div class="pack-thumbs">${p.packaging.filter(x=>/包装/.test(x.title)&&x.title!=='包装清单').slice(0,3).map(x=>`<div class="pack-thumb">${x.image?image(x.image,x.title):`<span class="no-image">${icon('box')}</span>`}<span>${esc(x.title)}</span></div>`).join('')}</div></article>`).join('')}</div>`;
  }
  function renderReview(products) {
    $('#result-count').textContent=`${products.reduce((n,p)=>n+p.issues.length,0)} 项待核对`;
    return `<div class="review-intro">${icon('info')}<p>以下提示来自表格中的缺项或不一致内容。原始记录保留，未自动改写参数。</p></div><div class="review-groups">${products.map(p=>p.issues.length?`<article class="review-group"><div class="review-group-head"><h2>${esc(p.name)}</h2><button class="text-button" data-open="${esc(p.id)}">查看产品 →</button></div>${p.issues.map(x=>`<div class="review-item"><span class="badge ${x.severity==='missing'?'neutral':''}">${x.severity==='missing'?'待补充':'待确认'}</span><div><strong>${esc(x.field)}</strong><p>${esc(x.message)}</p></div><small>${esc(x.source)}</small></div>`).join('')}</article>`:'').join('')||'<div class="empty"><h2>当前筛选没有待确认项目</h2></div>'}</div>`;
  }
  function setRoute(p,v) {
    const target=`#product/${encodeURIComponent(p.id)}/${encodeURIComponent(v.id)}`;
    if(location.hash!==target) history.pushState(null,'',target);
  }
  function openProduct(id, variantId, tab='overview', fromRoute=false) {
    const p=catalog.products.find(p=>p.id===id);if(!p)return;
    if(variantId && p.variants.some(v=>v.id===variantId))selected[id]=variantId;
    activeProduct=p;detailTab=tab;activeImage=0;
    renderDetail();const dlg=$('#product-dialog');if(!dlg.open)dlg.showModal();
    if(!fromRoute)setRoute(p,getVariant(p));
  }
  function renderDetail() {
    const p=activeProduct,v=getVariant(p);
    $('#product-content').innerHTML=`<div class="detail-topbar"><div class="detail-breadcrumb"><span>产品资料</span><span>/</span><strong>${esc(p.name)}</strong></div><div class="detail-actions"><button class="button subtle" data-download-image>${icon('download')}<span class="button-label">下载产品图</span></button><button class="icon-button" data-print aria-label="打印当前产品资料">${icon('print')}</button><button class="icon-button" data-close="product-dialog" aria-label="关闭产品详情">${icon('close')}</button></div></div><div class="detail-hero"><div class="detail-gallery">${image(v.images[Math.min(activeImage,v.images.length-1)],p.name+' '+(v.colorLabel||v.color),'detail-main-image')}${v.images.length>1?`<div class="gallery-thumbs">${v.images.map((src,i)=>`<button class="gallery-thumb ${i===activeImage?'active':''}" data-gallery="${i}" aria-label="产品图片 ${i+1}">${image(src,p.name+' 图片'+(i+1))}</button>`).join('')}</div>`:''}</div><div class="detail-info"><p class="eyebrow">${esc(p.categoryLabel)} / UNIQMAG</p><h2 id="detail-title">${esc(p.name)}</h2><p class="detail-type">${esc(p.type)}</p><p class="detail-description">${esc(p.description)}</p><p class="variant-label">当前配色 <strong>${esc(v.colorLabel||v.color||'待确认')}</strong></p><div class="variant-options">${p.variants.map(x=>`<button class="variant-button ${x.id===v.id?'active':''}" data-detail-variant="${esc(x.id)}" aria-pressed="${x.id===v.id}"><span class="color-dot" style="--swatch:${colorStyle(x)}"></span>${esc(x.colorLabel||x.color||'待确认')}</button>`).join('')}</div><div class="sku-line"><span>货号 ${esc(v.sku||'待补充')}</span>${v.sku?`<button class="icon-button" data-copy-sku aria-label="复制货号">${icon('copy')}</button>`:''}${v.availability?'<span class="badge">表中标注售罄</span>':''}</div></div></div><div class="detail-tabs" role="tablist" aria-label="产品资料栏目">${[['overview','产品概览'],['specs','完整规格'],['packaging','包装资料'],['sales','销售资料']].map(([id,label])=>`<button class="detail-tab ${detailTab===id?'active':''}" id="tab-${id}" role="tab" aria-selected="${detailTab===id}" aria-controls="detail-panel" data-detail-tab="${id}">${label}</button>`).join('')}</div><section class="detail-panel" id="detail-panel" role="tabpanel" aria-labelledby="tab-${detailTab}">${detailPanel(p,v)}</section>`;
  }
  function specRows(specs) {return `<div class="spec-grid">${specs.map(s=>`<div class="spec-row ${s.pending?'pending':''}"><span class="spec-label">${esc(s.label||s.key)}</span><span class="spec-value">${esc(s.value)}${s.pending?'<span class="pending-note"> · 待确认</span>':''}</span></div>`).join('')}</div>`;}
  function detailPanel(p,v) {
    if(detailTab==='overview') {
      const primary=p.specs.filter(s=>/Dimensions|Weight|Connection|Polling|Sensor|Switch Type|Chipset|System Support|Battery Capacity/i.test(s.key)).slice(0,8);
      return `<div class="overview-tags">${p.tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div><h3 class="section-title">关键规格</h3>${specRows(primary)}${p.issues.length?`<div class="detail-note">${p.issues.length} 项资料待核对。${esc(p.issues[0].message)}<button data-show-review>查看待确认资料</button></div>`:''}<p class="source-ref">来源：Quotation · ${esc(p.specs[0]?.source||'')} · 参数按原表收录</p>`;
    }
    if(detailTab==='specs')return `<h3 class="section-title">技术规格 <span class="badge neutral">保留原表参数</span></h3>${specRows(p.specs)}<p class="source-ref">规格值及认证等声明来自所提供的表格，待确认项以标注为准。</p>`;
    if(detailTab==='packaging')return `<div class="pack-detail-grid">${p.packaging.map(x=>`<article class="pack-detail">${x.image?image(x.image,p.name+' '+x.title):''}<div class="pack-detail-content"><h3>${esc(x.title)} ${x.pending?'<span class="badge">待完善</span>':''}</h3><pre>${esc(x.text)}</pre>${x.appliesTo?`<p class="applies-note">仅适用于 ${esc(x.appliesTo)}${x.appliesTo!==v.sku?'，不适用于当前配色':''}</p>`:''}<p class="source-ref">来源：Quotation · ${esc(x.source)}</p></div></article>`).join('')}</div>`;
    const fields=[['起订量 MOQ',v.moq],['FOB（美元）',v.fob],['建议零售价（美元）',v.msrp],['Amazon 编号',v.amazonCode],['Temu 编号',v.temuCode],['表中供货状态',v.availability?'售罄':null]];
    return `<div class="sales-grid">${fields.map(([label,value])=>`<div class="sales-item"><small>${label}</small><strong>${blank(value)?'未提供':esc(value)}</strong></div>`).join('')}</div><div class="barcode-row">${v.barcodeImage?image(v.barcodeImage,p.name+' 条码'):'<span class="badge neutral">条码未提供</span>'}<p>货号：${esc(v.sku||'待补充')}<br>${v.barcodeImage?'原表条码以图片保存，尚未转换为可搜索号码。':'可在报价表补充后重新导入。'}</p></div><p class="source-ref">价格和状态来自已导入表格，不代表实时库存或即时报价。</p>`;
  }
  function showInfo() {
    $('#info-content').innerHTML=`<div class="info-block"><strong>当前资料来源</strong><code>${esc(catalog.source.filename)}</code><br>${catalog.products.length} 个系列 · ${totalVariants()} 个版本 · 导入日期 ${esc(catalog.source.importedAt?.slice(0,10)||'未记录')}</div><div class="info-block"><strong>怎样更新</strong>在原报价表中更新资料，点击“导入更新”选择同版式 Excel，核对预览后确认。也可以导入之前导出的 JSON 备份。</div><div class="info-block"><strong>保存与共享范围</strong>初始资料随网站提供。导入更新仅保存在当前浏览器，不会修改原 Excel，也不会自动同步到其他设备。换设备前请导出备份。</div><div class="info-block"><strong>缺失与待确认信息</strong>空白字段显示“未提供”；冲突与待确认参数保留原文。表中的销售状态、认证及性能声明均按原资料收录。</div>`;
    $('#info-dialog').showModal();
  }
  function closeDialog(id) {const dlg=document.getElementById(id);if(dlg?.open)dlg.close();}
  function readHash() {
    const parts=location.hash.slice(1).split('/');
    if(parts[0]==='product') {try{openProduct(decodeURIComponent(parts[1]),decodeURIComponent(parts[2]||''),detailTab,true);}catch{toast('产品链接无法识别');}}
    else if($('#product-dialog').open)closeDialog('product-dialog');
  }
  function openDatabase() {
    return new Promise((resolve,reject)=>{if(!window.indexedDB)return reject(new Error('当前浏览器不支持本地保存'));const req=indexedDB.open('uniqmag-library',1);req.onupgradeneeded=()=>req.result.createObjectStore('data');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  }
  function storage(action,value) {return new Promise((resolve,reject)=>{if(!db)return reject(new Error('浏览器未启用本地保存'));const tx=db.transaction('data',action==='get'?'readonly':'readwrite');const store=tx.objectStore('data');const req=action==='get'?store.get('catalog'):action==='delete'?store.delete('catalog'):store.put(value,'catalog');tx.oncomplete=()=>resolve(req.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('保存已中断'));});}
  function validateCatalog(c) {
    if(!c || c.schemaVersion!==1 || !c.source || typeof c.source.filename!=='string' || !Array.isArray(c.products) || !c.products.length) throw new Error('文件不是有效的产品库备份，请使用本站导出的 JSON 文件。');
    const ids=new Set();
    for(const p of c.products){if(!p.id||ids.has(p.id)||!Array.isArray(p.variants)||!p.variants.length||!Array.isArray(p.specs)||!Array.isArray(p.packaging)||!Array.isArray(p.issues)||!Array.isArray(p.tags))throw new Error('产品资料结构不完整或系列编号重复。');ids.add(p.id);const variantIds=new Set();for(const v of p.variants){if(!v.id||variantIds.has(v.id)||!Array.isArray(v.images)||!v.images.every(safeImage))throw new Error('颜色版本编号重复或图片格式无效。');variantIds.add(v.id);if(v.barcodeImage&&!safeImage(v.barcodeImage))throw new Error('条码图片格式无效。');}for(const pack of p.packaging){if(pack.image&&!safeImage(pack.image))throw new Error('包装图片格式无效。');}}
    return c;
  }
  function asDataURL(blob) {return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});}
  async function exportCatalog() {
    const button=$('#export-button');button.disabled=true;
    try{const copy=structuredClone(catalog),cache=new Map();async function embed(src){if(!src||src.startsWith('data:'))return src;if(!cache.has(src))cache.set(src,fetch(src).then(async r=>{if(!r.ok)throw new Error('图片备份失败');const type=/\.png$/i.test(src)?'image/png':/\.jpe?g$/i.test(src)?'image/jpeg':'image/webp';return new Blob([await r.arrayBuffer()],{type});}).then(asDataURL));return cache.get(src);}for(const p of copy.products){for(const v of p.variants){v.images=await Promise.all(v.images.map(embed));if(v.barcodeImage)v.barcodeImage=await embed(v.barcodeImage);}for(const x of p.packaging)if(x.image)x.image=await embed(x.image);}download(new Blob([JSON.stringify(copy,null,2)],{type:'application/json'}),'UNIQMAG_产品库备份.json');toast('已导出资料与图片，可用于恢复或迁移');}catch(e){toast(e.message||'导出失败，请重试');}finally{button.disabled=false;}
  }
  function download(blob,name) {const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function openImport() {pendingImport=null;$('#apply-import').disabled=true;$('#import-preview').innerHTML='';$('#import-progress').textContent='';$('#import-file').value='';$('#import-dialog').showModal();}
  async function parseFile(file) {
    if(!file || importing)return;
    const ticket=++importTicket;pendingImport=null;$('#apply-import').disabled=true;$('#import-preview').innerHTML='';
    if(file.size>150*1024*1024){$('#import-progress').textContent='文件超过 150 MB，请先减少表格内的超大图片。';return;}
    importing=true;$('#import-file').disabled=true;$('#import-progress').textContent='正在读取产品和图片，请稍候…';
    try{let result;if(/\.json$/i.test(file.name)){const c=validateCatalog(JSON.parse(await file.text()));result={catalog:c,summary:{products:c.products.length,variants:c.products.reduce((n,p)=>n+p.variants.length,0)},warnings:[]};}else if(/\.xlsx$/i.test(file.name)){if(!window.ProductImporter)throw new Error('导入组件未加载，请刷新后重试。');result=await window.ProductImporter.parse(file,catalog);validateCatalog(result.catalog);}else throw new Error('请选择 .xlsx 报价表或 .json 产品库备份。');if(ticket!==importTicket)return;pendingImport=result.catalog;const s=result.summary;$('#import-progress').textContent=`已读取 ${file.name}`;$('#import-preview').innerHTML=`<div class="import-preview"><div class="import-summary"><span><strong>${s.products}</strong>个系列</span><span><strong>${s.variants}</strong>个颜色版本</span>${s.changed!==undefined?`<span><strong>${s.changed}</strong>项变更</span>`:''}</div><p class="local-note" style="margin-top:12px">确认后替换当前浏览器中的产品资料，原 Excel 文件不变。</p>${result.warnings?.length?`<ul>${result.warnings.map(w=>`<li>${esc(typeof w==='string'?w:w.message||JSON.stringify(w))}</li>`).join('')}</ul>`:''}</div>`;$('#apply-import').disabled=false;}catch(e){$('#import-progress').textContent=e.message||'读取失败，请检查文件后重试。';}finally{importing=false;$('#import-file').disabled=false;}
  }
  async function applyImport() {
    if(!pendingImport)return;const btn=$('#apply-import');btn.disabled=true;
    try{await storage('put',pendingImport);catalog=pendingImport;pendingImport=null;selected={};closeDialog('product-dialog');closeDialog('import-dialog');render();toast('资料已更新，并保存在当前浏览器');}catch(e){$('#import-progress').textContent='保存失败：'+e.message+'。原有资料保持不变。';btn.disabled=false;}
  }
  document.addEventListener('click', async e => {
    const el=e.target.closest('button,a');if(!el)return;
    if(el.dataset.nav){view=el.dataset.nav;render();}
    if(el.dataset.category){category=el.dataset.category;render();}
    if(el.hasAttribute('data-reset')){query='';category='all';$('#search').value='';render();}
    if(el.dataset.open)openProduct(el.dataset.open,el.dataset.variant,el.dataset.tab||'overview');
    if(el.dataset.swatch){selected[el.dataset.series]=el.dataset.swatch;render();}
    if(el.dataset.close)closeDialog(el.dataset.close);
    if(el.dataset.detailVariant){selected[activeProduct.id]=el.dataset.detailVariant;activeImage=0;renderDetail();setRoute(activeProduct,getVariant(activeProduct));render();}
    if(el.dataset.detailTab){detailTab=el.dataset.detailTab;renderDetail();$(`#tab-${detailTab}`)?.focus({preventScroll:true});}
    if(el.hasAttribute('data-gallery')){activeImage=Number(el.dataset.gallery);renderDetail();}
    if(el.hasAttribute('data-show-review')){closeDialog('product-dialog');view='review';query=activeProduct.id;$('#search').value=query;render();}
    if(el.hasAttribute('data-copy-sku')){try{await navigator.clipboard.writeText(getVariant(activeProduct).sku);toast('货号已复制');}catch{toast('无法访问剪贴板，请手动复制货号');}}
    if(el.hasAttribute('data-print'))window.print();
    if(el.hasAttribute('data-download-image')){const v=getVariant(activeProduct);try{const res=await fetch(v.images[activeImage]);if(!res.ok)throw new Error();download(await res.blob(),`${activeProduct.id}_${v.sku||v.id}.webp`);}catch{toast('图片下载失败，请重试');}}
  });
  $('#search').addEventListener('input',e=>{query=e.target.value.trim();render();});
  $('#grid-button').onclick=()=>{display='grid';render();};$('#list-button').onclick=()=>{display='list';render();};
  $('#export-button').innerHTML=`${icon('download')}<span class="button-label">导出备份</span>`;$('#export-button').onclick=exportCatalog;
  $('#import-button').innerHTML=`${icon('upload')}<span>导入更新</span>`;$('#import-button').onclick=openImport;
  $('#info-button').innerHTML=icon('info');$('#info-button').onclick=showInfo;$('#source-info').onclick=showInfo;
  $('#search-icon').innerHTML=icon('search');$('#upload-icon').innerHTML=icon('upload');$('#grid-button').innerHTML=icon('grid');$('#list-button').innerHTML=icon('list');
  $('#import-file').addEventListener('change',e=>parseFile(e.target.files[0]));$('#apply-import').onclick=applyImport;
  $('#upload-zone').addEventListener('dragover',e=>{e.preventDefault();e.currentTarget.classList.add('dragover');});$('#upload-zone').addEventListener('dragleave',e=>e.currentTarget.classList.remove('dragover'));$('#upload-zone').addEventListener('drop',e=>{e.preventDefault();e.currentTarget.classList.remove('dragover');parseFile(e.dataTransfer.files[0]);});
  $('#restore-button').onclick=async()=>{try{await storage('delete');catalog=baseline;selected={};render();closeDialog('info-dialog');toast('已恢复网站初始资料');}catch(e){toast('恢复失败：'+e.message);}};
  $$('.utility-dialog, .product-dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
  $('#product-dialog').addEventListener('close',()=>{if(location.hash.startsWith('#product/'))history.replaceState(null,'',location.pathname+location.search);});
  $('#import-dialog').addEventListener('close',()=>{importTicket++;pendingImport=null;});
  window.addEventListener('popstate',readHash);window.addEventListener('hashchange',readHash);
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName)&&!$('dialog[open]')){e.preventDefault();$('#search').focus();}if(e.target.matches('.detail-tab')&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const tabs=['overview','specs','packaging','sales'];detailTab=tabs[(tabs.indexOf(detailTab)+(e.key==='ArrowRight'?1:3))%4];renderDetail();$(`#tab-${detailTab}`).focus();}});
  async function init(){if(!baseline){$('#content').innerHTML='<div class="empty"><h2>产品资料未加载</h2><p>请检查 data.js 是否与网页放在同一目录。</p></div>';return;}render();readHash();try{db=await openDatabase();const stored=await storage('get');if(stored){catalog=validateCatalog(stored);render();readHash();}}catch(e){toast('本地保存暂不可用，当前可浏览初始资料');}}
  init();
})();
