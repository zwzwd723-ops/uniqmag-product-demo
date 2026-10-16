(() => {
  'use strict';
  const L=window.Library,E=L.esc,P=L.printTemplates={};
  const company=()=>L.company?.()||{id:'uniqmag',name:'UNIQMAG',logo:'assets/logo.png'};
  const assertCompany=id=>{if(company().id!==id)throw new Error('主体已切换，请在当前主体重新操作。');};
  const FORMAT='uniqmag-print-template',LIMIT=2*1024*1024,LOGO_LIMIT=1024*1024;
  const DEFAULT={headerTitle:'产品资料',footerText:'UNIQMAG · 产品资料库',logoData:'',fontSize:12,margin:14,imagePosition:'left',showSpecs:true,showPackaging:true,showIssues:true};
  const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
  const clone=value=>structuredClone(value);
  let saving=false;

  function object(value,keys,label){
    if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw new Error(label+'格式不正确。');
    for(const key of Object.keys(value))if(!keys.includes(key))throw new Error(label+'含有不支持的字段：'+key);
    for(const key of keys)if(!own(value,key))throw new Error(label+'缺少字段：'+key);
  }
  function text(value,max,label,empty=false){
    if(typeof value!=='string'||[...value].length>max||(!empty&&!value.trim()))throw new Error(label+'长度不正确。');
    if(/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)||/\b(?:javascript|vbscript)\s*:/i.test(value))throw new Error(label+'只能填写纯文本。');
    return value.trim();
  }
  function logo(value){
    if(value==='')return '';
    if(typeof value!=='string'||value.length>Math.ceil(LOGO_LIMIT/3)*4+40)throw new Error('Logo 不能超过 1 MB。');
    const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    if(!match||match[2].length%4!==0)throw new Error('Logo 仅支持 PNG、JPG 或 WebP 图片。');
    let bytes;try{bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));}catch{throw new Error('Logo 图片编码无效。');}
    if(bytes.length>LOGO_LIMIT)throw new Error('Logo 不能超过 1 MB。');
    const ascii=(offset,length)=>String.fromCharCode(...bytes.slice(offset,offset+length));
    const be=(offset,length)=>{let n=0;for(let i=0;i<length;i++)n=n*256+bytes[offset+i];return n;};
    const le=(offset,length)=>{let n=0;for(let i=length-1;i>=0;i--)n=n*256+bytes[offset+i];return n;};
    let width=0,height=0;
    if(match[1]==='png'&&bytes.length>=33&&be(0,4)===0x89504e47&&be(4,4)===0x0d0a1a0a&&be(8,4)===13&&ascii(12,4)==='IHDR'){
      width=be(16,4);height=be(20,4);
    }else if(match[1]==='jpeg'&&bytes.length>=4&&bytes[0]===255&&bytes[1]===216){
      let offset=2;
      while(offset+4<=bytes.length){
        if(bytes[offset++]!==255)break;
        while(bytes[offset]===255)offset++;
        const marker=bytes[offset++];
        if(marker===217||marker===218)break;
        if(marker===1||(marker>=208&&marker<=215))continue;
        const length=be(offset,2);if(length<2||offset+length>bytes.length)break;
        if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&length>=8){height=be(offset+3,2);width=be(offset+5,2);break;}
        offset+=length;
      }
    }else if(match[1]==='webp'&&bytes.length>=30&&ascii(0,4)==='RIFF'&&ascii(8,4)==='WEBP'){
      const kind=ascii(12,4);
      if(kind==='VP8X'){width=le(24,3)+1;height=le(27,3)+1;}
      else if(kind==='VP8L'&&bytes[20]===47){width=1+(((bytes[22]&63)<<8)|bytes[21]);height=1+(((bytes[24]&15)<<10)|(bytes[23]<<2)|(bytes[22]>>6));}
      else if(kind==='VP8 '&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42){width=le(26,2)&16383;height=le(28,2)&16383;}
    }
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>4096||height>4096||width*height>8000000)throw new Error('Logo 图片无效，或尺寸超过 4096 像素 / 800 万像素。');
    return value;
  }
  function config(value){
    object(value,Object.keys(DEFAULT),'打印设置');
    if(!Number.isFinite(value.fontSize)||value.fontSize<9||value.fontSize>16||Math.round(value.fontSize*2)!==value.fontSize*2)throw new Error('字号需要在 9–16 px 之间，步进为 0.5。');
    if(!Number.isFinite(value.margin)||value.margin<8||value.margin>25||Math.round(value.margin)!==value.margin)throw new Error('页边距需要是 8–25 mm 的整数。');
    if(!['left','right'].includes(value.imagePosition))throw new Error('主图位置仅支持左侧或右侧。');
    for(const key of ['showSpecs','showPackaging','showIssues'])if(typeof value[key]!=='boolean')throw new Error('内容开关需要为 true 或 false。');
    return {headerTitle:text(value.headerTitle,60,'页眉',true),footerText:text(value.footerText,120,'页脚',true),logoData:logo(value.logoData),fontSize:value.fontSize,margin:value.margin,imagePosition:value.imagePosition,showSpecs:value.showSpecs,showPackaging:value.showPackaging,showIssues:value.showIssues};
  }
  P.validateFile=data=>{
    if(typeof data==='string'){
      if(new TextEncoder().encode(data).length>LIMIT)throw new Error('打印模板不能超过 2 MB。');
      try{data=JSON.parse(data.replace(/^\uFEFF/,''));}catch{throw new Error('模板不是有效的 JSON 文件，请下载标准模板后修改。');}
    }
    object(data,['format','version','name','config'],'模板文件');
    if(data.format!==FORMAT||data.version!==1)throw new Error('这不是受支持的产品打印模板。');
    const result={format:FORMAT,version:1,name:text(data.name,60,'模板名称'),config:config(data.config)};
    if(new TextEncoder().encode(JSON.stringify(result)).length>LIMIT)throw new Error('打印模板不能超过 2 MB。');
    return result;
  };
  function builtin(){const brand=company();return {id:'print-default',kind:'print',name:brand.name+' 标准打印模板',status:'published',version:1,builtin:true,config:{...clone(DEFAULT),footerText:brand.name+' · 产品资料库'}};}
  P.list=()=>{
    if(!L.isStaff())return [];
    const result=[builtin()],seen=new Set(['print-default']);
    for(const item of L.state?.templates||[]){
      if(item?.kind!=='print'||typeof item.id!=='string'||!item.id||seen.has(item.id))continue;
      try{const valid=P.validateFile({format:FORMAT,version:1,name:item.name,config:item.config});result.push({...item,name:valid.name,config:valid.config,builtin:false});seen.add(item.id);}catch{/* Invalid legacy or externally edited records are never rendered. */}
    }
    return result;
  };
  P.get=id=>P.list().find(item=>item.id===id)||null;
  P.defaultId=()=>{
    const id=(L.state?.templates||[]).find(item=>item.id==='print-settings'&&item.kind==='print-settings')?.defaultId;
    return P.get(id)?id:'print-default';
  };
  P.download=id=>{
    if(!L.isStaff())throw new Error('打印模板下载仅限内部人员。');
    const item=P.get(id);if(!item)throw new Error('找不到此打印模板。');
    const data=P.validateFile({format:FORMAT,version:1,name:item.name,config:item.config});
    L.download(new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json;charset=utf-8'}),item.name+'.print-template.json');
  };
  async function decodeLogo(value){
    if(!value)return;
    await new Promise((resolve,reject)=>{
      const image=new Image();let done=false;
      const finish=error=>{if(done)return;done=true;clearTimeout(timer);image.onload=null;image.onerror=null;error?reject(error):resolve();};
      const timer=setTimeout(()=>finish(new Error('Logo 图片读取超时，请重新选择。')),6000);
      image.onload=()=>finish(image.naturalWidth&&image.naturalHeight?null:new Error('Logo 图片无法读取。'));
      image.onerror=()=>finish(new Error('Logo 图片无法读取，请使用有效的 PNG、JPG 或 WebP。'));
      image.src=value;
    });
  }
  function requireManager(){if(!L.can('templates'))throw new Error('仅管理员可以管理打印模板。');}
  async function persist(record,action){
    requireManager();if(saving)throw new Error('模板正在保存，请稍候。');
    const companyId=company().id,state=L.state;
    saving=true;
    const previous=L.state.templates.find(item=>item.id===record.id),logId=L.uid('log');
    L.state.templates=L.state.templates.filter(item=>item.id!==record.id).concat(record);
    L.state.logs.unshift({id:logId,action,target:record.name||'打印模板',time:new Date().toISOString(),actor:L.currentMember?.()?.name||L.roleName(L.currentRole?.()??L.state.role)+'（演示）'});
    try{await L.save();assertCompany(companyId);}
    catch(error){state.templates=state.templates.filter(item=>item.id!==record.id);if(previous)state.templates.push(previous);state.logs=state.logs.filter(item=>item.id!==logId);throw error;}
    finally{saving=false;}
    return P.get(record.id);
  }
  P.saveTemplate=async(data,id)=>{
    requireManager();const companyId=company().id,valid=P.validateFile(data);await decodeLogo(valid.config.logoData);assertCompany(companyId);requireManager();
    const previous=id?P.get(id):null;
    if(id&&(!previous||previous.builtin))throw new Error('标准模板请另存为新模板。');
    const now=new Date().toISOString(),record={id:id||L.uid('print'),kind:'print',name:valid.name,status:'published',version:(previous?.version||0)+1,config:valid.config,fileName:valid.name+'.print-template.json',createdAt:previous?.createdAt||now,updatedAt:now};
    return persist(record,previous?'修改打印模板':'上传或创建打印模板');
  };
  P.setDefault=async id=>{
    requireManager();const item=P.get(id);if(!item)throw new Error('找不到此打印模板。');
    await persist({id:'print-settings',kind:'print-settings',name:'默认打印模板',defaultId:id,updatedAt:new Date().toISOString()},'设置默认打印模板');
  };
  function preview(item){
    if(!L.isStaff()){L.toast('打印仅限内部人员。');return;}
    const product=L.state.products.find(product=>product.variants?.length);
    if(!product){L.toast('请先添加产品和配色，再预览打印效果。');return;}
    L.openProductPrint(product.id,product.variants[0].id,item.id);
  }
  const previewLogo=value=>`<img src="${E(value||company().logo)}" alt="${E(company().name)} Logo">`;
  function miniature(item){
    return `<div class="print-template-mini" aria-hidden="true"><div class="print-template-mini-head">${previewLogo(item.config.logoData)}<span>${E(item.config.headerTitle)}</span></div><div class="print-template-mini-body ${item.config.imagePosition==='right'?'image-right':''}"><div class="print-template-mini-photo">${L.icon('image')}</div><div class="print-template-mini-lines"><b></b><i></i><i></i></div></div><div class="print-template-mini-table"><i></i><i></i><i></i></div><span class="print-template-mini-footer">${E(item.config.footerText)}</span></div>`;
  }
  function showError(target,error){target.textContent=error.message||'操作未完成，请重试。';target.hidden=false;}
  async function refreshManager(el){
    if(!el?.isConnected)return;
    const [route,query='']=(typeof location==='undefined'?'':location.hash).replace(/^#\/?/,'').split('?');
    if(route==='templates'&&new URLSearchParams(query).get('tab')==='print'&&typeof L.render==='function')await L.render();
    else P.renderManager(el);
  }
  P.renderManager=el=>{
    if(!L.can('templates')){el.innerHTML='<div class="empty-state"><h2>仅管理员可以管理打印模板</h2><p>内部人员可在产品打印窗口选择已保存的模板。</p></div>';return;}
    const items=P.list(),defaultId=P.defaultId(),companyId=company().id;
    el.innerHTML=`<section class="print-template-manager"><div class="print-template-toolbar"><div><h2>打印模板</h2><p>配置品牌与版式，打印时自动填入产品资料。</p></div><div class="row-actions"><button class="btn" data-print-download-standard>${L.icon('download')}下载标准模板</button><button class="btn" data-print-upload>${L.icon('upload')}上传打印模板</button><button class="btn primary" data-print-create>${L.icon('plus')}新建打印模板</button></div></div><input type="file" accept=".json,application/json" data-print-file hidden><div class="notice">${L.icon('info')}<span>只支持本系统的 .json 打印模板（最大 2 MB）。可以先在网页编辑、下载备份，再上传复用；Word、PDF 和 Excel 不会自动转换为打印模板。模板保存在当前浏览器。</span></div><p class="print-template-error" role="alert" hidden></p><div class="print-template-grid">${items.map(item=>`<article class="print-template-card" data-print-card="${E(item.id)}">${miniature(item)}<div class="print-template-card-content"><div class="print-template-card-label"><span class="badge">${item.builtin?'标准模板':'自定义模板'}</span>${item.id===defaultId?'<span class="badge print-default-badge">默认使用</span>':''}</div><h3 data-print-data>${E(item.name)}</h3><p>A4 · <span data-print-data>${item.config.fontSize}</span> px · <span data-print-data>${item.config.margin}</span> mm</p><div class="row-actions"><button class="btn small" data-print-edit="${E(item.id)}">${item.builtin?'编辑为新模板':'编辑模板'}</button><button class="btn small" data-print-preview="${E(item.id)}">预览</button><button class="btn small" data-print-download="${E(item.id)}">下载模板</button></div><button class="print-template-default" data-print-default="${E(item.id)}" ${item.id===defaultId?'disabled':''}>${item.id===defaultId?'当前默认模板':item.builtin?'恢复标准模板为默认':'设为默认'}</button></div></article>`).join('')}</div></section>`;
    const error=el.querySelector('.print-template-error'),fileInput=el.querySelector('[data-print-file]'),uploadButton=el.querySelector('[data-print-upload]');
    const handle=async task=>{error.hidden=true;try{assertCompany(companyId);await task();}catch(cause){showError(error,cause);}};
    el.querySelector('[data-print-download-standard]').onclick=()=>handle(()=>P.download('print-default'));
    uploadButton.onclick=()=>{if(L.can('templates'))fileInput.click();};
    fileInput.onchange=()=>handle(async()=>{
      const file=fileInput.files?.[0];fileInput.value='';if(!file)return;
      requireManager();if(!/\.json$/i.test(file.name))throw new Error('请选择 .json 打印模板文件。');
      if(file.size>LIMIT)throw new Error('打印模板不能超过 2 MB。');
      uploadButton.disabled=true;
      try{const data=P.validateFile(await file.text());assertCompany(companyId);await P.saveTemplate(data);assertCompany(companyId);await refreshManager(el);L.toast('打印模板已上传，可在打印窗口选用。');}finally{uploadButton.disabled=false;}
    });
    el.querySelector('[data-print-create]').onclick=()=>edit(null,el);
    el.querySelectorAll('[data-print-edit]').forEach(button=>button.onclick=()=>edit(button.dataset.printEdit,el));
    el.querySelectorAll('[data-print-preview]').forEach(button=>button.onclick=()=>handle(()=>preview(P.get(button.dataset.printPreview))));
    el.querySelectorAll('[data-print-download]').forEach(button=>button.onclick=()=>handle(()=>P.download(button.dataset.printDownload)));
    el.querySelectorAll('[data-print-default]').forEach(button=>button.onclick=()=>handle(async()=>{button.disabled=true;try{await P.setDefault(button.dataset.printDefault);await refreshManager(el);L.toast('默认打印模板已更新。');}finally{if(button.isConnected)button.disabled=false;}}));
  };
  function edit(id,manager){
    if(!L.can('templates'))return;
    const companyId=company().id;
    const source=P.get(id)||builtin(),isNew=!id||source.builtin;
    const initial={format:FORMAT,version:1,name:isNew?'自定义打印模板':source.name,config:clone(source.config)};
    let logoData=initial.config.logoData,logoBusy=false,saveBusy=false;
    const d=L.modal(isNew?'新建打印模板':'编辑打印模板',`<form class="print-template-editor"><div class="print-template-editor-grid"><div class="print-template-fields"><label class="field"><span>模板名称</span><input name="templateName" maxlength="60" required value="${E(initial.name)}"></label><div class="form-grid"><label class="field"><span>页眉文字</span><input name="headerTitle" maxlength="60" value="${E(initial.config.headerTitle)}"></label><label class="field"><span>页脚文字</span><input name="footerText" maxlength="120" value="${E(initial.config.footerText)}"></label><label class="field"><span>正文字号（px）</span><input name="fontSize" type="number" min="9" max="16" step="0.5" required value="${initial.config.fontSize}"></label><label class="field"><span>页边距（mm）</span><input name="margin" type="number" min="8" max="25" step="1" required value="${initial.config.margin}"></label><label class="field full"><span>产品主图位置</span><select name="imagePosition"><option value="left" ${initial.config.imagePosition==='left'?'selected':''}>图片在左</option><option value="right" ${initial.config.imagePosition==='right'?'selected':''}>图片在右</option></select></label></div><fieldset class="print-template-options"><legend>打印内容</legend><label class="check-row"><input type="checkbox" name="showSpecs" ${initial.config.showSpecs?'checked':''}>完整技术规格</label><label class="check-row"><input type="checkbox" name="showPackaging" ${initial.config.showPackaging?'checked':''}>包装资料</label><label class="check-row"><input type="checkbox" name="showIssues" ${initial.config.showIssues?'checked':''}>待核实事项</label></fieldset><div class="print-template-logo-field"><span>品牌 Logo</span><div class="print-template-logo-preview">${previewLogo(logoData)}</div><div class="row-actions"><button type="button" class="btn small" data-logo-upload>上传 Logo</button><button type="button" class="btn small" data-logo-reset>恢复官方 Logo</button></div><small>PNG、JPG 或 WebP，最大 1 MB；建议使用透明底图片。</small><input type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" data-logo-file hidden></div></div><aside class="print-template-editor-aside"><h3>版式示意</h3><div data-print-mini>${miniature({config:initial.config})}</div><p>产品图片与内容会在打印时自动填入。保存后可查看完整打印效果。</p><small>模板保存在当前浏览器，建议下载备份。</small></aside></div><p class="print-template-error" role="alert" hidden></p><div class="modal-actions"><button type="button" class="btn" data-print-cancel>取消</button><button type="button" class="btn" data-print-save-preview>保存并预览</button><button type="submit" class="btn primary">保存模板</button></div></form>`,{wide:true});
    d.classList.add('print-template-dialog');
    const form=d.querySelector('form'),error=d.querySelector('.print-template-error'),logoInput=d.querySelector('[data-logo-file]');
    const read=()=>({format:FORMAT,version:1,name:form.elements.templateName.value,config:{headerTitle:form.elements.headerTitle.value,footerText:form.elements.footerText.value,logoData,fontSize:Number(form.elements.fontSize.value),margin:Number(form.elements.margin.value),imagePosition:form.elements.imagePosition.value,showSpecs:form.elements.showSpecs.checked,showPackaging:form.elements.showPackaging.checked,showIssues:form.elements.showIssues.checked}});
    const draw=()=>{d.querySelector('[data-print-mini]').innerHTML=miniature(read());d.querySelector('.print-template-logo-preview').innerHTML=previewLogo(logoData);};
    form.addEventListener('input',draw);
    d.querySelector('[data-print-cancel]').onclick=()=>d.close();
    d.querySelector('[data-logo-upload]').onclick=()=>logoInput.click();
    d.querySelector('[data-logo-reset]').onclick=()=>{if(!logoBusy){logoData='';draw();}};
    logoInput.onchange=async()=>{
      const file=logoInput.files?.[0];logoInput.value='';if(!file)return;
      error.hidden=true;logoBusy=true;const upload=d.querySelector('[data-logo-upload]');upload.disabled=true;
      try{
        requireManager();if(file.size>LOGO_LIMIT)throw new Error('Logo 不能超过 1 MB。');
        if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Logo 仅支持 PNG、JPG 或 WebP 图片。');
        const value=logo(await L.readFile(file));await decodeLogo(value);assertCompany(companyId);
        if(d.isConnected){logoData=value;draw();}
      }catch(cause){if(d.isConnected)showError(error,cause);}
      finally{logoBusy=false;upload.disabled=false;}
    };
    async function save(andPreview){
      if(saveBusy)return;if(logoBusy){showError(error,new Error('Logo 正在读取，请稍候。'));return;}
      if(!form.reportValidity())return;
      saveBusy=true;error.hidden=true;const buttons=[...form.querySelectorAll('button')];buttons.forEach(button=>button.disabled=true);
      try{
        assertCompany(companyId);const item=await P.saveTemplate(read(),isNew?null:source.id);assertCompany(companyId);
        const stillOnPage=manager.isConnected;d.close();await refreshManager(manager);L.toast('打印模板已保存。');if(andPreview&&stillOnPage)preview(item);
      }catch(cause){if(d.isConnected)showError(error,cause);}
      finally{saveBusy=false;buttons.forEach(button=>button.disabled=false);}
    }
    form.onsubmit=event=>{event.preventDefault();save(false);};
    d.querySelector('[data-print-save-preview]').onclick=()=>save(true);
  }
})();

