(() => {
  'use strict';
  const L=window.Library,E=value=>L.esc(value??''),P={};
  const FORMAT='uniqmag-quotation-template',BUILTIN='quotation-default',SETTINGS='quotation-template-settings',LIMIT=2*1024*1024,LOGO_LIMIT=1024*1024;
  const KEYS=['image','product','color','quantity','unitPrice','amount'],REQUIRED=['product','quantity','unitPrice','amount'];
  const COLUMN_NAMES={image:'产品图片',product:'产品 / SKU',color:'配色',quantity:'数量',unitPrice:'单价',amount:'金额'};
  const DEFAULT_COLUMNS=[{key:'image',label:'产品图片',width:14},{key:'product',label:'产品 / SKU',width:30},{key:'color',label:'配色',width:16},{key:'quantity',label:'数量',width:10},{key:'unitPrice',label:'单价',width:15},{key:'amount',label:'金额',width:15}];
  const clone=value=>structuredClone(value),own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
  let saving=false;
  function access(manage=false,expected){
    const member=L.currentMember?.(),brand=L.company?.();
    if(!member||!['admin','business'].includes(member.role)||!L.isStaff()||!L.can('quote')||!brand?.id||!L.state)throw new Error('报价模板仅供已登录的管理员和业务人员使用。');
    if(manage&&(member.role!=='admin'||!L.can('templates')))throw new Error('仅管理员可以管理报价 PDF 模板。');
    const c={companyId:brand.id,brand:clone(brand),state:L.state,memberId:member.id,role:member.role,memberName:member.name||''};
    if(expected&&(c.companyId!==expected.companyId||c.state!==expected.state||c.memberId!==expected.memberId||c.role!==expected.role))throw new Error('公司主体或登录账号已改变，请重新打开报价模板。');
    return c;
  }
  function object(value,keys,label){
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(label+'格式不正确。');
    const proto=Object.getPrototypeOf(value);if(proto!==null&&Object.getPrototypeOf(proto)!==null)throw new Error(label+'格式不正确。');
    for(const key of Object.keys(value))if(!keys.includes(key))throw new Error(label+'含有不支持的字段：'+key);
    for(const key of keys)if(!own(value,key))throw new Error(label+'缺少字段：'+key);
  }
  function text(value,max,label,empty=false){
    if(typeof value!=='string'||[...value].length>max||(!empty&&!value.trim()))throw new Error(label+'长度不正确。');
    if(/[<>\u0000-\u001F\u007F]/.test(value)||/\b(?:javascript|vbscript)\s*:/i.test(value))throw new Error(label+'只能填写纯文本。');
    return value.trim();
  }
  function config(value){
    object(value,['title','footerText','logoData','orientation','fontSize','margin','columns'],'报价模板设置');
    if(!['portrait','landscape'].includes(value.orientation))throw new Error('纸张方向仅支持纵向或横向。');
    if(!Number.isFinite(value.fontSize)||value.fontSize<8||value.fontSize>12||!Number.isInteger(value.fontSize*2))throw new Error('字号需要在 8–12 pt 之间，步进为 0.5。');
    if(!Number.isInteger(value.margin)||value.margin<12||value.margin>25)throw new Error('页边距需要是 12–25 mm 的整数。');
    if(!Array.isArray(value.columns)||value.columns.length<4||value.columns.length>6)throw new Error('报价模板需要 4–6 列。');
    const seen=new Set();const columns=value.columns.map(column=>{
      object(column,['key','label','width'],'报价列');
      if(!KEYS.includes(column.key)||seen.has(column.key))throw new Error('报价列不受支持或出现重复。');seen.add(column.key);
      if(!Number.isFinite(column.width)||column.width<5||column.width>60)throw new Error('每列宽度权重需要在 5–60 之间。');
      return {key:column.key,label:text(column.label,30,'列标题'),width:column.width};
    });
    if(REQUIRED.some(key=>!seen.has(key)))throw new Error('必须保留产品、数量、单价和金额列。');
    if(typeof L.printTemplates?.validateLogo!=='function')throw new Error('Logo 校验组件尚未就绪，请刷新后重试。');
    return {title:text(value.title,60,'报价单标题'),footerText:text(value.footerText,120,'页脚文字',true),logoData:L.printTemplates.validateLogo(value.logoData),orientation:value.orientation,fontSize:value.fontSize,margin:value.margin,columns};
  }
  P.validateFile=data=>{
    if(typeof data==='string'){
      if(new TextEncoder().encode(data).length>LIMIT)throw new Error('报价模板不能超过 2 MB。');
      try{data=JSON.parse(data.replace(/^\uFEFF/,''));}catch{throw new Error('模板不是有效的 JSON 文件，请先下载标准报价模板。');}
    }
    object(data,['format','version','name','config'],'模板文件');
    if(data.format!==FORMAT||data.version!==1)throw new Error('这不是受支持的报价 PDF 模板。');
    const valid={format:FORMAT,version:1,name:text(data.name,60,'模板名称'),config:config(data.config)};
    if(new TextEncoder().encode(JSON.stringify(valid)).length>LIMIT)throw new Error('报价模板不能超过 2 MB。');
    return valid;
  };
  function builtin(c){return {id:BUILTIN,kind:'quotation-template',companyId:c.companyId,name:c.brand.name+' 标准报价模板',status:'published',version:1,builtin:true,config:{title:'产品报价单',footerText:c.brand.name,logoData:'',orientation:'portrait',fontSize:9,margin:14,columns:clone(DEFAULT_COLUMNS)}};}
  function items(c){
    access(false,c);const result=[builtin(c)],seen=new Set([BUILTIN]);
    for(const item of c.state.templates||[]){
      if(item?.kind!=='quotation-template'||typeof item.id!=='string'||!item.id||seen.has(item.id)||(item.companyId&&item.companyId!==c.companyId))continue;
      try{const valid=P.validateFile({format:FORMAT,version:1,name:item.name,config:item.config});if(!Number.isInteger(item.version)||item.version<1)continue;result.push({...clone(item),name:valid.name,config:valid.config,builtin:false});seen.add(item.id);}catch{/* Do not display malformed saved templates. */}
    }
    return result;
  }
  function find(id,c){return items(c).find(item=>item.id===id)||null;}
  function defaultFor(c){const settings=(c.state.templates||[]).find(item=>item.id===SETTINGS&&item.kind===SETTINGS&&(!item.companyId||item.companyId===c.companyId));return find(settings?.defaultId,c)?.id||BUILTIN;}
  P.list=()=>{try{return items(access());}catch{return [];}};
  P.get=id=>{try{return find(id,access());}catch{return null;}};
  P.defaultId=()=>defaultFor(access());
  P.resolve=id=>{const c=access();if(id!==undefined&&id!==null&&typeof id!=='string')throw new Error('报价模板标识不正确。');const item=find(id||defaultFor(c),c);if(!item)throw new Error('所选报价模板不存在或已失效，请重新选择模板。');return item;};
  P.configFor=id=>clone(P.resolve(id).config);
  P.download=id=>{const c=access(),item=P.resolve(id);access(false,c);const valid=P.validateFile({format:FORMAT,version:1,name:item.name,config:item.config});L.download(new Blob([JSON.stringify(valid,null,2)+'\n'],{type:'application/json;charset=utf-8'}),item.name+'.quotation-template.json');};
  async function decodeLogo(value,c){
    access(true,c);if(!value)return;
    await new Promise((resolve,reject)=>{
      const image=new Image();let done=false;
      const finish=error=>{if(done)return;done=true;clearTimeout(timer);image.onload=null;image.onerror=null;error?reject(error):resolve();};
      const timer=setTimeout(()=>finish(new Error('Logo 图片读取超时，请重新选择。')),6000);
      image.onload=()=>{const w=image.naturalWidth,h=image.naturalHeight;finish(Number.isInteger(w)&&Number.isInteger(h)&&w>0&&h>0&&w<=4096&&h<=4096&&w*h<=8000000?null:new Error('Logo 图片无效或尺寸超过限制。'));};
      image.onerror=()=>finish(new Error('Logo 图片无法读取，请使用有效的 PNG、JPG 或 WebP。'));
      image.src=value;
    });access(true,c);
  }
  const same=(a,b)=>a===b||JSON.stringify(a)===JSON.stringify(b);
  function storedRecord(c,id){return (c.state.templates||[]).find(item=>item.id===id);}
  async function persist(c,next,action){
    access(true,c);const previous=storedRecord(c,next.id),had=own(c.state,'templates'),logId=L.uid('log');
    const current=Array.isArray(c.state.templates)?c.state.templates:[];
    c.state.templates=previous?current.map(item=>item.id===next.id?next:item):[...current,next];
    const log={id:logId,action,target:next.name||'报价模板',time:new Date().toISOString(),actor:c.memberName};
    if(!Array.isArray(c.state.logs))c.state.logs=[];c.state.logs.unshift(log);
    try{access(true,c);await L.save();access(true,c);return clone(next);}
    catch(error){
      const records=c.state.templates,index=Array.isArray(records)?records.findIndex(item=>item.id===next.id):-1;
      if(index>=0&&same(records[index],next)){if(previous)records.splice(index,1,previous);else records.splice(index,1);if(!had&&!records.length)delete c.state.templates;}
      if(Array.isArray(c.state.logs))c.state.logs=c.state.logs.filter(item=>item.id!==logId);
      throw error;
    }
  }
  P.saveTemplate=async(data,id)=>{
    const c=access(true);if(saving)throw new Error('报价模板正在保存，请稍候。');saving=true;
    try{
      const valid=P.validateFile(data),previous=id?find(id,c):null,original=id?clone(storedRecord(c,id)||null):null;
      if(id&&(!previous||previous.builtin))throw new Error('标准模板请另存为新模板。');
      await decodeLogo(valid.config.logoData,c);access(true,c);
      if(id&&!same(storedRecord(c,id)||null,original))throw new Error('报价模板已更新，请重新打开后修改。');
      const now=new Date().toISOString(),next={id:id||L.uid('quotation-template'),kind:'quotation-template',companyId:c.companyId,name:valid.name,status:'published',version:(previous?.version||0)+1,config:valid.config,fileName:valid.name+'.quotation-template.json',createdAt:previous?.createdAt||now,updatedAt:now};
      await persist(c,next,previous?'修改报价 PDF 模板':'上传或创建报价 PDF 模板');return P.resolve(next.id);
    }finally{saving=false;}
  };
  P.setDefault=async id=>{
    const c=access(true);if(saving)throw new Error('报价模板正在保存，请稍候。');const item=find(id,c);if(!item)throw new Error('找不到此报价模板。');saving=true;
    try{await persist(c,{id:SETTINGS,kind:SETTINGS,companyId:c.companyId,name:'默认报价 PDF 模板',defaultId:item.id,updatedAt:new Date().toISOString()},'设置默认报价 PDF 模板');return item.id;}finally{saving=false;}
  };
  const label=column=>column.label+(column.key==='unitPrice'||column.key==='amount'?' (USD)':'');
  function paper(config,brand,mini=false){
    const sum=config.columns.reduce((total,column)=>total+column.width,0);
    const values={image:'<span class="qtpl-example-photo">产品图片</span>',product:'<strong>示例产品 A</strong><small>SKU-DEMO-001</small>',color:'灰色',quantity:'100',unitPrice:'12.50',amount:'1,250.00'};
    return `<div class="qtpl-paper ${config.orientation==='landscape'?'qtpl-landscape':''}${mini?' qtpl-mini':''}" style="--qtpl-font:${config.fontSize}pt;--qtpl-margin:${config.margin}mm" data-no-translate><header><img src="${E(config.logoData||brand.logo)}" alt="${E(brand.name)} Logo"><h3>${E(config.title)}</h3></header><div class="qtpl-paper-meta"><span>客户名称：示例客户</span><span>报价编号：QT-SAMPLE-001</span><span>币种：USD</span><span>有效期至：2026-12-31</span></div><table><colgroup>${config.columns.map(column=>`<col style="width:${column.width/sum*100}%">`).join('')}</colgroup><thead><tr>${config.columns.map(column=>`<th data-qtpl-column="${column.key}">${E(label(column))}</th>`).join('')}</tr></thead><tbody><tr>${config.columns.map(column=>`<td data-qtpl-column="${column.key}">${values[column.key]}</td>`).join('')}</tr></tbody></table><p class="qtpl-paper-total">合计 (USD) <strong>1,250.00</strong></p><p class="qtpl-paper-note">此处仅为模板示例，不包含真实客户报价。</p><footer>${E(config.footerText)}</footer></div>`;
  }
  P.preview=id=>{
    const c=access(),item=P.resolve(id);access(false,c);
    const dialog=L.modal('报价模板示例预览',`<p class="qtpl-preview-hint">示例仅展示模板版式。真实报价 PDF 会填入报价单中的客户、产品与价格。</p><div class="qtpl-preview-scroll">${paper(item.config,c.brand)}</div><div class="modal-actions"><button type="button" class="btn" data-qtpl-preview-close>关闭预览</button></div>`,{wide:true});
    dialog.querySelector('[data-qtpl-preview-close]').onclick=()=>dialog.close();return dialog;
  };
  function showError(target,error){target.textContent=error?.message||'操作未完成，请重试。';target.hidden=false;}
  function refresh(el,c){access(true,c);if(el?.isConnected!==false){if(L.route==='templates'&&typeof L.render==='function')L.render();else P.renderManager(el);}}
  function openPreview(id){return P.preview(id);}
  P.renderManager=el=>{
    let c;try{c=access(true);}catch{el.innerHTML='<div class="empty-state"><h2>仅管理员可以管理报价 PDF 模板</h2><p>业务人员可在报价单中选择已保存的模板。</p></div>';return;}
    const rows=items(c),defaultId=defaultFor(c);
    el.innerHTML=`<section class="qtpl-manager"><div class="qtpl-toolbar"><div><h2>报价 PDF 模板</h2><p>设置报价单版式，生成 PDF 时自动填入真实报价。</p></div><div class="row-actions"><button type="button" class="btn" data-qtpl-standard>下载标准模板</button><button type="button" class="btn" data-qtpl-upload>上传报价模板</button><button type="button" class="btn primary" data-qtpl-new>＋ 新建报价模板</button></div></div><input type="file" accept=".json,application/json" data-qtpl-file hidden><div class="notice"><span>先下载标准 .json 模板修改，或直接在网页编辑。上传后可用于真实报价 PDF；不支持将 Word、Excel 或 PDF 自动识别为模板。模板保存在当前浏览器，建议下载备份。</span></div><p class="qtpl-error" role="alert" hidden></p><div class="qtpl-grid">${rows.map(item=>`<article class="qtpl-card"><div class="qtpl-card-preview">${paper(item.config,c.brand,true)}</div><div class="qtpl-card-copy"><div class="qtpl-card-badges"><span class="badge">${item.builtin?'标准模板':'自定义模板'}</span>${item.id===defaultId?'<span class="badge">默认使用</span>':''}</div><h3 data-no-translate>${E(item.name)}</h3><p>A4 ${item.config.orientation==='portrait'?'纵向':'横向'} · ${item.config.fontSize} pt · ${item.config.columns.length} 列</p><div class="row-actions"><button type="button" class="btn small" data-qtpl-edit="${E(item.id)}">${item.builtin?'编辑为新模板':'编辑模板'}</button><button type="button" class="btn small" data-qtpl-preview="${E(item.id)}">示例预览</button><button type="button" class="btn small" data-qtpl-download="${E(item.id)}">下载模板</button></div><button type="button" class="qtpl-default" data-qtpl-default="${E(item.id)}" ${item.id===defaultId?'disabled':''}>${item.id===defaultId?'当前默认模板':'设为默认'}</button></div></article>`).join('')}</div></section>`;
    const error=el.querySelector('.qtpl-error'),input=el.querySelector('[data-qtpl-file]'),upload=el.querySelector('[data-qtpl-upload]');
    const handle=async task=>{error.hidden=true;try{access(true,c);await task();access(true,c);}catch(cause){if(el.isConnected!==false)showError(error,cause);}};
    el.querySelector('[data-qtpl-standard]').onclick=()=>handle(()=>P.download(BUILTIN));
    upload.onclick=()=>handle(()=>input.click());
    input.onchange=()=>handle(async()=>{const file=input.files?.[0];input.value='';if(!file)return;const captured=access(true,c);if(!/\.json$/i.test(file.name))throw new Error('请选择 .json 报价模板文件。');if(file.size>LIMIT)throw new Error('报价模板不能超过 2 MB。');upload.disabled=true;try{const source=await file.text();access(true,captured);const data=P.validateFile(source);await P.saveTemplate(data);access(true,captured);refresh(el,captured);L.toast('报价模板已上传，可在报价单中选择。');}finally{upload.disabled=false;}});
    el.querySelector('[data-qtpl-new]').onclick=()=>handle(()=>edit(null,el,c));
    el.querySelectorAll('[data-qtpl-edit]').forEach(button=>button.onclick=()=>handle(()=>edit(button.dataset.qtplEdit,el,c)));
    el.querySelectorAll('[data-qtpl-preview]').forEach(button=>button.onclick=()=>handle(()=>openPreview(button.dataset.qtplPreview)));
    el.querySelectorAll('[data-qtpl-download]').forEach(button=>button.onclick=()=>handle(()=>P.download(button.dataset.qtplDownload)));
    el.querySelectorAll('[data-qtpl-default]').forEach(button=>button.onclick=()=>handle(async()=>{button.disabled=true;try{await P.setDefault(button.dataset.qtplDefault);access(true,c);refresh(el,c);L.toast('默认报价模板已更新。');}finally{button.disabled=false;}}));
  };
  function edit(id,manager,c){
    access(true,c);const source=id?P.resolve(id):builtin(c),isNew=!id||source.builtin;
    const initial={format:FORMAT,version:1,name:isNew?'自定义报价模板':source.name,config:clone(source.config)};
    let logoData=initial.config.logoData,logoBusy=false,saveBusy=false,columns=clone(initial.config.columns);
    const dialog=L.modal(isNew?'新建报价 PDF 模板':'编辑报价 PDF 模板',`<form class="qtpl-editor"><div class="qtpl-editor-grid"><div class="qtpl-fields"><label class="field"><span>模板名称</span><input name="templateName" maxlength="60" value="${E(initial.name)}" required></label><div class="form-grid"><label class="field"><span>报价单标题</span><input name="title" maxlength="60" value="${E(initial.config.title)}" required></label><label class="field"><span>页脚文字</span><input name="footerText" maxlength="120" value="${E(initial.config.footerText)}"></label><label class="field"><span>纸张方向</span><select name="orientation"><option value="portrait" ${initial.config.orientation==='portrait'?'selected':''}>A4 纵向</option><option value="landscape" ${initial.config.orientation==='landscape'?'selected':''}>A4 横向</option></select></label><label class="field"><span>字号（pt）</span><input name="fontSize" type="number" min="8" max="12" step="0.5" value="${initial.config.fontSize}" required></label><label class="field"><span>页边距（mm）</span><input name="margin" type="number" min="12" max="25" step="1" value="${initial.config.margin}" required></label></div><fieldset class="qtpl-logo"><legend>品牌 Logo</legend><div class="qtpl-logo-preview"></div><div class="row-actions"><button type="button" class="btn small" data-qtpl-logo-upload>上传 Logo</button><button type="button" class="btn small" data-qtpl-logo-reset>恢复官方 Logo</button></div><small>PNG、JPG 或 WebP，最大 1 MB、4096 像素、800 万像素。</small><input type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" data-qtpl-logo-file hidden></fieldset><div class="qtpl-columns-heading"><h3>报价列</h3><p>产品、数量、单价和金额必须保留。宽度为相对权重，不必合计为 100。</p></div><div data-qtpl-columns></div><div class="row-actions" data-qtpl-optional></div></div><aside class="qtpl-editor-aside"><h3>版式示例</h3><div class="qtpl-editor-preview" data-qtpl-example></div><small>示例用于检查标题、列顺序和宽度。保存后可在报价单中生成实际 PDF。</small></aside></div><p class="qtpl-error" role="alert" hidden></p><div class="modal-actions"><button type="button" class="btn" data-qtpl-cancel>取消</button><button type="button" class="btn" data-qtpl-save-preview>保存并预览</button><button type="submit" class="btn primary">保存模板</button></div></form>`,{wide:true});
    dialog.classList.add('qtpl-dialog');const form=dialog.querySelector('form'),error=dialog.querySelector('.qtpl-error'),logoInput=dialog.querySelector('[data-qtpl-logo-file]');
    const read=()=>({format:FORMAT,version:1,name:form.elements.templateName.value,config:{title:form.elements.title.value,footerText:form.elements.footerText.value,logoData,orientation:form.elements.orientation.value,fontSize:Number(form.elements.fontSize.value),margin:Number(form.elements.margin.value),columns:clone(columns)}});
    const draw=()=>{access(true,c);dialog.querySelector('.qtpl-logo-preview').innerHTML=`<img src="${E(logoData||c.brand.logo)}" alt="Logo">`;try{const valid=P.validateFile(read());dialog.querySelector('[data-qtpl-example]').innerHTML=paper(valid.config,c.brand,true);}catch{dialog.querySelector('[data-qtpl-example]').innerHTML='<p class="muted">请补齐有效设置后查看示例。</p>';}};
    function drawColumns(){
      dialog.querySelector('[data-qtpl-columns]').innerHTML=columns.map((column,index)=>`<div class="qtpl-column-row" data-column="${index}"><span>${COLUMN_NAMES[column.key]}${REQUIRED.includes(column.key)?'<small>必需</small>':''}</span><label class="field"><span>列标题</span><input data-column-label="${index}" maxlength="30" value="${E(column.label)}" required></label><label class="field"><span>宽度权重</span><input data-column-width="${index}" type="number" min="5" max="60" step="any" value="${column.width}" required></label><div class="qtpl-column-actions"><button type="button" class="btn small" data-column-up="${index}" ${index===0?'disabled':''} aria-label="上移 ${E(COLUMN_NAMES[column.key])}">↑</button><button type="button" class="btn small" data-column-down="${index}" ${index===columns.length-1?'disabled':''} aria-label="下移 ${E(COLUMN_NAMES[column.key])}">↓</button>${REQUIRED.includes(column.key)?'':`<button type="button" class="btn small" data-column-remove="${index}">移除</button>`}</div></div>`).join('');
      dialog.querySelector('[data-qtpl-optional]').innerHTML=['image','color'].filter(key=>!columns.some(column=>column.key===key)).map(key=>`<button type="button" class="btn small" data-column-add="${key}">＋ 添加${COLUMN_NAMES[key]}列</button>`).join('');
      dialog.querySelectorAll('[data-column-label]').forEach(input=>input.oninput=()=>{columns[Number(input.dataset.columnLabel)].label=input.value;});
      dialog.querySelectorAll('[data-column-width]').forEach(input=>input.oninput=()=>{columns[Number(input.dataset.columnWidth)].width=Number(input.value);});
      const change=run=>{try{access(true,c);run();drawColumns();draw();}catch(cause){showError(error,cause);}};
      dialog.querySelectorAll('[data-column-up]').forEach(button=>button.onclick=()=>change(()=>{const i=Number(button.dataset.columnUp);if(i>0)[columns[i-1],columns[i]]=[columns[i],columns[i-1]];}));
      dialog.querySelectorAll('[data-column-down]').forEach(button=>button.onclick=()=>change(()=>{const i=Number(button.dataset.columnDown);if(i<columns.length-1)[columns[i],columns[i+1]]=[columns[i+1],columns[i]];}));
      dialog.querySelectorAll('[data-column-remove]').forEach(button=>button.onclick=()=>change(()=>{const i=Number(button.dataset.columnRemove);if(!REQUIRED.includes(columns[i]?.key))columns.splice(i,1);}));
      dialog.querySelectorAll('[data-column-add]').forEach(button=>button.onclick=()=>change(()=>{const key=button.dataset.columnAdd;if(['image','color'].includes(key)&&!columns.some(column=>column.key===key))columns.push(clone(DEFAULT_COLUMNS.find(column=>column.key===key)));}));
    }
    form.addEventListener('input',()=>{try{draw();}catch(cause){showError(error,cause);}});form.addEventListener('change',()=>{try{draw();}catch(cause){showError(error,cause);}});
    dialog.querySelector('[data-qtpl-cancel]').onclick=()=>dialog.close();
    dialog.querySelector('[data-qtpl-logo-upload]').onclick=()=>{try{access(true,c);logoInput.click();}catch(cause){showError(error,cause);}};
    dialog.querySelector('[data-qtpl-logo-reset]').onclick=()=>{try{access(true,c);if(!logoBusy){logoData='';draw();}}catch(cause){showError(error,cause);}};
    logoInput.onchange=async()=>{
      const file=logoInput.files?.[0];logoInput.value='';if(!file)return;if(logoBusy||saveBusy)return;
      logoBusy=true;const button=dialog.querySelector('[data-qtpl-logo-upload]');button.disabled=true;error.hidden=true;
      try{const captured=access(true,c);if(file.size>LOGO_LIMIT)throw new Error('Logo 不能超过 1 MB。');if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Logo 仅支持 PNG、JPG 或 WebP。');const value=await L.readFile(file);access(true,captured);const safe=L.printTemplates.validateLogo(value);await decodeLogo(safe,captured);access(true,captured);if(dialog.isConnected!==false){logoData=safe;draw();}}catch(cause){if(dialog.isConnected!==false)showError(error,cause);}finally{logoBusy=false;button.disabled=false;}
    };
    async function save(preview){
      if(saveBusy)return;if(logoBusy){showError(error,new Error('Logo 正在读取，请稍候。'));return;}if(!form.reportValidity())return;
      saveBusy=true;error.hidden=true;const buttons=[...form.querySelectorAll('button')];buttons.forEach(button=>button.disabled=true);
      try{access(true,c);const item=await P.saveTemplate(read(),isNew?undefined:source.id);access(true,c);dialog.close();refresh(manager,c);L.toast('报价 PDF 模板已保存。');if(preview)openPreview(item.id);}catch(cause){if(dialog.isConnected!==false)showError(error,cause);}finally{saveBusy=false;buttons.forEach(button=>button.disabled=false);}
    }
    form.onsubmit=event=>{event.preventDefault();save(false);};dialog.querySelector('[data-qtpl-save-preview]').onclick=()=>save(true);drawColumns();draw();
  }
  L.quotationTemplates=Object.freeze(P);
})();
