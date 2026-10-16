/* Browser-local catalog workflows. Published snapshots are changed only by explicit publishing. */
(function () {
  'use strict';
  const L = window.Library;
  const E = value => L.esc(value ?? '');
  const clone = value => structuredClone(value);
  const now = () => new Date().toISOString();
  const statuses = {published:'已发布',draft:'草稿',review:'待发布',archived:'已下架'};
  const usages = {product:'产品主图',detail:'详情页',packaging:'包装图',lifestyle:'场景图',barcode:'条码',manual:'说明书',source:'源文件',other:'其他'};
  const sourceImage = p => p.variants?.flatMap(v => v.images || [])[0];
  const badge = p => `<span class="badge ${p.status==='published'?'green':p.status==='review'?'amber':p.status==='draft'?'purple':''}">${E(statuses[p.status]||'草稿')}</span>`;
  const field = (label,name,value='',type='text',extra='') => `<label class="field ${extra}"><span>${E(label)}</span><input name="${E(name)}" type="${E(type)}" value="${E(value)}"></label>`;
  function brandField(p){
    const current=typeof p.brand==='string'?p.brand.trim():(L.productBrand?.(p)?.name||''),known=L.availableBrands?.()||[];
    const matched=known.find(b=>b.name.toLowerCase()===current.toLowerCase()),selected=matched?.name||current;
    const options=known.map(b=>({value:b.name,label:b.name}));
    if(current&&!matched)options.push({value:current,label:current});
    return `<label class="field"><span>品牌</span><select name="brand"><option value="" ${!selected?'selected':''}>未指定</option>${options.map(b=>`<option value="${E(b.value)}" ${selected===b.value?'selected':''}>${E(b.label)}</option>`).join('')}</select></label>`;
  }
  const empty = text => `<div class="empty-state">${E(text)}</div>`;
  const safeURL = url => /^(?:assets\/|data:(?:image\/(?:png|jpeg|webp|gif)|video\/(?:mp4|webm)|application\/|text\/)|blob:)/i.test(String(url||'')) ? url : '';
  const productById = id => L.state.products.find(p=>p.id===id);
  function guard(action) { if (L.can(action)) return true; L.toast('当前角色无此操作权限。'); return false; }
  function requireStaffDownload(){if(!L.isStaff()||!L.can('export'))throw new Error('仅内部人员可以下载文件。');}
  function downloadableAsset(id,scope=()=>{},expectedURL){
    requireStaffDownload();scope(id);
    const asset=L.state.assets.find(a=>a.id===id);
    if(!asset)throw new Error('素材已不存在，请刷新后重试。');
    if(expectedURL!==undefined&&asset.url!==expectedURL)throw new Error('素材文件已更新，请重新选择后下载。');
    if(!L.safeURL(asset.url)&&!/^data:[\w+./-]+;base64,[A-Za-z0-9+/=]+$/.test(asset.url||''))throw new Error('素材文件地址不可用。');
    return asset;
  }
  async function readDownloadAsset(id,scope){
    const asset=downloadableAsset(id,scope),url=asset.url,downloadURL=asset.originalUrl||url;
    if(!L.safeURL(downloadURL)&&!/^data:[\w+./-]+;base64,[A-Za-z0-9+/=]+$/.test(downloadURL||''))throw new Error('素材原图地址不可用。');
    const response=await fetch(downloadURL);downloadableAsset(id,scope,url);
    if(!response.ok)throw new Error('文件读取失败：'+asset.name);
    const blob=await response.blob();downloadableAsset(id,scope,url);
    return {asset,blob,url};
  }
  async function recordDownload(action,target){
    L.log(action,target);
    try{await L.save();if(L.isStaff())L.toast('文件已准备下载。');}
    catch(error){if(L.isStaff())L.toast('文件已准备下载，操作记录暂未保存。');}
  }
  async function downloadAsset(id,scope){
    try{const {asset,blob,url}=await readDownloadAsset(id,scope);downloadableAsset(id,scope,url);L.download(blob,asset.name);await recordDownload('下载素材',asset.name);return true;}
    catch(error){L.toast('下载失败：'+error.message);return false;}
  }
  async function downloadAssetBundle(ids,label,scope){
    try{
      requireStaffDownload();const uniqueIds=[...new Set(ids)];
      if(!uniqueIds.length)throw new Error('请先勾选需要下载的素材。');
      if(!window.JSZip)throw new Error('打包工具尚未加载，请刷新页面重试。');
      const zip=new JSZip(),files=[];
      for(let i=0;i<uniqueIds.length;i++){
        uniqueIds.forEach(id=>downloadableAsset(id,scope));
        const file=await readDownloadAsset(uniqueIds[i],scope);files.push(file);
        const filename=String(file.asset.name||'素材').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'')||'素材';
        zip.file(String(i+1).padStart(3,'0')+'_'+filename,await file.blob.arrayBuffer());
      }
      files.forEach(f=>downloadableAsset(f.asset.id,scope,f.url));
      const blob=await zip.generateAsync({type:'blob'});
      files.forEach(f=>downloadableAsset(f.asset.id,scope,f.url));
      L.download(blob,`${L.company().name}_${label}_素材.zip`);
      await recordDownload('打包下载素材',`${label} · ${files.length} 份素材`);return true;
    }catch(error){L.toast('打包失败：'+error.message);return false;}
  }
  function previewDownloadAsset(id){
    try{
      const asset=downloadableAsset(id);
      const dialog=L.modal('素材预览',`<div class="cat-download-preview"><div class="cat-asset-preview">${asset.type==='image'?L.image(asset.url,asset.name):asset.type==='video'?`<video controls preload="metadata" src="${E(safeURL(asset.url))}"></video>`:`<span class="cat-file-icon">▤</span><strong>${E(asset.name)}</strong><p class="muted">下载后可使用相应应用查看此文件。</p>`}</div><h3>${E(asset.name)}</h3><p class="muted">${E(usages[asset.usage]||'其他')} · v${E(asset.version||1)} · ${asset.size?L.size(asset.size):'网页素材'}</p></div><div class="cat-dialog-actions"><button class="btn primary" id="cat-preview-download">${L.icon('download')}下载文件</button></div>`,{wide:true});
      dialog.querySelector('#cat-preview-download').onclick=()=>downloadAsset(id,()=>{if(!dialog.isConnected||!dialog.open)throw new Error('预览已关闭，请重新选择文件。');});
    }catch(error){L.toast(error.message);}
  }
  const activeUploadDialog=dialog=>dialog.isConnected&&dialog.open&&L.isStaff()&&L.can('upload');
  async function commit(changes, action, target,canNotify=()=>true) {
    const permission=Object.hasOwn(changes,'products')?'edit':'upload';
    if(!guard(permission))return false;
    const previous = {}, logBefore = L.state.logs.slice();
    Object.keys(changes).forEach(key=>{previous[key]=L.state[key];L.state[key]=changes[key];});
    L.log(action,target);
    try { await L.save(); return L.isStaff()&&L.can(permission); }
    catch(error) { Object.assign(L.state,previous); L.state.logs=logBefore; if(canNotify())L.toast('保存失败：'+(error.message||'浏览器存储空间不足，请减少文件大小。')); return false; }
  }
  function referencedURLs(p) { return new Set([...(p.variants||[]).flatMap(v=>[...(v.images||[]),v.barcodeImage]),...(p.packaging||[]).map(x=>x.image),...(p.details||[]).map(x=>x.url)].filter(Boolean)); }
  function updateProductList(p) { return L.state.products.some(x=>x.id===p.id) ? L.state.products.map(x=>x.id===p.id?p:x) : [...L.state.products,p]; }
  function linkedAssets(p,publish=false) {
    const urls=referencedURLs(p);
    return L.state.assets.map(a=>{
      if(!urls.has(a.url))return a;
      const universal=(p.details||[]).some(d=>d.url===a.url)||(p.packaging||[]).some(d=>d.image===a.url&&!d.appliesTo);
      const skuIds=(p.variants||[]).filter(v=>(v.images||[]).includes(a.url)||v.barcodeImage===a.url||(p.packaging||[]).some(d=>d.image===a.url&&[v.id,v.sku].includes(d.appliesTo))).map(v=>v.id);
      const explicitIds=universal?(p.variants||[]).map(v=>v.id):skuIds;
      const oldIds=(a.skuIds||[]).length?a.skuIds:L.state.products.filter(other=>(a.productIds||[]).includes(other.id)).flatMap(other=>(other.variants||[]).map(v=>v.id));
      return {...a,productIds:[...new Set([...(a.productIds||[]),p.id])],skuIds:[...new Set([...oldIds,...explicitIds])],...(publish&&a.status!=='archived'?{status:'published'}:{})};
    });
  }
  function validateProduct(p) {
    if (!p.name?.trim()) return '请填写产品名称。';
    if (!p.variants?.length) return '请至少添加一个颜色 / SKU 版本。';
    const values=p.variants.map(v=>v.sku?.trim().toLowerCase()).filter(Boolean);
    if (new Set(values).size!==values.length) return '同一产品的 SKU 不能重复。';
    const others=new Set(L.state.products.filter(x=>x.id!==p.id).flatMap(x=>(x.variants||[]).map(v=>v.sku?.trim().toLowerCase()).filter(Boolean)));
    if(values.some(v=>others.has(v)))return '此 SKU 已用于其他产品，请核对。';
    return '';
  }
  async function saveProduct(p,mode='draft') {
    if(!guard(mode==='published'?'publish':'edit'))return false;
    const error=validateProduct(p); if(error){L.toast(error);return false;}
    const draft=clone(p); draft.updatedAt=now();
    if(mode==='published')L.publishProduct(draft);else draft.status=mode;
    if(await commit({products:updateProductList(draft),assets:linkedAssets(draft,mode==='published')},mode==='published'?'发布产品':'保存产品草稿',draft.name)){
      L.toast(mode==='published'?'产品已发布到本机客户预览。':'草稿已保存，客户预览保持原发布版本。');return true;
    }
    return false;
  }
  function confirmPublish(p,onDone) {
    if(!guard('publish'))return;
    const count=L.state.assets.filter(a=>referencedURLs(p).has(a.url)&&a.status!=='archived'&&a.status!=='published').length;
    L.confirm('发布此产品',`将以当前资料更新客户预览版本，并一同发布 ${count} 份引用素材。已有邀请的授权范围不会自动增加。${(p.issues||[]).length?'此产品仍有原表待核实项，请确认已保留准确的提示。':''}`,async()=>{if(await saveProduct(p,'published'))onDone?.();});
  }
  function withdrawProduct(id,onDone){
    if(!guard('publish'))return;const product=productById(id);if(!product?.isLive){L.toast('该产品当前未发布。');return;}
    L.confirm('下架产品',`${product.name} 将从客户资料库移除，产品资料、素材和已发布版本仍保留。`,async()=>{
      if(!guard('publish'))return;const current=productById(id);if(!current?.isLive){L.toast('该产品当前未发布。');return;}
      const next=clone(current);L.unpublishProduct(next);if(!guard('publish'))return;
      if(await commit({products:updateProductList(next)},'下架产品',current.name,()=>L.isStaff()&&L.can('publish'))){if(!L.isStaff()||!L.can('publish'))return;L.toast('产品已下架，客户不再可见。');if(onDone)onDone(id);else L.render();}
    });
  }
  function openCategoryManager(){
    if(!guard('categories'))return;
    const draft=L.getCategories().map(c=>({id:c.id,name:c.name,builtin:!!c.builtin}));let busy=false;
    const dialog=L.modal('管理产品分类',`<p class="cat-category-intro">按产品类型维护一级分类，名称统一用于产品筛选和客户导航。新增分类后，在产品编辑中调整归类；保存为草稿并发布后，客户才会看到新的产品归类。</p><div id="cat-category-error" class="notice cat-error" role="alert" hidden></div><div class="cat-category-editor" id="cat-category-editor"></div><button class="btn" id="cat-category-add">＋ 新增分类</button><p class="cat-category-help">默认分类不可删除。有关联产品或已发布版本的分类也不可删除，已下架产品仍会计入。每个名称最多 30 个字符。</p><div class="cat-dialog-actions"><button class="btn" id="cat-category-cancel">取消</button><button class="btn primary" id="cat-category-save">保存分类</button></div>`,{wide:true});
    const editor=dialog.querySelector('#cat-category-editor');
    function drawRows(){
      editor.innerHTML=draft.map((c,index)=>{const usage=L.categoryUsage(c.id),locked=c.builtin||usage.products>0||usage.snapshots>0;return `<div class="cat-category-edit-row" data-category-row="${E(c.id)}"><span class="cat-category-position">${String(index+1).padStart(2,'0')}</span><div class="cat-category-name-field"><label class="field"><span>分类名称</span><input data-category-name="${E(c.id)}" aria-label="分类名称 ${index+1}" maxlength="30" value="${E(c.name)}" placeholder="例如：鼠标、配件"></label><p>${c.builtin?'默认分类 · ':''}${usage.products} 个产品 · ${usage.snapshots} 个发布版本</p></div><div class="cat-category-row-actions"><button class="icon-btn" data-category-up="${E(c.id)}" aria-label="上移 ${E(c.name||'新分类')}" ${index===0?'disabled':''}>↑</button><button class="icon-btn" data-category-down="${E(c.id)}" aria-label="下移 ${E(c.name||'新分类')}" ${index===draft.length-1?'disabled':''}>↓</button><button class="btn small" data-category-remove="${E(c.id)}" ${locked?'disabled':''} title="${locked?(c.builtin?'默认分类不可删除':'分类仍有关联产品或发布版本'):'删除此空闲分类'}">删除</button></div></div>`;}).join('');
      editor.querySelectorAll('[data-category-name]').forEach(input=>input.oninput=()=>{const item=draft.find(c=>c.id===input.dataset.categoryName);if(item)item.name=input.value;});
      editor.querySelectorAll('[data-category-up]').forEach(button=>button.onclick=()=>{if(busy)return;const index=draft.findIndex(c=>c.id===button.dataset.categoryUp);if(index>0){[draft[index-1],draft[index]]=[draft[index],draft[index-1]];drawRows();}});
      editor.querySelectorAll('[data-category-down]').forEach(button=>button.onclick=()=>{if(busy)return;const index=draft.findIndex(c=>c.id===button.dataset.categoryDown);if(index>=0&&index<draft.length-1){[draft[index+1],draft[index]]=[draft[index],draft[index+1]];drawRows();}});
      editor.querySelectorAll('[data-category-remove]').forEach(button=>button.onclick=()=>{if(busy)return;const index=draft.findIndex(c=>c.id===button.dataset.categoryRemove),item=draft[index],usage=L.categoryUsage(item.id);if(item.builtin||usage.products||usage.snapshots)return;draft.splice(index,1);drawRows();});
    }
    dialog.querySelector('#cat-category-add').onclick=()=>{if(busy)return;draft.push({id:L.uid('category'),name:'',builtin:false});drawRows();editor.querySelector('[data-category-name="'+draft[draft.length-1].id+'"]')?.focus();};
    dialog.querySelector('#cat-category-cancel').onclick=()=>dialog.close();
    dialog.querySelector('#cat-category-save').onclick=async()=>{
      if(busy||!guard('categories'))return;const error=dialog.querySelector('#cat-category-error'),save=dialog.querySelector('#cat-category-save');error.hidden=true;busy=true;save.disabled=true;save.textContent='正在保存…';dialog.querySelector('#cat-category-add').disabled=true;editor.querySelectorAll('input,button').forEach(control=>control.disabled=true);
      try{await L.saveCategories(draft.map(({id,name})=>({id,name})));if(dialog.isConnected){dialog.close();L.render();}L.toast('产品分类已保存。');}
      catch(reason){if(dialog.isConnected){error.textContent=reason.message||'分类保存失败，请重试。';error.hidden=false;busy=false;drawRows();save.disabled=false;save.textContent='保存分类';dialog.querySelector('#cat-category-add').disabled=false;}}
    };
    drawRows();
  }
  function newProduct(){return{id:L.uid('product'),name:'',brand:L.companyId()==='uniqmag'?'UNIQMAG':'',category:'other',categoryLabel:L.categoryName('other'),type:'',description:'',tags:[],specs:[],variants:[{id:L.uid('sku'),sku:null,color:'',colorLabel:'',swatch:'#bfc0c7',images:[]}],packaging:[],issues:[],details:[],status:'draft',isLive:false};}
  function renderEditor(el,params,{onDone,onCancel}={}){
    const id=params.get('id'),original=id?productById(id):null;
    if(id&&!original){el.innerHTML=empty('该产品不存在。');return;}
    const p=clone(original||newProduct());let tab=['basic','specs','variants','packaging'].includes(params.get('tab'))?params.get('tab'):'basic',dirty=false;const readonly=!L.can('edit');L.isDirty=()=>dirty;
    el.innerHTML=`<div class="cat-editor-top"><button class="btn" id="cat-back">← ${onCancel?'返回产品详情':'产品资料库'}</button><div class="cat-editor-name"><strong>${E(p.name||'新增产品')}</strong>${badge(p)}</div><button class="btn" id="cat-save" ${readonly?'disabled':''}>保存草稿</button>${L.can('publish')?'<button class="btn primary" id="cat-editor-publish">保存并发布</button>':''}</div><div class="notice">${p.isLive?'当前编辑内容将另存为草稿；客户继续看到原发布版本。':'新产品先保存在当前浏览器，发布后可在客户预览中查看。'}${readonly?' 当前角色只能查看资料。':''}</div><div class="tabs cat-editor-tabs">${[['basic','基本资料'],['specs','产品规格'],['variants','颜色 / SKU'],['packaging','包装资料']].map(([k,v])=>`<button data-tab="${k}" ${k===tab?'class="active"':''}>${v}</button>`).join('')}</div><div id="cat-editor-body"></div>`;
    const body=el.querySelector('#cat-editor-body');body.addEventListener('input',()=>{if(!readonly)dirty=true;});
    function sync(){
      if(tab==='basic'){p.name=body.querySelector('[name=name]').value.trim();p.brand=body.querySelector('[name=brand]').value;p.type=body.querySelector('[name=type]').value.trim();const chosenCategory=body.querySelector('[name=category]').value;if(chosenCategory!==L.categoryKey(p)){p.category=chosenCategory;p.categoryLabel=L.categoryName(chosenCategory);}p.description=body.querySelector('[name=description]').value.trim();p.tags=body.querySelector('[name=tags]').value.split(/[,，]/).map(s=>s.trim()).filter(Boolean);}
      if(tab==='specs')body.querySelectorAll('[data-spec]').forEach(row=>{const s=p.specs[Number(row.dataset.spec)];s.label=row.querySelector('[name=label]').value.trim();s.key=row.querySelector('[name=key]').value.trim();s.value=row.querySelector('[name=value]').value;s.pending=row.querySelector('[name=pending]').checked;});
      if(tab==='variants')body.querySelectorAll('[data-variant]').forEach(row=>{const v=p.variants[Number(row.dataset.variant)];v.sku=row.querySelector('[name=sku]').value.trim()||null;v.color=row.querySelector('[name=color]').value.trim()||null;v.colorLabel=row.querySelector('[name=colorLabel]').value.trim();v.swatch=row.querySelector('[name=swatch]').value;});
      if(tab==='packaging')body.querySelectorAll('[data-pack]').forEach(row=>{const v=p.packaging[Number(row.dataset.pack)];v.title=row.querySelector('[name=title]').value.trim();v.text=row.querySelector('[name=text]').value;v.appliesTo=row.querySelector('[name=appliesTo]').value.trim()||null;v.pending=row.querySelector('[name=pending]').checked;});
    }
    function draw(){
      el.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
      if(tab==='basic')body.innerHTML=`<div class="cat-edit-layout"><section class="panel cat-editor-panel"><h3>基本资料</h3><div class="form-grid">${field('产品名称 *','name',p.name)}${brandField(p)}<label class="field"><span>产品类型分类</span><select name="category">${L.getCategories().map(c=>`<option value="${E(c.id)}" ${L.categoryKey(p)===c.id?'selected':''}>${E(c.name)}</option>`).join('')}</select></label>${field('具体类型','type',p.type)}${field('标签（逗号分隔）','tags',(p.tags||[]).join('，'))}<label class="field full"><span>产品简介</span><textarea name="description" rows="4" placeholder="简要描述产品特点，客户将在产品卡片与详情页看到">${E(p.description)}</textarea></label></div></section><aside class="panel cat-editor-aside"><div class="cat-edit-cover">${L.image(sourceImage(p),p.name||'产品主图')}</div><h3>产品资料检查</h3><div class="cat-check-item"><span>颜色 / SKU</span><strong>${p.variants.length}</strong></div><div class="cat-check-item"><span>规格字段</span><strong>${p.specs.length}</strong></div><div class="cat-check-item"><span>包装资料</span><strong>${p.packaging.length}</strong></div><p class="muted">在“颜色 / SKU”中设置产品图片。未提供的资料可保持空白。</p></aside></div>${(p.issues||[]).length?`<section class="panel cat-editor-panel cat-source-issues"><h3>原表待核实事项</h3>${p.issues.map(i=>`<div><span class="badge amber">待核实</span><strong>${E(i.field)}</strong><p>${E(i.message)}</p></div>`).join('')}</section>`:''}`;
      if(tab==='specs')body.innerHTML=`<section class="panel cat-editor-panel"><div class="cat-section-head"><div><h3>产品规格</h3><p class="muted">保留原始事实；存在疑问的参数可标记为待核实。</p></div><button class="btn" id="cat-add-spec">＋ 添加字段</button></div><div class="cat-specs">${p.specs.map((s,i)=>`<div class="cat-spec-row" data-spec="${i}">${field('显示名称','label',s.label)}${field('字段名称','key',s.key)}${field('参数值','value',s.value)}<label class="check-row"><input type="checkbox" name="pending" ${s.pending?'checked':''}>待核实</label><button class="icon-btn" data-remove-spec="${i}" aria-label="删除 ${E(s.label)}">×</button></div>`).join('')||empty('还没有规格字段。点击“添加字段”开始填写。')}</div></section>`;
      if(tab==='variants')body.innerHTML=`<section class="panel cat-editor-panel"><div class="cat-section-head"><div><h3>颜色 / SKU</h3><p class="muted">每个颜色版本有独立的货号和图片；货号未提供时保持空白。</p></div><button class="btn" id="cat-add-variant">＋ 添加版本</button></div><div class="cat-variant-edit-grid">${p.variants.map((v,i)=>`<div class="cat-variant-edit" data-variant="${i}"><div class="cat-variant-image">${L.image(v.images?.[0],v.colorLabel||'版本图片')}<button class="btn small" data-pick-variant="${i}">＋ 添加图片</button></div><div class="cat-image-strip">${(v.images||[]).map((url,j)=>`<div><button data-main-image="${i}:${j}" title="${j===0?'当前主图':'设为主图'}" aria-label="${j===0?'当前主图':'设为主图'}">${L.image(url,'版本图片 '+(j+1))}${j===0?'<span>主图</span>':''}</button><button data-remove-image="${i}:${j}" aria-label="移除版本图片 ${j+1}">×</button></div>`).join('')}</div><div class="form-grid">${field('SKU 货号','sku',v.sku)}${field('颜色原名','color',v.color)}${field('颜色显示名','colorLabel',v.colorLabel)}${field('色块','swatch',/^#[0-9a-f]{6}$/i.test(v.swatch||'')?v.swatch:'#bfc0c7','color')}</div><div class="cat-variant-footer"><span class="muted">${v.images?.length||0} 张图片 · 点击缩略图设为主图</span><button class="btn small" data-remove-variant="${i}">移除此版本</button></div></div>`).join('')}</div></section>`;
      if(tab==='packaging')body.innerHTML=`<section class="panel cat-editor-panel"><div class="cat-section-head"><div><h3>包装资料</h3><p class="muted">可填写零售、快递、整箱等包装，并明确适用 SKU。</p></div><button class="btn" id="cat-add-pack">＋ 添加包装</button></div>${p.id==='UQ68'?'<div class="notice">原表快递包装仅适用于 UQ68KB，编辑时请保留适用范围。</div>':''}<div class="cat-pack-grid">${p.packaging.map((v,i)=>`<div class="cat-pack-edit" data-pack="${i}"><div class="cat-pack-image">${L.image(v.image,v.title||'包装图')}<button class="btn small" data-pick-pack="${i}">选择包装图</button></div><div class="cat-pack-fields"><div class="form-grid">${field('包装名称','title',v.title)}${field('适用 SKU（空白为通用）','appliesTo',v.appliesTo)}</div><label class="field"><span>包装内容 / 尺寸 / 重量</span><textarea name="text" rows="5">${E(v.text)}</textarea></label><div class="cat-section-head"><label class="check-row"><input name="pending" type="checkbox" ${v.pending?'checked':''}>待核实</label><button class="btn small" data-remove-pack="${i}">删除包装项</button></div></div></div>`).join('')||empty('尚未录入包装资料。')}</div></section>`;
      if(readonly)body.querySelectorAll('input,textarea,select,button').forEach(x=>x.disabled=true);
      body.querySelector('#cat-add-spec')?.addEventListener('click',()=>{sync();p.specs.push({label:'',key:'',value:'',pending:false});dirty=true;draw();});
      body.querySelectorAll('[data-remove-spec]').forEach(b=>b.onclick=()=>{sync();p.specs.splice(Number(b.dataset.removeSpec),1);dirty=true;draw();});
      body.querySelector('#cat-add-variant')?.addEventListener('click',()=>{sync();p.variants.push({id:L.uid('sku'),sku:null,color:null,colorLabel:'',swatch:'#bfc0c7',images:[]});dirty=true;draw();});
      body.querySelectorAll('[data-remove-variant]').forEach(b=>b.onclick=()=>{sync();if(p.variants.length===1){L.toast('每个产品至少保留一个版本。');return;}p.variants.splice(Number(b.dataset.removeVariant),1);dirty=true;draw();});
      body.querySelectorAll('[data-pick-variant]').forEach(b=>b.onclick=()=>{sync();pickImage(p.id,asset=>{const v=p.variants[Number(b.dataset.pickVariant)];if(!(v.images||[]).includes(asset.url))dirty=true;v.images=[...new Set([...(v.images||[]),asset.url])];draw();});});
      body.querySelectorAll('[data-main-image]').forEach(b=>b.onclick=()=>{sync();const [i,j]=b.dataset.mainImage.split(':').map(Number),images=p.variants[i].images;images.unshift(...images.splice(j,1));if(j)dirty=true;draw();});
      body.querySelectorAll('[data-remove-image]').forEach(b=>b.onclick=()=>{sync();const [i,j]=b.dataset.removeImage.split(':').map(Number);p.variants[i].images.splice(j,1);dirty=true;draw();});
      body.querySelector('#cat-add-pack')?.addEventListener('click',()=>{sync();p.packaging.push({title:'',text:'',image:null,appliesTo:null,pending:false});dirty=true;draw();});
      body.querySelectorAll('[data-remove-pack]').forEach(b=>b.onclick=()=>{sync();p.packaging.splice(Number(b.dataset.removePack),1);dirty=true;draw();});
      body.querySelectorAll('[data-pick-pack]').forEach(b=>b.onclick=()=>{sync();pickImage(p.id,asset=>{p.packaging[Number(b.dataset.pickPack)].image=asset.url;dirty=true;draw();});});
    }
    el.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{sync();tab=b.dataset.tab;draw();});
    function done(){dirty=false;L.isDirty=null;if(onDone)onDone(p.id);else L.go('/product?id='+encodeURIComponent(p.id));}
    el.querySelector('#cat-back').onclick=()=>{if(!onCancel){L.go('/products');return;}const leave=()=>{dirty=false;L.isDirty=null;onCancel(p.id);};if(dirty)L.confirm('放弃未保存的修改', '返回后，本次尚未保存的产品修改将被放弃。',leave);else leave();};
    el.querySelector('#cat-save').onclick=async()=>{sync();if(await saveProduct(p))done();};
    el.querySelector('#cat-editor-publish')?.addEventListener('click',()=>{sync();confirmPublish(p,done);});draw();
  }
  function pickImage(productId,onPick){
    const dialog=L.modal('从素材库选择图片',`<div class="toolbar"><input class="search-input" id="cat-picker-search" aria-label="搜索图片素材" placeholder="搜索文件名"><button class="btn" id="cat-picker-upload" ${!L.can('upload')?'disabled':''}>上传新图片</button></div><p class="muted">可选用未归档图片；保存产品时自动关联所选素材。</p><div class="cat-picker-grid" id="cat-picker-items"></div>`,{wide:true});
    function draw(){const q=dialog.querySelector('#cat-picker-search').value.toLowerCase();const assets=L.state.assets.filter(a=>a.type==='image'&&a.status!=='archived'&&a.name.toLowerCase().includes(q));dialog.querySelector('#cat-picker-items').innerHTML=assets.map(a=>`<button class="cat-pick-item" data-asset="${E(a.id)}">${L.image(a.url,a.name)}<span>${E(a.name)}</span><small>${(a.productIds||[]).includes(productId)?'已关联此产品':usages[a.usage]||'图片素材'}</small></button>`).join('')||empty('没有可选图片，请先上传图片素材。');dialog.querySelectorAll('[data-asset]').forEach(b=>b.onclick=()=>{const a=L.state.assets.find(x=>x.id===b.dataset.asset);L.closeModal();onPick(a);});}
    dialog.querySelector('#cat-picker-search').oninput=draw;
    dialog.querySelector('#cat-picker-upload').onclick=()=>{L.closeModal();openUpload({productId,imagesOnly:true,onDone:assets=>{if(assets[0])onPick(assets[0]);}});};draw();
  }
  function assetGroupAssets(productId) {
    const validIds=new Set(L.state.products.map(p=>p.id));
    return L.state.assets.filter(a=>productId==='unlinked'
      ? !(a.productIds||[]).some(id=>validIds.has(id))
      : (a.productIds||[]).includes(productId));
  }
  function renderAssetFolders(el,params,{downloadMode=false}={}) {
    const route=downloadMode?'downloads':'assets',pageTitle=downloadMode?'资料下载':'素材中心';
    const active=L.state.assets.filter(a=>a.status!=='archived');
    el.innerHTML=L.pageBanner({eyebrow:downloadMode?'DOWNLOAD CENTER':'ASSET LIBRARY',title:pageTitle,description:downloadMode?'选择产品，下载图片、视频与文件；支持单份下载和勾选打包。':'先选择产品，再查看和整理它的图片、视频与文件。',actions:downloadMode?'':`<button class="btn primary" id="cat-upload">＋ 上传素材</button>`,aside:`<div class="workspace-banner-stats"><div><strong>${L.state.products.length}</strong><span>产品资料夹</span></div><div><strong>${active.length}</strong><span>可用素材</span></div></div>`})+`<section class="cat-folder-directory" aria-label="按产品查找素材"><div class="cat-folder-toolbar"><div><h2>按产品查看</h2><p id="cat-folder-summary" aria-live="polite"></p></div><input class="search-input" id="cat-folder-search" type="search" aria-label="搜索产品" placeholder="搜索产品型号、名称或 SKU" value="${E(params.get('q')||'')}"></div><div id="cat-folder-list"></div></section>`;
    function draw(persist=false) {
      const query=el.querySelector('#cat-folder-search').value.trim(),q=query.toLowerCase();
      if(persist){const next=new URLSearchParams();if(query)next.set('q',query);history.replaceState(null,'',L.routeURL('#/'+route+(next.size?'?'+next:'')));}
      const groups=L.state.products.map(p=>({id:p.id,product:p,name:p.name,assets:assetGroupAssets(p.id)}));
      const unlinked=assetGroupAssets('unlinked');
      if(unlinked.length)groups.push({id:'unlinked',name:'未关联产品',assets:unlinked});
      const filtered=groups.filter(g=>!q||[g.id,g.name,g.product?.type,g.product?.description,g.product?.category,...(g.product?.variants||[]).flatMap(v=>[v.sku,v.name])].filter(Boolean).join(' ').toLowerCase().includes(q));
      el.querySelector('#cat-folder-summary').textContent=q?`找到 ${filtered.length} 个资料夹`:`${L.state.products.length} 个产品${unlinked.length?' · '+unlinked.length+' 份素材待关联':''}`;
      el.querySelector('#cat-folder-list').innerHTML=filtered.length?`<div class="cat-asset-folder-grid">${filtered.map(g=>{
        const available=g.assets.filter(a=>a.status!=='archived'),archived=g.assets.length-available.length;
        const href=new URLSearchParams({product:g.id});if(query)href.set('q',query);
        const cover=g.product&&(sourceImage(g.product)||available.find(a=>a.type==='image')?.url);
        const usageSummary=Object.entries(usages).filter(([key])=>available.some(a=>a.usage===key)).slice(0,3).map(([,label])=>label).join(' · ');
        return `<a class="cat-asset-folder" href="#/${route}?${E(href.toString())}" data-asset-folder="${E(g.id)}"><div class="cat-folder-cover">${g.product?L.image(cover,g.name):`<span class="cat-folder-unlinked">${L.icon('box')}<span>待整理素材</span></span>`}<span class="cat-folder-kind">${g.product?E(L.categoryName(g.product)):'未关联产品'}</span></div><div class="cat-folder-body"><div class="cat-folder-title"><h3>${E(g.name)}</h3>${L.icon('arrow')}</div><p>${E(g.product?.type||(!g.product?'为素材选择所属产品，方便集中查找。':'产品图片与资料'))}</p><div class="cat-folder-count"><strong>${available.length}<span>份可用素材</span></strong>${archived?`<span>${archived} 份已归档</span>`:''}</div><div class="cat-folder-usage">${E(usageSummary||(available.length?'查看产品素材':archived?'进入后可查看已归档素材':downloadMode?'暂无可下载素材':'暂无素材，进入后可上传'))}</div></div></a>`;
      }).join('')}</div>`:`<div class="empty-state cat-filter-empty"><h3>${q?'没有匹配的产品':'还没有产品资料夹'}</h3><p>${q?'换个型号、名称或 SKU 试试。':'录入产品后，会自动建立对应的素材资料夹。'}</p>${q?'<button class="btn" id="cat-folder-clear">清除搜索</button>':'<a class="btn" href="#/products">前往产品资料库</a>'}</div>`;
      el.querySelector('#cat-folder-clear')?.addEventListener('click',()=>{el.querySelector('#cat-folder-search').value='';draw(true);});
    }
    el.querySelector('#cat-folder-search').oninput=()=>draw(true);
    el.querySelector('#cat-upload')?.addEventListener('click',()=>openUpload({onDone:()=>L.render()}));
    draw();
  }
  function renderAssets(el,params=new URLSearchParams(),{downloadMode=false}={}) {
    if(!L.isStaff()||!L.can(downloadMode?'export':'upload')){el.innerHTML=empty('仅内部人员可以使用此功能。');return;}
    const route=downloadMode?'downloads':'assets',pageTitle=downloadMode?'资料下载':'素材中心';
    if(!params.has('product'))return renderAssetFolders(el,params,{downloadMode});
    const productId=params.get('product'),product=productById(productId),unlinked=productId==='unlinked';
    const parentParams=new URLSearchParams();if(params.get('q'))parentParams.set('q',params.get('q'));
    const parent='#/'+route+(parentParams.size?'?'+parentParams:'');
    if(!product&&!unlinked){el.innerHTML=`<div class="empty-state cat-filter-empty"><h2>这个产品资料夹不存在</h2><p>产品可能已移除，请返回${pageTitle}重新选择。</p><a class="btn primary" id="cat-asset-back" href="${E(parent)}">返回${pageTitle}</a></div>`;return;}
    const group=assetGroupAssets(productId),active=group.filter(a=>a.status!=='archived'),archived=group.length-active.length;
    const title=(unlinked?'未关联产品':product.name)+(downloadMode?' · 资料下载':unlinked?'':' · 素材');
    el.innerHTML=`<nav class="cat-asset-breadcrumb" aria-label="素材位置"><a id="cat-asset-back" href="${E(parent)}">${L.icon('back')}${pageTitle}</a><span>/</span><span aria-current="page">${E(unlinked?'未关联产品':product.name)}</span></nav>`+L.pageBanner({eyebrow:downloadMode?'PRODUCT DOWNLOADS':'PRODUCT ASSETS',title,description:downloadMode?'直接下载单份素材，或勾选所需文件后打包下载。':unlinked?'这些素材尚未关联有效产品，可在素材管理中设置所属产品。':'集中查看此产品的主图、详情页、包装和其他文件。',actions:downloadMode?(unlinked?'':`<button class="btn" id="cat-product-print">${L.icon('print')}打印产品资料</button>`):`<button class="btn primary" id="cat-upload">＋ ${unlinked?'上传素材':'上传此产品素材'}</button>`,aside:`<div class="workspace-banner-stats"><div><strong>${active.length}</strong><span>可用素材</span></div><div><strong>${archived}</strong><span>已归档</span></div></div>`})+`<div class="toolbar cat-tools cat-product-asset-tools"><input class="search-input" id="cat-asset-search" aria-label="搜索素材" placeholder="在此资料夹搜索素材文件名"><select id="cat-asset-type" aria-label="素材类型"><option value="">全部类型</option><option value="image">图片</option><option value="video">视频</option><option value="document">文档 / 文件</option></select><select id="cat-asset-usage" aria-label="素材用途"><option value="">全部用途</option>${Object.entries(usages).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select><select id="cat-asset-status" aria-label="素材状态"><option value="active">可用素材</option><option value="draft">草稿</option><option value="published">已发布</option><option value="archived">已归档</option></select><button class="btn" id="cat-asset-reset">清除筛选</button></div><div class="cat-download-toolbar"><label class="check-row"><input type="checkbox" id="cat-select-visible">全选当前筛选</label><span id="cat-selected-count" aria-live="polite">已选 0 份素材</span><button class="btn primary" id="cat-download-bundle" disabled>${L.icon('download')}打包下载已选素材</button></div><div id="cat-asset-list"></div>`;
    el.querySelector('#cat-product-print')?.addEventListener('click',()=>L.openProductPrint(productId));
    const filters={search:el.querySelector('#cat-asset-search'),type:el.querySelector('#cat-asset-type'),usage:el.querySelector('#cat-asset-usage'),status:el.querySelector('#cat-asset-status')};
    const selected=new Set();let busy=false;
    Object.entries(filters).forEach(([key,input])=>{const value=params.get(key);if(value!==null&&(input.tagName==='INPUT'||Array.from(input.options).some(o=>o.value===value)))input.value=value;});
    function visibleAssets(){
      const q=filters.search.value.trim().toLowerCase(),type=filters.type.value,usage=filters.usage.value,status=filters.status.value;
      return assetGroupAssets(productId).filter(a=>(!q||a.name.toLowerCase().includes(q))&&(!type||a.type===type)&&(!usage||a.usage===usage)&&(status==='active'?a.status!=='archived':a.status===status));
    }
    function scope(id,requireSelected=false){
      requireStaffDownload();
      const current=new URLSearchParams(location.hash.split('?')[1]||'');
      if(!filters.search.isConnected||location.hash.split('?')[0]!=='#/'+route||current.get('product')!==productId)throw new Error('已离开当前资料夹，请重新选择文件。');
      if(!visibleAssets().some(a=>a.id===id)||(requireSelected&&!selected.has(id)))throw new Error('文件已不在当前选择中，请重新勾选后下载。');
    }
    function updateSelection(){
      const visibleIds=new Set(visibleAssets().map(a=>a.id));
      for(const id of selected)if(!visibleIds.has(id))selected.delete(id);
      const selectAll=el.querySelector('#cat-select-visible'),bundle=el.querySelector('#cat-download-bundle');
      selectAll.checked=visibleIds.size>0&&selected.size===visibleIds.size;
      selectAll.indeterminate=selected.size>0&&selected.size<visibleIds.size;selectAll.disabled=!visibleIds.size;
      el.querySelector('#cat-selected-count').textContent=`已选 ${selected.size} / ${visibleIds.size} 份素材`;
      bundle.disabled=busy||!selected.size;bundle.innerHTML=busy?'正在整理文件…':L.icon('download')+'打包下载已选素材';
      el.querySelectorAll('[data-asset-select]').forEach(input=>{input.checked=selected.has(input.dataset.assetSelect);input.closest('.cat-asset-card').classList.toggle('is-selected',input.checked);});
    }
    function draw(persist=false) {
      const q=filters.search.value.trim().toLowerCase(),type=filters.type.value,usage=filters.usage.value,status=filters.status.value;
      if(persist){const next=new URLSearchParams({product:productId});if(params.get('q'))next.set('q',params.get('q'));Object.entries(filters).forEach(([key,input])=>{if(input.value&&(key!=='status'||input.value!=='active'))next.set(key,input.value);});history.replaceState(null,'',L.routeURL('#/'+route+'?'+next));}
      el.querySelector('#cat-asset-reset').disabled=!q&&!type&&!usage&&status==='active';
      const assets=visibleAssets();
      el.querySelector('#cat-asset-list').innerHTML=`<div class="cat-list-summary"><span>${assets.length} 份素材${status==='archived'?' · 已归档':''}</span><span class="muted">${L.size(assets.reduce((n,a)=>n+(a.size||0),0))} · 素材保存在本机浏览器</span></div>`+(assets.length?`<div class="cat-asset-grid">${assets.map(a=>`<article class="cat-asset-card" data-asset-card="${E(a.id)}"><label class="cat-asset-select" title="选择素材"><input type="checkbox" data-asset-select="${E(a.id)}" aria-label="选择 ${E(a.name)}"></label><button class="cat-asset-visual" data-asset-open="${E(a.id)}" aria-label="${downloadMode?'预览':'查看'} ${E(a.name)}">${a.type==='image'?L.image(a.url,a.name):`<span class="cat-file-icon">${a.type==='video'?'▶':'▤'}</span><span class="cat-file-type">${E(a.name.split('.').pop().toUpperCase())}</span>`}<span class="cat-card-status"><span class="badge ${a.status==='published'?'green':a.status==='draft'?'purple':''}">${a.status==='published'?'已发布':a.status==='draft'?'草稿':'已归档'}</span></span></button><div class="cat-asset-info"><h3 title="${E(a.name)}">${E(a.name)}</h3><p>${E(usages[a.usage]||a.usage||'未分类')} · ${E(a.language||'通用')} · v${E(a.version||1)}</p><div class="cat-asset-links">${(a.productIds||[]).map(id=>`<span>${E(productById(id)?.name||id)}</span>`).join('')||'<span class="muted">未关联产品</span>'}</div><div class="cat-asset-footer cat-asset-download-footer"><small>${a.size?L.size(a.size):'网页预览素材'}</small><div class="cat-asset-file-actions"><button class="btn small" data-asset-open="${E(a.id)}">${downloadMode?'预览':'管理'}</button><button class="btn small primary" data-asset-download="${E(a.id)}">${L.icon('download')}下载</button></div></div></div></article>`).join('')}</div>`:empty(downloadMode?'没有匹配素材，请调整筛选。':'没有匹配素材，调整筛选或上传新的素材。'));
      el.querySelectorAll('[data-asset-open]').forEach(b=>b.onclick=()=>downloadMode?previewDownloadAsset(b.dataset.assetOpen):openAsset(b.dataset.assetOpen));
      el.querySelectorAll('[data-asset-select]').forEach(input=>input.onchange=()=>{input.checked?selected.add(input.dataset.assetSelect):selected.delete(input.dataset.assetSelect);updateSelection();});
      el.querySelectorAll('[data-asset-download]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await downloadAsset(b.dataset.assetDownload,id=>scope(id));}finally{if(b.isConnected)b.disabled=false;}});
      updateSelection();
    }
    el.querySelector('#cat-select-visible').onchange=e=>{visibleAssets().forEach(a=>e.target.checked?selected.add(a.id):selected.delete(a.id));updateSelection();};
    el.querySelector('#cat-download-bundle').onclick=async()=>{
      if(busy)return;updateSelection();const ids=[...selected];if(!ids.length)return;
      busy=true;updateSelection();
      try{await downloadAssetBundle(ids,unlinked?'未关联产品':product.name,id=>scope(id,true));}
      finally{busy=false;if(filters.search.isConnected)updateSelection();}
    };
    el.querySelector('#cat-upload')?.addEventListener('click',()=>openUpload({productId:unlinked?'':productId,onDone:()=>L.render()}));
    filters.search.oninput=()=>draw(true);Object.values(filters).filter(x=>x.tagName==='SELECT').forEach(s=>s.onchange=()=>draw(true));
    el.querySelector('#cat-asset-reset').onclick=()=>{filters.search.value='';filters.type.value='';filters.usage.value='';filters.status.value='active';draw(true);};
    draw();
  }
  const fileTypes={png:'image',jpg:'image',jpeg:'image',webp:'image',gif:'image',mp4:'video',webm:'video',pdf:'document',txt:'document',csv:'document',xlsx:'document',docx:'document',pptx:'document',zip:'document',psd:'document',ai:'document'};
  function openUpload({productId='',imagesOnly=false,usage='product',onDone}={}){
    if(!guard('upload'))return;let selected=[],busy=false;
    const dialog=L.modal('上传素材',`<div class="notice">每份文件最大 12 MB，保存于当前浏览器。正式多人素材库将在接入后端后启用。</div><label class="cat-upload-drop"><input id="cat-files" type="file" multiple accept="${imagesOnly?'.png,.jpg,.jpeg,.webp,.gif':Object.keys(fileTypes).map(x=>'.'+x).join(',')}"><span class="cat-upload-symbol">↑</span><strong>选择文件，或拖入此区域</strong><span>${imagesOnly?'PNG、JPG、WebP、GIF':'支持图片、MP4 / WebM、PDF、Office 文件及源文件'}</span></label><div id="cat-file-queue"></div><div class="form-grid"><label class="field"><span>素材用途</span><select id="cat-upload-usage">${Object.entries(usages).map(([k,v])=>`<option value="${k}" ${usage===k?'selected':''}>${v}</option>`).join('')}</select></label><label class="field"><span>语言版本</span><select id="cat-upload-language"><option>通用</option><option>中文</option><option>英文</option><option>日文</option></select></label><label class="field full"><span>关联产品</span><select id="cat-upload-product"><option value="">暂不关联</option>${L.state.products.map(p=>`<option value="${E(p.id)}" ${productId===p.id?'selected':''}>${E(p.name)}</option>`).join('')}</select></label></div><div class="cat-dialog-actions"><span class="muted">上传后状态为草稿</span><button class="btn primary" id="cat-upload-save">上传并保存</button></div>`,{wide:true});
    function receive(files){if(busy||!activeUploadDialog(dialog))return;const valid=[],errors=[];for(const file of files){const ext=file.name.split('.').pop().toLowerCase(),type=fileTypes[ext];if(!type||(imagesOnly&&type!=='image'))errors.push(file.name+'：不支持此文件格式');else if(file.size>12*1024*1024)errors.push(file.name+'：超过 12 MB');else if(file.size===0)errors.push(file.name+'：文件为空');else valid.push(file);}selected=valid;dialog.querySelector('#cat-file-queue').innerHTML=`${errors.length?`<div class="notice cat-error">${errors.map(E).join('<br>')}</div>`:''}${valid.map(f=>`<div class="cat-upload-file"><span>${E(f.name)}</span><small>${L.size(f.size)}</small></div>`).join('')}`;}
    dialog.querySelector('#cat-files').onchange=e=>receive(e.target.files);
    const drop=dialog.querySelector('.cat-upload-drop');drop.ondragover=e=>{e.preventDefault();drop.classList.add('dragging');};drop.ondragleave=()=>drop.classList.remove('dragging');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('dragging');receive(e.dataTransfer.files);};
    dialog.querySelector('#cat-upload-save').onclick=async()=>{
      if(busy||!activeUploadDialog(dialog)||!guard('upload'))return;if(!selected.length){L.toast('请先选择要上传的文件。');return;}
      const b=dialog.querySelector('#cat-upload-save'),input=dialog.querySelector('#cat-files');busy=true;b.disabled=true;input.disabled=true;b.textContent='正在保存…';
      try{const pid=dialog.querySelector('#cat-upload-product').value,use=dialog.querySelector('#cat-upload-usage').value,lang=dialog.querySelector('#cat-upload-language').value;
        const assets=[];for(const file of selected){const url=await L.readFile(file);if(!activeUploadDialog(dialog)||!guard('upload'))return;assets.push({id:L.uid('asset'),name:file.name,url,type:fileTypes[file.name.split('.').pop().toLowerCase()],mime:file.type,size:file.size,productIds:pid?[pid]:[],skuIds:[],usage:use,language:lang,status:'draft',version:1,updatedAt:now(),downloadable:true});}
        if(!activeUploadDialog(dialog)||!guard('upload'))return;
        if(await commit({assets:[...L.state.assets,...assets]},'上传素材',assets.map(a=>a.name).join('、'),()=>activeUploadDialog(dialog))){if(!activeUploadDialog(dialog))return;dialog.close();L.toast(`${assets.length} 份素材已保存至本机。`);onDone?.(assets);}
      }catch(error){if(activeUploadDialog(dialog))L.toast('上传失败：'+error.message);}finally{busy=false;b.disabled=false;input.disabled=false;b.textContent='上传并保存';}
    };
  }
  function assetFamilyId(asset){
    const seen=new Set();let current=asset;
    while(current?.parentAssetId&&!seen.has(current.id)){seen.add(current.id);const parent=L.state.assets.find(x=>x.id===current.parentAssetId);if(!parent)return current.parentAssetId;current=parent;}
    return current?.id||asset.id;
  }
  function assetVersions(asset){const root=assetFamilyId(asset);return L.state.assets.filter(x=>assetFamilyId(x)===root).sort((a,b)=>(Number(b.version)||1)-(Number(a.version)||1));}
  function assetProducts(asset){return L.state.products.filter(p=>(asset.productIds||[]).includes(p.id)||referencedURLs(p).has(asset.url)||(p.liveSnapshot&&referencedURLs(p.liveSnapshot).has(asset.url))).map(p=>({product:p,inDraft:referencedURLs(p).has(asset.url),inLive:!!p.isLive&&!!p.liveSnapshot&&referencedURLs(p.liveSnapshot).has(asset.url)}));}
  function openAssetVersion(asset){
    if(!guard('upload'))return;
    const family=assetVersions(asset),nextVersion=Math.max(...family.map(x=>Number(x.version)||1))+1,affected=assetProducts(asset);
    let selected=null,busy=false;
    const accepted=Object.entries(fileTypes).filter(([,type])=>type===asset.type).map(([ext])=>'.'+ext).join(',');
    const dialog=L.modal('上传素材新版本',`<div class="cat-version-intro"><span class="badge purple">v${nextVersion} · 草稿</span><strong>${E(asset.name)}</strong><p>创建独立的新版本，旧版文件、产品发布快照与已有邀请授权都会保留。文件需保持为${asset.type==='image'?'图片':asset.type==='video'?'视频':'文档 / 源文件'}类型。</p></div><label class="cat-upload-drop"><input id="cat-version-file" type="file" accept="${E(accepted)}"><span class="cat-upload-symbol">↑</span><strong>选择新版本文件</strong><span>每份文件最大 12 MB · 新版本先保存为草稿</span></label><div id="cat-version-file-preview"></div><div class="cat-version-affected"><h3>相关产品 · ${affected.length}</h3><p class="muted">上传不会直接替换下列产品。到产品编辑中选择新图，再保存并发布，客户页面才会更新。</p>${affected.length?affected.map(({product:p,inDraft,inLive})=>`<div><strong>${E(p.name)}</strong><span>${inLive?'已发布版使用此文件':inDraft?'产品草稿使用此文件':'已关联此素材'}</span></div>`).join(''):empty('此素材尚未关联产品，可先保存版本，再关联使用。')}</div><div class="notice">新版本不会自动加入已有邀请。客户在线浏览新文件前，需要在邀请中另行授权。</div><div class="cat-dialog-actions"><button class="btn" id="cat-version-back">返回素材详情</button><button class="btn primary" id="cat-version-save" disabled>保存为 v${nextVersion} 草稿</button></div>`,{wide:true});
    dialog.querySelector('#cat-version-back').onclick=()=>openAsset(asset.id);
    dialog.querySelector('#cat-version-file').onchange=async e=>{
      if(busy||!activeUploadDialog(dialog)||!guard('upload'))return;const file=e.target.files[0],preview=dialog.querySelector('#cat-version-file-preview'),button=dialog.querySelector('#cat-version-save');selected=null;button.disabled=true;if(!file){preview.innerHTML='';return;}
      const type=fileTypes[file.name.split('.').pop().toLowerCase()];
      if(type!==asset.type){preview.innerHTML='<div class="notice cat-error">新版本文件类型应与当前素材保持一致。</div>';return;}
      if(!file.size||file.size>12*1024*1024){preview.innerHTML='<div class="notice cat-error">请选择非空文件，且大小不超过 12 MB。</div>';return;}
      preview.innerHTML='<p class="muted">正在读取文件预览…</p>';
      try{const url=await L.readFile(file);if(!activeUploadDialog(dialog)||e.target.files[0]!==file||!guard('upload'))return;selected={file,url};preview.innerHTML=`<div class="cat-version-file">${asset.type==='image'?L.image(url,file.name):`<span class="cat-file-icon">${asset.type==='video'?'▶':'▤'}</span>`}<div><strong>${E(file.name)}</strong><span>${L.size(file.size)} · v${nextVersion}</span></div></div>`;button.disabled=false;}catch(error){if(activeUploadDialog(dialog)&&e.target.files[0]===file)preview.innerHTML=`<div class="notice cat-error">${E(error.message)}</div>`;}
    };
    dialog.querySelector('#cat-version-save').onclick=async()=>{
      if(busy||!activeUploadDialog(dialog)||!guard('upload')||!selected)return;const button=dialog.querySelector('#cat-version-save'),input=dialog.querySelector('#cat-version-file');busy=true;button.disabled=true;input.disabled=true;button.textContent='正在保存…';
      try{const {file,url}=selected,newAsset={...clone(asset),id:L.uid('asset'),name:file.name,url,mime:file.type||'application/octet-stream',size:file.size,status:'draft',parentAssetId:assetFamilyId(asset),previousVersionId:asset.id,version:nextVersion,updatedAt:now(),createdAt:now()};
        delete newAsset.originalUrl;delete newAsset.originalMime;delete newAsset.originalSize;
        if(!activeUploadDialog(dialog)||!guard('upload'))return;
        if(await commit({assets:[...L.state.assets,newAsset]},'上传素材新版本',`${asset.name} → v${nextVersion}`,()=>activeUploadDialog(dialog))){if(!activeUploadDialog(dialog))return;const originHash=location.hash;await L.render();if(location.hash!==originHash||!L.isStaff()||!L.can('upload'))return;openAsset(newAsset.id);L.toast(`v${nextVersion} 已保存为独立草稿，旧版本与客户授权保持不变。`);}
      }catch(error){if(activeUploadDialog(dialog))L.toast('版本保存失败：'+error.message);}finally{busy=false;button.disabled=!selected;input.disabled=false;button.textContent=`保存为 v${nextVersion} 草稿`;}
    };
  }
  function openAsset(id){
    if(!guard('upload'))return;const a=L.state.assets.find(x=>x.id===id);if(!a)return;const readonly=!L.can('upload');
    const dialog=L.modal('素材详情',`<div class="cat-asset-detail"><div class="cat-asset-preview">${a.type==='image'?L.image(a.url,a.name):a.type==='video'?`<video controls preload="metadata" src="${E(safeURL(a.url))}"></video>`:`<div class="cat-file-icon">▤</div><strong>${E(a.name)}</strong><p class="muted">文件可下载后使用相应应用查看。</p>`}</div><div><div class="form-grid">${field('素材名称','assetName',a.name,'text','full')}<label class="field"><span>素材用途</span><select name="assetUsage">${Object.entries(usages).map(([k,v])=>`<option value="${k}" ${a.usage===k?'selected':''}>${v}</option>`).join('')}</select></label><label class="field"><span>语言</span><select name="assetLanguage">${['通用','中文','英文','日文'].map(x=>`<option ${a.language===x?'selected':''}>${x}</option>`).join('')}</select></label></div><h4>关联产品</h4><div class="cat-product-checkboxes">${L.state.products.map(p=>`<label class="check-row"><input type="checkbox" name="assetProducts" value="${E(p.id)}" ${a.productIds?.includes(p.id)?'checked':''}>${E(p.name)}</label>`).join('')}</div><p class="muted">v${E(a.version||1)} · ${a.size?L.size(a.size):'网页预览素材'} · ${L.date(a.updatedAt)}</p></div></div><div class="cat-dialog-actions"><button class="btn" id="cat-asset-download">下载文件</button>${L.can('publish')?`<button class="btn" id="cat-asset-publish">${a.status==='published'?'改为草稿':'发布素材'}</button>`:''}<div class="cat-toolbar-fill"></div><button class="btn" id="cat-asset-archive" ${readonly?'disabled':''}>${a.status==='archived'?'恢复为草稿':'归档素材'}</button><button class="btn primary" id="cat-asset-save" ${readonly?'disabled':''}>保存资料</button></div>`,{wide:true});
    if(readonly)dialog.querySelectorAll('input,select').forEach(x=>x.disabled=true);
    const family=assetVersions(a),affected=assetProducts(a);
    if(a.parentAssetId)dialog.querySelector('.cat-asset-detail').insertAdjacentHTML('beforebegin',`<div class="notice">这是独立的 v${E(a.version)} ${a.status==='published'?'已发布素材':'素材版本'}。旧版仍保留。更新产品图片需编辑产品并发布；客户在线浏览新版文件需在邀请中另行授权。</div>`);
    dialog.querySelector('.cat-dialog-actions').insertAdjacentHTML('beforebegin',`<section class="cat-version-history"><div class="cat-section-head"><h3>版本记录</h3><span class="muted">${family.length} 个版本 · 旧文件保留</span></div>${family.map(v=>`<div class="cat-version-row"><span class="cat-version-number">v${E(v.version||1)}</span><div><strong>${E(v.name)}</strong><small>${L.date(v.updatedAt)} · ${v.status==='published'?'已发布':v.status==='archived'?'已归档':'草稿'}${v.id===a.id?' · 当前查看':''}</small></div><button class="btn small" data-version-open="${E(v.id)}" ${v.id===a.id?'disabled':''}>查看</button><button class="btn small" data-version-download="${E(v.id)}">下载</button></div>`).join('')}</section>${a.parentAssetId&&affected.length?`<div class="cat-version-products"><span class="muted">相关产品</span>${affected.map(({product:p})=>`<button class="btn small" data-version-product="${E(p.id)}">编辑 ${E(p.name)}</button>`).join('')}</div>`:''}`);
    dialog.querySelector('.cat-dialog-actions').insertAdjacentHTML('afterbegin',`<button class="btn" id="cat-asset-version" ${readonly?'disabled':''}>上传新版本</button>`);
    dialog.querySelector('#cat-asset-version').onclick=()=>openAssetVersion(a);
    dialog.querySelectorAll('[data-version-open]').forEach(b=>b.onclick=()=>openAsset(b.dataset.versionOpen));
    dialog.querySelectorAll('[data-version-download]').forEach(b=>b.onclick=()=>downloadAsset(b.dataset.versionDownload));
    dialog.querySelectorAll('[data-version-product]').forEach(b=>b.onclick=()=>{L.closeModal();L.go('/editor?id='+encodeURIComponent(b.dataset.versionProduct));});
    dialog.querySelector('#cat-asset-download').onclick=()=>downloadAsset(a.id);
    async function persist(status){if(!guard('upload'))return;const next={...a,name:dialog.querySelector('[name=assetName]').value.trim(),usage:dialog.querySelector('[name=assetUsage]').value,language:dialog.querySelector('[name=assetLanguage]').value,productIds:Array.from(dialog.querySelectorAll('[name=assetProducts]:checked')).map(x=>x.value),updatedAt:now(),...(status?{status}:{})};if(!next.name){L.toast('请输入素材名称。');return;}if(await commit({assets:L.state.assets.map(x=>x.id===a.id?next:x)},'更新素材',a.name)){L.closeModal();L.toast('素材资料已保存。');L.render();}}
    dialog.querySelector('#cat-asset-save').onclick=()=>{if(guard('upload'))persist();};
    dialog.querySelector('#cat-asset-publish')?.addEventListener('click',()=>{if(guard('publish'))persist(a.status==='published'?'draft':'published');});
    dialog.querySelector('#cat-asset-archive').onclick=()=>{if(!guard('upload'))return;L.closeModal();L.confirm(a.status==='archived'?'恢复素材':'归档素材',a.status==='archived'?'素材将恢复为草稿，可重新选择使用。':'归档后，此素材不能被客户在线浏览，也不会出现在新的图片选择中。已发布产品内嵌的图片仍保留；要移除展示，请修改并重新发布产品。',async()=>{if(!guard('upload'))return;const next={...a,status:a.status==='archived'?'draft':'archived',updatedAt:now()};if(await commit({assets:L.state.assets.map(x=>x.id===a.id?next:x)},'更改素材状态',a.name)){L.toast('素材状态已更新。');L.render();}});};
  }
  function renderDetailEditor(el,params,{onDone,onCancel}={}){
    const id=params.get('id')||L.state.products[0]?.id,p=clone(productById(id)||{});
    if(!p.id){el.innerHTML=empty('请先录入产品，再制作详情页。');return;}
    p.details=p.details||[];const readonly=!L.can('edit'),inline=!!(onDone||onCancel);let dirty=false;L.isDirty=()=>dirty;
    el.innerHTML=`<div class="cat-editor-top"><button class="btn" id="cat-detail-back">← ${onCancel?'返回产品详情':'产品资料库'}</button>${inline?`<div class="cat-editor-name"><strong>${E(p.name)}</strong>${badge(p)}</div>`:`<select id="cat-detail-product" aria-label="选择产品">${L.state.products.map(x=>`<option value="${E(x.id)}" ${x.id===id?'selected':''}>${E(x.name)}</option>`).join('')}</select>`}<span class="cat-toolbar-fill"></span><button class="btn" id="cat-detail-picker" ${readonly?'disabled':''}>从素材库添加</button><button class="btn" id="cat-detail-upload" ${readonly?'disabled':''}>上传详情图</button><button class="btn" id="cat-detail-save" ${readonly?'disabled':''}>保存草稿</button>${L.can('publish')?'<button class="btn primary" id="cat-detail-publish">保存并发布</button>':''}</div><div class="notice">按展示顺序排列详情图，适合导入已有的整套商品详情页。保存草稿可继续整理；保存并发布后，客户才会看到更新。</div><div class="cat-detail-layout"><section class="panel cat-editor-panel"><div class="cat-section-head"><h3>详情页内容</h3><span class="muted" id="cat-detail-count"></span></div><div id="cat-detail-list"></div></section><aside class="cat-preview-panel"><div class="cat-preview-label"><span class="status-dot"></span>客户页面预览</div><div class="cat-phone-preview"><div class="cat-phone-brand">${E(L.company().name)}<span>产品详情</span></div><div class="cat-phone-product">${L.image(sourceImage(p),p.name)}<strong>${E(p.name)}</strong><span>${E(p.type)}</span></div><div id="cat-detail-preview"></div></div></aside></div>`;
    function sync(){el.querySelectorAll('[data-detail]').forEach(row=>{const d=p.details[Number(row.dataset.detail)];d.caption=row.querySelector('[name=caption]').value;d.language=row.querySelector('[name=language]').value;});}
    function draw(){el.querySelector('#cat-detail-count').textContent=p.details.length+' 张详情图';el.querySelector('#cat-detail-list').innerHTML=p.details.length?p.details.map((d,i)=>`<div class="cat-detail-row" data-detail="${i}"><div class="cat-detail-order">${String(i+1).padStart(2,'0')}</div><div class="cat-detail-thumb">${L.image(d.url,d.caption||'详情图')}</div><div class="cat-detail-fields">${field('图片说明（可选）','caption',d.caption)}<label class="field"><span>语言</span><select name="language">${['通用','中文','英文','日文'].map(x=>`<option ${d.language===x?'selected':''}>${x}</option>`).join('')}</select></label><div class="row-actions"><button class="btn small" data-move-up="${i}" ${i===0||readonly?'disabled':''}>↑ 上移</button><button class="btn small" data-move-down="${i}" ${i===p.details.length-1||readonly?'disabled':''}>↓ 下移</button><button class="btn small" data-detail-remove="${i}" ${readonly?'disabled':''}>移除</button></div></div></div>`).join(''):`<div class="cat-detail-empty"><span>▧</span><h3>把已有详情页放到这里</h3><p>上传长图或从素材库选择图片，再调整展示顺序。</p><button class="btn" id="cat-detail-empty-add" ${readonly?'disabled':''}>添加第一张详情图</button></div>`;
      el.querySelector('#cat-detail-preview').innerHTML=p.details.length?p.details.map(d=>`${L.image(d.url,d.caption||p.name+' 详情图')}${d.caption?`<p>${E(d.caption)}</p>`:''}`).join(''):'<p class="cat-preview-empty">添加详情图后，在这里预览完整展示效果</p>';
      if(readonly)el.querySelectorAll('#cat-detail-list input,#cat-detail-list select').forEach(x=>x.disabled=true);
      el.querySelectorAll('[data-move-up]').forEach(b=>b.onclick=()=>{sync();const i=Number(b.dataset.moveUp);[p.details[i-1],p.details[i]]=[p.details[i],p.details[i-1]];dirty=true;draw();});
      el.querySelectorAll('[data-move-down]').forEach(b=>b.onclick=()=>{sync();const i=Number(b.dataset.moveDown);[p.details[i+1],p.details[i]]=[p.details[i],p.details[i+1]];dirty=true;draw();});
      el.querySelectorAll('[data-detail-remove]').forEach(b=>b.onclick=()=>{sync();p.details.splice(Number(b.dataset.detailRemove),1);dirty=true;draw();});
      el.querySelectorAll('[name=caption]').forEach(input=>input.oninput=()=>{sync();const index=Number(input.closest('[data-detail]').dataset.detail);const preview=el.querySelector('#cat-detail-preview');preview.innerHTML=p.details.map(d=>`${L.image(d.url,d.caption||p.name+' 详情图')}${d.caption?`<p>${E(d.caption)}</p>`:''}`).join('');});
      el.querySelector('#cat-detail-empty-add')?.addEventListener('click',addFromLibrary);
    }
    el.querySelector('#cat-detail-list').addEventListener('input',()=>{if(!readonly)dirty=true;});
    function addAsset(a){if(p.details.some(x=>x.assetId===a.id)){L.toast('此图片已在详情页中。');return;}p.details.push({id:L.uid('detail'),assetId:a.id,url:a.url,caption:'',language:a.language||'通用'});dirty=true;}
    function addFromLibrary(){if(!guard('edit'))return;sync();pickImage(p.id,a=>{addAsset(a);draw();});}
    el.querySelector('#cat-detail-product')?.addEventListener('change',e=>L.go('/detail-editor?id='+encodeURIComponent(e.target.value)));
    el.querySelector('#cat-detail-picker').onclick=addFromLibrary;
    el.querySelector('#cat-detail-upload').onclick=()=>{if(!guard('edit'))return;sync();openUpload({productId:p.id,imagesOnly:true,usage:'detail',onDone:assets=>{assets.forEach(addAsset);draw();}});};
    function done(){dirty=false;L.isDirty=null;if(onDone)onDone(p.id);else L.go('/product?id='+encodeURIComponent(p.id));}
    el.querySelector('#cat-detail-back').onclick=()=>{if(!onCancel){L.go('/products');return;}const leave=()=>{dirty=false;L.isDirty=null;onCancel(p.id);};if(dirty)L.confirm('放弃未保存的修改','返回后，本次尚未保存的详情图修改将被放弃。',leave);else leave();};
    el.querySelector('#cat-detail-save').onclick=async()=>{sync();if(await saveProduct(p))done();};
    el.querySelector('#cat-detail-publish')?.addEventListener('click',()=>{sync();confirmPublish(p,done);});draw();
  }
  function openProductBackup(){
    if(!guard('edit'))return;
    const dialog=L.modal('导出产品资料备份',`<p>将当前产品草稿资料保存为一份可迁移的 JSON 文件，包含产品规格、颜色 / SKU、产品图片、条码、包装图片和详情图。</p><div class="notice">仅备份产品资料。不包含邀请、账号、素材库历史版本或导出模板配置。通过“导入 Excel”选择此 JSON 文件恢复时，资料会保存为草稿，不会直接覆盖客户发布版本。</div><div class="cat-dialog-actions"><span class="muted">${L.state.products.length} 个产品系列 · 图片将嵌入文件</span><button class="btn primary" id="cat-backup-download">下载产品资料备份</button></div>`,{wide:true});
    dialog.querySelector('#cat-backup-download').onclick=async()=>{
      if(!guard('edit'))return;const button=dialog.querySelector('#cat-backup-download');button.disabled=true;button.textContent='正在整理图片…';
      try{
        requireStaffDownload();
        const catalog={schemaVersion:1,source:{filename:L.company().name+'_产品资料备份.json',companyId:L.companyId(),originalWorkbook:L.catalog().source.filename,importedAt:now(),scope:'products-only'},products:L.state.products.map(p=>{const copy=clone(p);delete copy.liveSnapshot;delete copy.isLive;delete copy.status;return copy;})};
        const images=new Map();
        async function embed(url){
          if(!url)return url;if(!L.safeURL(url))throw new Error('有图片地址无效，请先检查产品图片。');if(url.startsWith('data:'))return url;
          if(!images.has(url))images.set(url,(async()=>{const response=await fetch(url);if(!response.ok)throw new Error('图片读取失败，备份未完成。');const mime=/\.png$/i.test(url)?'image/png':/\.jpe?g$/i.test(url)?'image/jpeg':/\.gif$/i.test(url)?'image/gif':'image/webp';const blob=new Blob([await response.arrayBuffer()],{type:mime});return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('图片写入备份失败。'));reader.readAsDataURL(blob);});})());
          return images.get(url);
        }
        for(const p of catalog.products){for(const v of p.variants){v.images=await Promise.all(v.images.map(embed));if(v.barcodeImage)v.barcodeImage=await embed(v.barcodeImage);}for(const item of p.packaging)if(item.image)item.image=await embed(item.image);for(const detail of p.details||[])if(detail.url)detail.url=await embed(detail.url);}
        requireStaffDownload();L.download(new Blob([JSON.stringify(catalog)],{type:'application/json'}),L.company().name+'_产品资料备份_'+new Date().toISOString().slice(0,10)+'.json');L.closeModal();L.toast('产品资料与图片已备份，可从导入入口恢复为草稿。');
      }catch(error){L.toast('备份失败：'+error.message);button.disabled=false;button.textContent='下载产品资料备份';}
    };
  }
  function validateLegacyCatalog(c){
    if(!c||c.schemaVersion!==1||!c.source||typeof c.source.filename!=='string'||!Array.isArray(c.products)||!c.products.length)throw new Error('文件不是旧版产品库备份，请选择原产品库导出的 JSON 文件。');
    const ids=new Set(),variantIds=new Set();
    const validImage=url=>typeof url==='string'&&!!L.safeURL(url)&&/^(?:assets\/|data:image\/(?:png|jpeg|webp|gif);base64,)/.test(url);
    for(const p of c.products){
      if(typeof p.id!=='string'||!p.id||ids.has(p.id)||typeof p.name!=='string'||!Array.isArray(p.variants)||!p.variants.length||!['specs','packaging','issues','tags'].every(k=>Array.isArray(p[k])))throw new Error('备份的产品字段不完整或产品编号重复。');ids.add(p.id);
      for(const v of p.variants){if(typeof v.id!=='string'||!v.id||variantIds.has(v.id)||!Array.isArray(v.images)||!v.images.every(validImage))throw new Error('备份包含重复的颜色版本编号或无效图片。');variantIds.add(v.id);if(v.barcodeImage&&!validImage(v.barcodeImage))throw new Error('备份中的条码图片格式无效。');}
      for(const item of p.packaging){if(!item||typeof item!=='object'||item.image&&!validImage(item.image))throw new Error('备份中的包装资料格式无效。');}
      if(p.details!==undefined&&(!Array.isArray(p.details)||p.details.some(d=>!d||typeof d!=='object'||!validImage(d.url))))throw new Error('备份中的详情页图片格式无效。');
      if(p.brand!==undefined&&p.brand!==null&&typeof p.brand!=='string')throw new Error('备份中的品牌字段格式无效。');
      if(p.specs.some(s=>!s||typeof s!=='object')||p.tags.some(t=>typeof t!=='string')||p.issues.some(i=>!i||typeof i!=='object'))throw new Error('备份中的规格、标签或核实事项格式无效。');
    }
    return c;
  }
  function openImport(){
    if(!guard('edit'))return;
    const dialog=L.modal('从 Excel 导入产品草稿',`<p>支持原产品报价表的同结构 .xlsx 文件，含产品图片；也兼容旧版产品库导出的 .json 备份。导入仅新增或更新草稿，不会删除现有产品，也不会替换已发布快照。</p><label class="cat-upload-drop"><input id="cat-import-file" type="file" accept=".xlsx,.json"><span class="cat-upload-symbol">▤</span><strong>选择产品报价表或旧版备份</strong><span>本地解析，原文件保持不变 · 最大 150 MB</span></label><div id="cat-import-preview"></div>`,{wide:true});
    dialog.querySelector('#cat-import-file').onchange=async e=>{
      const file=e.target.files[0];if(!file)return;const preview=dialog.querySelector('#cat-import-preview');preview.innerHTML='<div class="notice">正在读取表格与图片，请稍候…</div>';e.target.disabled=true;
      try{if(file.size>150*1024*1024)throw new Error('文件超过 150 MB，请先减少表格内的超大图片。');let result;if(/\.json$/i.test(file.name)){const catalog=validateLegacyCatalog(JSON.parse(await file.text()));result={catalog,summary:{products:catalog.products.length,variants:catalog.products.reduce((n,p)=>n+p.variants.length,0)},warnings:[]};}else if(/\.xlsx$/i.test(file.name)){if(!window.ProductImporter)throw new Error('表格读取组件尚未加载，请刷新页面后重试。');result=await ProductImporter.parse(file,{...L.catalog(),products:L.state.products});}else throw new Error('请选择 .xlsx 产品报价表或旧版 .json 产品库备份。');
        const added=result.summary.added??result.catalog.products.filter(p=>!L.state.products.some(old=>old.id===p.id)).length,warnings=result.warnings||[];
        preview.innerHTML=`<div class="cat-import-summary"><div><strong>${result.summary.products}</strong><span>产品系列</span></div><div><strong>${result.summary.variants}</strong><span>颜色版本</span></div><div><strong>${added}</strong><span>新增系列</span></div></div><div class="notice">导入内容将逐项存为草稿；本文件中未出现的现有产品仍保留，客户发布版不受影响。</div>${warnings.length?`<details class="cat-import-warnings"><summary>${warnings.length} 项解析提示</summary><p class="muted">以下为原表差异提示。本次采用草稿合并，未出现的现有产品不会被删除。</p>${warnings.map(w=>`<p>${E(typeof w==='string'?w:w.message||JSON.stringify(w))}</p>`).join('')}</details>`:''}<div class="cat-import-products">${result.catalog.products.map(p=>`<div>${L.image(sourceImage(p),p.name)}<strong>${E(p.name)}</strong><span>${p.variants.length} 个版本</span></div>`).join('')}</div><div class="cat-dialog-actions"><button class="btn primary" id="cat-import-confirm">确认导入为草稿</button></div>`;
        preview.querySelector('#cat-import-confirm').onclick=async()=>{if(!guard('edit'))return;const b=preview.querySelector('#cat-import-confirm');b.disabled=true;const products=L.state.products.slice(),assets=L.state.assets.slice();for(const imported of result.catalog.products){const old=products.find(x=>x.id===imported.id);const p={...imported,...(imported.brand===undefined&&typeof old?.brand==='string'?{brand:old.brand}:{}),details:/\.json$/i.test(file.name)?(imported.details||old?.details||[]):(old?.details||[]),status:'draft',isLive:old?.isLive||false,liveSnapshot:old?.liveSnapshot,updatedAt:now()};const at=products.findIndex(x=>x.id===p.id);if(at<0)products.push(p);else products[at]=p;for(const url of referencedURLs(p)){if(!assets.some(a=>a.url===url)){assets.push({id:L.uid('asset'),name:p.name+' 导入图片 '+(assets.length+1),url,type:'image',mime:url.startsWith('data:')?url.slice(5,url.indexOf(';')):'image/webp',size:0,productIds:[p.id],skuIds:[],usage:'product',language:'通用',status:'draft',version:1,updatedAt:now(),downloadable:true});}}}
          if(await commit({products,assets},/\.json$/i.test(file.name)?'旧版备份导入草稿':'Excel 导入草稿',file.name)){L.closeModal();L.toast('产品草稿已导入，请核实后发布。');L.render();}else b.disabled=false;};
      }catch(error){preview.innerHTML=`<div class="notice cat-error">${E(error.message)}</div>`;}finally{e.target.disabled=false;}
    };
  }
  L.withdrawProduct=withdrawProduct;
  L.openProductImport=openImport;
  L.openProductBackup=openProductBackup;
  L.openCategoryManager=openCategoryManager;
  L.openAssetUpload=openUpload;
  L.openAssetEditor=id=>{if(guard('upload'))openAsset(id);};
  L.renderProductEditor=renderEditor;
  L.renderDetailEditor=renderDetailEditor;
  L.register('products',{title:'产品资料库',subtitle:'浏览产品、查看规格与相关资料。',banner:true,render:(el,params)=>L.renderCollection(el,params)});
  L.register('editor',{title:'产品资料',subtitle:'将产品事实整理为可复用的资料',render:renderEditor});
  L.register('assets',{title:'素材中心',subtitle:'按产品整理图片、视频与文件。',banner:true,render:renderAssets});
  L.register('downloads',{title:'资料下载',subtitle:'按产品下载图片、视频与文件。',banner:true,render:(el,params)=>renderAssets(el,params,{downloadMode:true})});
  L.register('detail-editor',{title:'详情页管理',subtitle:'上传、排列并预览产品详情图',render:renderDetailEditor});
})();
