(() => {
  'use strict';
  const L=window.Library, E=value=>L.esc(value??''), CURRENCIES=['CNY','USD','EUR','HKD'];
  const MAX_CENTS=BigInt(Number.MAX_SAFE_INTEGER), MAX_LINES=300;
  let pendingEntry=null, saving=false;
  const clone=value=>structuredClone(value);
  const clock=()=>new Date().toISOString();
  const company=()=>L.company();
  const today=(offset=0)=>{const d=new Date();d.setDate(d.getDate()+offset);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const newNumber=()=>`QT-${today().replaceAll('-','')}-${L.uid('q').split('-').slice(-1)[0].slice(-6).toUpperCase()}`;
  function access(expected){
    const member=L.currentMember?.(), state=L.state, companyId=company().id;
    if(!member||!['admin','business'].includes(member.role)||!L.can('quote'))throw new Error('报价单仅供管理员和业务人员使用。');
    if(expected&&(expected.companyId!==companyId||expected.memberId!==member.id||expected.role!==member.role||expected.state!==state))throw new Error('主体或登录账号已改变，请重新打开报价单。');
    return {memberId:member.id,role:member.role,member,companyId,state};
  }
  function records(context){access(context);return Array.isArray(context.state.quotations)?context.state.quotations:[];}
  function readRecord(id,context=access()){
    const quote=records(context).find(item=>item.id===id&&item.companyId===context.companyId);
    if(!quote||(context.member.role!=='admin'&&quote.ownerId!==context.memberId))throw new Error('此报价单不存在，或不属于当前业务人员。');
    return quote;
  }
  function visibleRecords(){const c=access();return records(c).filter(q=>q.companyId===c.companyId&&(c.member.role==='admin'||q.ownerId===c.memberId)).map(clone).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));}
  function text(value,label,max,required=false){const result=String(value??'').trim();if(required&&!result)throw new Error(`请填写${label}。`);if(result.length>max)throw new Error(`${label}最多 ${max} 个字符。`);return result;}
  function parsePrice(value,allowBlank=false){
    const raw=String(value??'').trim();
    if(!raw&&allowBlank)return null;
    if(raw.length>30||!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(raw))throw new Error('单价须为非负金额，最多保留两位小数；未定价请留空。');
    const [whole,fraction='']=raw.split('.'), cents=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
    if(cents>MAX_CENTS)throw new Error('单价过大，请核对金额。');
    return Number(cents);
  }
  function parseQuantity(value,allowBlank=false){
    const raw=String(value??'').trim();if(!raw&&allowBlank)return null;
    if(raw.length>7||!/^[1-9]\d*$/.test(raw)||BigInt(raw)>1000000n)throw new Error('数量须为 1 至 1,000,000 的整数。');
    return Number(raw);
  }
  const money=cents=>{const amount=BigInt(cents);return `${amount/100n}.${String(amount%100n).padStart(2,'0')}`;};
  function amounts(lines,complete=false){
    let total=0n,pending=0;
    const rows=lines.map(line=>{const price=parsePrice(line.unitPrice,!complete),quantity=parseQuantity(line.quantity,!complete);if(price===null||quantity===null){pending++;return null;}const amount=BigInt(price)*BigInt(quantity);total+=amount;if(amount>MAX_CENTS||total>MAX_CENTS)throw new Error('报价总额过大，请核对单价与数量。');return Number(amount);});
    return {rows,total:Number(total),pending};
  }
  function dateValue(value,label,required){
    const raw=text(value,label,10,required);if(!raw)return '';
    const d=new Date(`${raw}T12:00:00Z`);if(!/^\d{4}-\d{2}-\d{2}$/.test(raw)||Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==raw)throw new Error(`${label}不是有效日期。`);return raw;
  }
  function availableRows(){access();return L.liveProducts().flatMap(p=>(p.variants||[]).map(v=>({p,v})));}
  function snapshot(p,v){return {productId:p.id,skuId:v.id,name:String(p.name||p.id),type:String(p.type||''),brand:String(L.productBrand?.(p)?.name||p.brand||''),sku:String(v.sku||''),color:String(v.colorLabel||v.color||''),image:L.safeURL(v.images?.[0]||'')||''};}
  function fromSelection(selection=[]){
    const rows=availableRows(),seen=new Set();
    return selection.map(selected=>{const key=`${selected.productId}:${selected.skuId}`;if(seen.has(key))return null;seen.add(key);const row=rows.find(r=>r.p.id===selected.productId&&r.v.id===selected.skuId);if(!row)throw new Error('选中的产品或配色尚未发布，请重新选择。');return {id:L.uid('ql'),snapshot:snapshot(row.p,row.v),quantity:'1',unitPrice:''};}).filter(Boolean);
  }
  function newDraft(selection=[]){const c=access();return {id:L.uid('quote'),companyId:c.companyId,ownerId:c.memberId,number:newNumber(),customer:'',contact:'',currency:'USD',date:today(),validUntil:today(30),notes:'',pdfTemplateId:L.quotationTemplates?.defaultId()||'quotation-default',lines:fromSelection(selection),revision:0};}
  function normalize(input,{complete=false,stored=null,copySource=null}={}){
    const c=access(),number=text(input.number,'报价编号',80,complete),customer=text(input.customer,'客户名称',160,complete),contact=text(input.contact,'联系人',160),notes=text(input.notes,'备注',3000);
    if(!CURRENCIES.includes(input.currency))throw new Error('请选择支持的报价币种。');
    const date=dateValue(input.date,'报价日期',complete),validUntil=dateValue(input.validUntil,'有效期',complete);
    if(date&&validUntil&&validUntil<date)throw new Error('有效期不能早于报价日期。');
    if(!Array.isArray(input.lines)||input.lines.length>MAX_LINES)throw new Error(`每份报价单最多 ${MAX_LINES} 个明细。`);
    if(complete&&!input.lines.length)throw new Error('请至少选择一个产品配色。');
    const seen=new Set(),published=availableRows();
    const lines=input.lines.map(line=>{
      const id=text(line.id,'明细编号',100,true);if(seen.has(id))throw new Error('报价明细重复，请重新打开。');seen.add(id);
      const prior=(stored||copySource)?.lines.find(old=>old.id===id);
      let product;
      if(prior){product=clone(prior.snapshot);}
      else {const row=published.find(r=>r.p.id===line.snapshot?.productId&&r.v.id===line.snapshot?.skuId);if(!row)throw new Error('新增明细中的产品或配色已下架，请移除后重新选择。');product=snapshot(row.p,row.v);}
      const cents=parsePrice(line.unitPrice,!complete),quantity=parseQuantity(line.quantity,!complete);
      return {id,snapshot:product,quantity:quantity===null?'':String(quantity),unitPrice:cents===null?'':money(cents)};
    });
    const totals=amounts(lines,complete),pdfTemplateId=text(input.pdfTemplateId||stored?.pdfTemplateId||L.quotationTemplates?.defaultId()||'quotation-default','报价模板',100,true);
    if(L.quotationTemplates)L.quotationTemplates.resolve(pdfTemplateId);else if(pdfTemplateId!=='quotation-default')throw new Error('报价模板组件尚未加载，请刷新后重试。');
    return {id:stored?.id||input.id,companyId:c.companyId,ownerId:stored?.ownerId||c.memberId,number,customer,contact,currency:input.currency,date,validUntil,notes,pdfTemplateId,lines,totalCents:totals.pending?null:totals.total,status:'draft',revision:(stored?.revision||0)+1,createdAt:stored?.createdAt||clock(),updatedAt:clock()};
  }
  async function persist(input,{copySourceId=null}={}){
    if(saving)throw new Error('正在保存报价单，请稍候。');
    const c=access(),existing=records(c).find(q=>q.id===input.id),stored=existing?readRecord(input.id,c):null;
    if(stored&&(input.revision||0)!==(stored.revision||0))throw new Error('报价单已更新，请重新打开后编辑。');
    const copySource=copySourceId?readRecord(copySourceId,c):null;
    const next=normalize(input,{stored,copySource});
    if(!next.id||typeof next.id!=='string')throw new Error('报价编号标识无效，请重新新建。');
    const previous=records(c),had=Object.prototype.hasOwnProperty.call(c.state,'quotations');
    saving=true;
    c.state.quotations=stored?previous.map(q=>q.id===stored.id?next:q):[next,...previous];
    try{access(c);await L.save();access(c);readRecord(next.id,c);return clone(next);}
    catch(error){
      const current=c.state.quotations,index=Array.isArray(current)?current.findIndex(q=>q.id===next.id):-1;
      // Earlier queued saves may have merged other tabs' quotes. Revert only our unchanged write.
      if(index>=0&&(current[index]===next||JSON.stringify(current[index])===JSON.stringify(next))){
        if(stored)current.splice(index,1,stored);else current.splice(index,1);
        if(!had&&!current.length)delete c.state.quotations;
      }
      throw error;
    }
    finally{saving=false;}
  }
  async function copyQuotation(id){const c=access(),original=clone(readRecord(id,c));original.id=L.uid('quote');original.number=newNumber();original.date=today();original.validUntil=today(30);original.revision=0;return persist(original,{copySourceId:id});}
  function pdfSpec(quote,templateId){
    const values=amounts(quote.lines,true),selectedId=templateId||quote.pdfTemplateId;
    const template=L.quotationTemplates?.resolve(selectedId),config=template?.config;
    if(!template&&selectedId&&selectedId!=='quotation-default')throw new Error('报价模板组件尚未加载，请刷新后重试。');
    const columns=config?.columns||[{key:'image',label:'产品图片',width:14},{key:'product',label:'产品 / SKU',width:30},{key:'color',label:'配色',width:16},{key:'quantity',label:'数量',width:10},{key:'unitPrice',label:'单价',width:15},{key:'amount',label:'金额',width:15}];
    const imageColumn=columns.findIndex(column=>column.key==='image');
    const spec={company:{...clone(company()),...(config?.logoData?{logo:config.logoData}:{})},title:config?.title||'产品报价单',subtitle:quote.number,
      meta:[{label:'客户名称',value:quote.customer},{label:'联系人',value:quote.contact||'—'},{label:'报价日期',value:quote.date},{label:'有效期至',value:quote.validUntil},{label:'报价币种',value:quote.currency}],
      headers:columns.map(column=>column.label+(['unitPrice','amount'].includes(column.key)?` (${quote.currency})`:'')),widths:columns.map(column=>column.width),
      rows:quote.lines.map((line,index)=>{const fields={image:'',product:[line.snapshot.brand,line.snapshot.name,line.snapshot.sku].filter(Boolean).join('\n'),color:line.snapshot.color,quantity:String(line.quantity),unitPrice:money(parsePrice(line.unitPrice)),amount:money(values.rows[index])};return {values:columns.map(column=>fields[column.key]),image:imageColumn>=0?line.snapshot.image||undefined:undefined};}),
      totals:[{label:`合计 (${quote.currency})`,value:money(values.total)}],notes:quote.notes?[quote.notes]:[]};
    if(config){spec.layout={orientation:config.orientation,fontSize:config.fontSize,margin:config.margin,footerText:config.footerText};if(imageColumn>=0)spec.imageColumn=imageColumn;}
    return spec;
  }
  async function exportPDF(id,{progress,templateId}={}){
    const c=access(),quote=clone(readRecord(id,c));normalize({...quote,pdfTemplateId:templateId||quote.pdfTemplateId},{complete:true,stored:quote});
    if(!L.pdfExport?.build)throw new Error('PDF 组件尚未加载，请刷新后重试。');
    const selected=L.quotationTemplates?.resolve(templateId||quote.pdfTemplateId),selectedId=selected?.id||templateId||quote.pdfTemplateId;
    const templateSignature=selected?JSON.stringify([selected.id,selected.version,selected.config]):null;
    const revision=quote.revision,validate=()=>{access(c);const current=readRecord(id,c);if(current.revision!==revision)throw new Error('报价单在生成期间已更新，请重新导出。');if(templateSignature){const currentTemplate=L.quotationTemplates.resolve(selectedId);if(JSON.stringify([currentTemplate.id,currentTemplate.version,currentTemplate.config])!==templateSignature)throw new Error('报价模板在生成期间已更新，请重新导出。');}};
    validate();const blob=await L.pdfExport.build(pdfSpec(quote,selectedId),{validate,progress});validate();
    L.download(blob,`${company().name}_${quote.number||'报价单'}.pdf`);return blob;
  }
  function errorAt(el,error){let box=el.querySelector('.quotation-error');if(!box){box=document.createElement('div');box.className='quotation-error';box.setAttribute('role','alert');el.prepend(box);}box.textContent=error?.message||'操作未完成，请重试。';box.scrollIntoView?.({block:'nearest'});}
  function templateOptions(selectedId){
    const items=L.quotationTemplates?.list()||[{id:'quotation-default',name:company().name+' 标准报价模板'}];
    return (selectedId&&!items.some(item=>item.id===selectedId)?`<option value="${E(selectedId)}" selected disabled>原模板不可用，请重新选择</option>`:'')+items.map(item=>`<option value="${E(item.id)}" ${item.id===selectedId?'selected':''}>${E(item.name)}</option>`).join('');
  }
  function templateEditor(draft){
    return `<section class="panel quotation-section"><div class="quotation-section-heading"><div><h2>报价单版式</h2><p>上传的报价模板可用于生成 PDF，产品、单价和总额由报价单自动填入。</p></div>${L.can('templates')?'<a class="btn small" href="#/templates?tab=quotation">管理报价模板</a>':''}</div><div class="quotation-template-picker"><label class="field"><span>报价单模板</span><select name="pdfTemplateId" id="quote-template" aria-label="报价单模板">${templateOptions(draft.pdfTemplateId)}</select></label><button type="button" class="btn" id="quote-template-preview">查看版式示例</button></div></section>`;
  }
  function openPDFExport(id){
    const c=access(),quote=readRecord(id,c),selectedId=quote.pdfTemplateId||L.quotationTemplates?.defaultId()||'quotation-default';
    const d=L.modal('导出报价 PDF',`<p class="quotation-export-reference" data-no-translate>${E(quote.number)} · ${E(quote.customer)}</p><label class="field"><span>报价单模板</span><select id="quote-export-template" aria-label="报价单模板">${templateOptions(selectedId)}</select><small>选择本次 PDF 使用的版式，报价内容与金额保持一致。</small></label><div class="modal-actions"><button type="button" class="btn" data-cancel>取消</button><button type="button" class="btn primary" data-download>下载 PDF</button></div>`);
    d.querySelector('[data-cancel]').onclick=()=>d.close();
    d.querySelector('[data-download]').onclick=async()=>{
      const button=d.querySelector('[data-download]'),select=d.querySelector('#quote-export-template');button.disabled=true;select.disabled=true;
      try{access(c);await exportPDF(id,{templateId:select.value});if(d.isConnected)d.close();L.toast('报价 PDF 已下载');}
      catch(error){if(d.isConnected)errorAt(d.querySelector('.modal-body'),error);else L.toast(error.message);}
      finally{button.disabled=false;select.disabled=false;}
    };
    return d;
  }
  function openPicker(onAdd){
    const c=access(),rows=availableRows(),selected=new Map();let query='';
    const d=L.modal('选择报价产品',`<div class="quotation-picker-toolbar"><input type="search" class="search-input" placeholder="搜索品牌、型号、SKU 或配色" aria-label="搜索报价产品" id="quote-product-search"><span id="quote-picker-count" class="muted">已选 0 项</span></div><div id="quote-picker-results"></div><div class="modal-actions"><button class="btn" data-cancel>取消</button><button class="btn primary" data-add disabled>加入报价单</button></div>`,{wide:true});
    const paint=()=>{access(c);const filtered=rows.filter(({p,v})=>`${p.name} ${p.brand||''} ${v.sku||''} ${v.colorLabel||v.color||''}`.toLowerCase().includes(query.toLowerCase()));d.querySelector('#quote-picker-results').innerHTML=filtered.length?`<div class="quotation-picker-list">${filtered.map(({p,v})=>`<label class="quotation-picker-item"><input type="checkbox" data-key="${E(p.id+':'+v.id)}" ${selected.has(p.id+':'+v.id)?'checked':''}>${L.image(v.images?.[0],p.name,'quotation-thumb')}<span><strong>${E(p.name)}</strong><small>${E([v.sku,v.colorLabel||v.color].filter(Boolean).join(' · ')||'配色未填写')}</small></span></label>`).join('')}</div>`:'<div class="empty-state">没有匹配的已发布产品。</div>';d.querySelectorAll('[data-key]').forEach(input=>input.onchange=()=>{try{access(c);const row=rows.find(({p,v})=>`${p.id}:${v.id}`===input.dataset.key);if(input.checked)selected.set(input.dataset.key,{productId:row.p.id,skuId:row.v.id});else selected.delete(input.dataset.key);d.querySelector('#quote-picker-count').textContent=`已选 ${selected.size} 项`;d.querySelector('[data-add]').disabled=!selected.size;}catch(error){errorAt(d.querySelector('.modal-body'),error);}});};
    d.querySelector('#quote-product-search').oninput=e=>{query=e.target.value;try{paint();}catch(error){errorAt(d.querySelector('.modal-body'),error);}};
    d.querySelector('[data-cancel]').onclick=()=>d.close();d.querySelector('[data-add]').onclick=()=>{try{access(c);const lines=fromSelection([...selected.values()]);onAdd(lines);d.close();}catch(error){errorAt(d.querySelector('.modal-body'),error);}};paint();
  }
  function renderList(el){
    const c=access(),all=visibleRecords();let query='';
    el.innerHTML=L.pageBanner({eyebrow:'QUOTATIONS',title:'业务报价',description:'选择产品、填写价格与数量，生成可发给客户的 PDF 报价单。',actions:'<button class="btn primary" id="quote-new">＋ 新建报价</button>'})+`<section class="panel quotation-list-panel"><div class="quotation-list-toolbar"><input type="search" class="search-input" id="quote-search" placeholder="搜索报价编号或客户" aria-label="搜索报价单"><span class="muted">${all.length} 份报价 · ${c.member.role==='admin'?'当前主体全部报价':'我的报价'}</span></div><div id="quote-records"></div><p class="quotation-local-note">草稿保存在当前浏览器，换电脑后不会自动同步。</p></section>`;
    el.querySelector('#quote-new').onclick=()=>L.openQuotation();
    const paint=()=>{access(c);const rows=all.filter(q=>`${q.number} ${q.customer}`.toLowerCase().includes(query.toLowerCase()));el.querySelector('#quote-records').innerHTML=rows.length?`<div class="table-wrap"><table class="quotation-list-table"><thead><tr><th>报价编号 / 客户</th><th>金额</th><th>有效期至</th><th>更新时间</th><th>操作</th></tr></thead><tbody>${rows.map(q=>`<tr><td><strong>${E(q.number||'未填写编号')}</strong><small>${E(q.customer||'客户待填写')}</small></td><td>${q.totalCents===null?'待补齐价格':E(q.currency+' '+money(q.totalCents))}<small>${q.lines.length} 个明细</small></td><td>${E(q.validUntil||'未填写')}</td><td>${E(L.date(q.updatedAt))}</td><td><div class="row-actions"><button class="btn small" data-edit="${E(q.id)}">编辑</button><button class="btn small" data-copy="${E(q.id)}">复制</button><button class="btn small" data-pdf="${E(q.id)}">下载 PDF</button></div></td></tr>`).join('')}</tbody></table></div>`:`<div class="empty-state"><h3>${all.length?'没有匹配的报价':'还没有报价单'}</h3><p>${all.length?'试试其他报价编号或客户名称。':'新建报价，选择产品并填写客户和价格。'}</p></div>`;
      el.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{try{access(c);readRecord(b.dataset.edit,c);L.go(`quotations?id=${encodeURIComponent(b.dataset.edit)}`);}catch(error){errorAt(el,error);}});
      el.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{access(c);const q=await copyQuotation(b.dataset.copy);access(c);L.toast('已复制为新的报价草稿');L.go(`quotations?id=${encodeURIComponent(q.id)}`);}catch(error){errorAt(el,error);b.disabled=false;}});
      el.querySelectorAll('[data-pdf]').forEach(b=>b.onclick=()=>{try{access(c);openPDFExport(b.dataset.pdf);}catch(error){errorAt(el,error);}});
    };el.querySelector('#quote-search').oninput=e=>{query=e.target.value;try{paint();}catch(error){errorAt(el,error);}};paint();
  }
  function renderEditor(el,input){
    const c=access();let draft=clone(input);draft.pdfTemplateId=draft.pdfTemplateId||L.quotationTemplates?.defaultId()||'quotation-default';let baseline=!draft.revision&&draft.lines.length?'':JSON.stringify(draft),busy=false;
    L.isDirty=()=>JSON.stringify(draft)!==baseline;
    const check=()=>{access(c);if(records(c).some(q=>q.id===draft.id)){const stored=readRecord(draft.id,c);if(stored.revision!==draft.revision)throw new Error('报价单已更新，请重新打开。');}};
    const field=(name,label,type='text',max=160)=>`<label class="field"><span>${label}</span><input name="${name}" type="${type}" maxlength="${max}" value="${E(draft[name])}" ${['customer','number','date','validUntil'].includes(name)?'aria-required="true"':''}></label>`;
    el.innerHTML=L.pageBanner({eyebrow:'QUOTATIONS',title:draft.revision?'编辑报价':'新建报价',description:'填写客户与产品价格，保存后下载 PDF。原产品资料不会被修改。',actions:'<button class="btn" id="quote-back">返回报价列表</button>'})+`<form id="quote-form" novalidate><fieldset class="quotation-form-fields"><section class="panel quotation-section"><div class="quotation-section-heading"><h2>报价信息</h2><span class="badge">${draft.revision?'已保存草稿':'未保存'}</span></div><div class="quotation-info-grid">${field('customer','客户名称')}${field('contact','联系人')}${field('number','报价编号','text',80)}<label class="field"><span>币种</span><select name="currency">${CURRENCIES.map(value=>`<option value="${value}" ${value===draft.currency?'selected':''}>${value}</option>`).join('')}</select><small>币种仅设置金额单位，不自动换算。</small></label>${field('date','报价日期','date')}${field('validUntil','有效期至','date')}</div></section><section class="panel quotation-section"><div class="quotation-section-heading"><div><h2>产品明细</h2><p>单价留空表示尚未定价；免费项目请明确填写 0。</p></div><button type="button" class="btn" id="quote-add">＋ 添加产品</button></div><div id="quote-lines"></div><div class="quotation-summary"><span id="quote-line-count"></span><div><span id="quote-total-label">合计</span><strong id="quote-total" aria-live="polite"></strong><small id="quote-total-note"></small></div></div></section>${templateEditor(draft)}<section class="panel quotation-section"><label class="field"><span>备注 / 交易条件</span><textarea name="notes" rows="4" maxlength="3000" placeholder="可填写交货时间、付款方式、运费或其他约定">${E(draft.notes)}</textarea></label></section></fieldset><div class="quotation-form-actions"><p id="quote-save-status" role="status">${draft.revision?'已保存于当前浏览器':'填写后保存草稿，可稍后继续编辑。'}</p><div class="row-actions"><button type="submit" class="btn" id="quote-save">保存草稿</button><button type="button" class="btn primary" id="quote-export">保存并下载 PDF</button></div></div></form>`;
    const form=el.querySelector('#quote-form'),fieldset=el.querySelector('.quotation-form-fields');
    el.querySelector('#quote-template-preview')?.addEventListener('click',()=>{try{check();if(!L.quotationTemplates)throw new Error('报价模板组件尚未加载，请刷新后重试。');L.quotationTemplates.preview(draft.pdfTemplateId);}catch(error){errorAt(el,error);}});
    const updateAmounts=()=>{el.querySelector('#quote-line-count').textContent=`${draft.lines.length} 个明细`;try{const result=amounts(draft.lines);el.querySelector('#quote-total-label').textContent=result.pending?'已填写金额':'合计';el.querySelector('#quote-total').textContent=`${draft.currency} ${money(result.total)}`;el.querySelector('#quote-total-note').textContent=result.pending?`${result.pending} 个明细待补齐单价或数量`:'';result.rows.forEach((value,i)=>{const cell=el.querySelector(`[data-amount="${i}"]`);if(cell){cell.textContent=value===null?'待填写':money(value);cell.setAttribute('aria-label','金额 '+(value===null?'待填写':draft.currency+' '+money(value)));}});}catch(error){el.querySelector('#quote-total').textContent='请核对金额';el.querySelector('#quote-total-note').textContent=error.message;}};
    const paintLines=()=>{el.querySelector('#quote-lines').innerHTML=draft.lines.length?`<div class="quotation-lines-table"><table><thead><tr><th>产品 / 配色</th><th>数量</th><th>单价</th><th>金额</th><th></th></tr></thead><tbody>${draft.lines.map((line,i)=>`<tr><td><div class="quotation-product-cell">${L.image(line.snapshot.image,line.snapshot.name,'quotation-thumb')}<div><strong>${E(line.snapshot.name)}</strong><small>${E([line.snapshot.brand,line.snapshot.sku,line.snapshot.color].filter(Boolean).join(' · '))}</small></div></div></td><td data-label="数量"><input class="quotation-number" type="text" inputmode="numeric" aria-label="${E(line.snapshot.name)} 数量" data-line="${i}" data-value="quantity" value="${E(line.quantity)}"></td><td data-label="单价"><input class="quotation-number" type="text" inputmode="decimal" aria-label="${E(line.snapshot.name)} 单价" placeholder="待定价" data-line="${i}" data-value="unitPrice" value="${E(line.unitPrice)}"></td><td data-amount="${i}" data-label="金额" aria-label="金额"></td><td><button type="button" class="icon-btn" data-remove="${i}" aria-label="移除 ${E(line.snapshot.name)}">${L.icon('close')}</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state quotation-empty-lines"><p>从已发布的产品中选择型号和配色。</p><button type="button" class="btn" id="quote-add-empty">选择产品</button></div>';
      el.querySelectorAll('[data-line]').forEach(input=>input.oninput=()=>{try{check();draft.lines[Number(input.dataset.line)][input.dataset.value]=input.value;updateAmounts();}catch(error){errorAt(el,error);}});
      el.querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>{try{check();draft.lines.splice(Number(button.dataset.remove),1);paintLines();}catch(error){errorAt(el,error);}});el.querySelector('#quote-add-empty')?.addEventListener('click',add);updateAmounts();};
    const add=()=>{try{check();openPicker(lines=>{check();if(draft.lines.length+lines.length>MAX_LINES)throw new Error(`每份报价单最多 ${MAX_LINES} 个明细。`);draft.lines.push(...lines);paintLines();});}catch(error){errorAt(el,error);}};
    el.querySelector('#quote-add').onclick=add;el.querySelector('#quote-back').onclick=()=>L.go('quotations');
    form.querySelectorAll('[name]').forEach(input=>input.addEventListener('input',()=>{try{check();draft[input.name]=input.value;updateAmounts();}catch(error){errorAt(el,error);}}));
    const save=async(pdf=false)=>{
      if(busy)return;busy=true;fieldset.disabled=true;el.querySelector('#quote-save').disabled=true;el.querySelector('#quote-export').disabled=true;el.querySelector('.quotation-error')?.remove();
      try{check();if(pdf)normalize(draft,{complete:true,stored:records(c).some(q=>q.id===draft.id)?readRecord(draft.id,c):null});draft=await persist(draft);access(c);baseline=JSON.stringify(draft);el.querySelector('#quote-save-status').textContent='草稿已保存于当前浏览器。';el.querySelector('.quotation-section-heading .badge').textContent='已保存草稿';if(pdf){el.querySelector('#quote-save-status').textContent='正在生成 PDF…';await exportPDF(draft.id);el.querySelector('#quote-save-status').textContent='报价 PDF 已下载，草稿已保存。';}L.toast(pdf?'报价 PDF 已下载':'报价草稿已保存');if(!pdf){L.isDirty=null;L.go(`quotations?id=${encodeURIComponent(draft.id)}`);}}
      catch(error){errorAt(el,error);el.querySelector('#quote-save-status').textContent='操作未完成，当前填写内容已保留。';}
      finally{busy=false;fieldset.disabled=false;el.querySelector('#quote-save').disabled=false;el.querySelector('#quote-export').disabled=false;}
    };
    form.onsubmit=event=>{event.preventDefault();save();};el.querySelector('#quote-export').onclick=()=>save(true);paintLines();
  }
  L.openQuotation=(selection=[])=>{try{const c=access(),token=L.uid('new');pendingEntry={token,context:c,selection:clone(selection)};L.go(`quotations?new=${encodeURIComponent(token)}`);}catch(error){L.toast(error.message);}};
  L.register('quotations',{title:'业务报价',subtitle:'填写产品价格，生成 PDF 报价单',banner:true,render:(el,params=new URLSearchParams())=>{try{const c=access(),id=params.get('id');if(id)renderEditor(el,clone(readRecord(id,c)));else if(params.has('new')){let selection=[];if(pendingEntry?.token===params.get('new')){access(pendingEntry.context);selection=pendingEntry.selection;pendingEntry=null;}renderEditor(el,newDraft(selection));}else renderList(el);}catch(error){el.innerHTML=`<div class="empty-state panel" role="alert">${E(error.message)}</div>`;}}});
  L.quotationTools={parsePrice,parseQuantity,money,amounts,newDraft,persist,copyQuotation,visibleRecords,readRecord: id=>clone(readRecord(id)),exportPDF,pdfSpec};
})();
