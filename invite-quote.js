(() => {
  'use strict';
  const L=window.Library;
  const CURRENCIES=Object.freeze(['CNY','USD','EUR','HKD']);
  const COMPANIES=Object.freeze({
    uniqmag:Object.freeze({id:'uniqmag',name:'UNIQMAG',logo:'assets/logo.png'}),
    unico:Object.freeze({id:'unico',name:'UNICO',logo:'assets/unico-logo.png'})
  });
  const MAX_CENTS=BigInt(Number.MAX_SAFE_INTEGER),MAX_LINES=100;
  const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
  const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function text(value,label,max,required=false,multiline=false){
    if(value===undefined||value===null)value='';
    if(typeof value!=='string')throw new Error(`${label}格式不正确。`);
    const result=value.trim();
    if(required&&!result)throw new Error(`请填写${label}。`);
    if(result.length>max)throw new Error(`${label}最多 ${max} 个字符。`);
    if((multiline?/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/:/[\u0000-\u001F\u007F]/).test(result))throw new Error(`${label}包含无效字符。`);
    return result;
  }
  function company(companyId){
    if(typeof companyId!=='string'||!own(COMPANIES,companyId))throw new Error('报价所属公司不存在。');
    return COMPANIES[companyId];
  }
  function date(value,label){
    const raw=text(value,label,10,true);
    const parsed=new Date(`${raw}T12:00:00Z`);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(raw)||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==raw)throw new Error(`${label}不是有效日期。`);
    return raw;
  }
  function price(value){
    if(typeof value!=='string'||value.length>30||!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value))throw new Error('单价须为非负金额，最多保留两位小数。');
    const [whole,fraction='']=value.split('.');
    const cents=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
    if(cents>MAX_CENTS)throw new Error('单价过大，请核对金额。');
    return cents;
  }
  function quantity(value){
    if(typeof value!=='string'||value.length>7||!/^[1-9]\d*$/.test(value)||BigInt(value)>1000000n)throw new Error('数量须为 1 至 1,000,000 的整数。');
    return BigInt(value);
  }
  function money(value){
    if(typeof value==='number'&&(!Number.isSafeInteger(value)||value<0))throw new Error('金额格式不正确。');
    if(typeof value!=='number'&&typeof value!=='bigint')throw new Error('金额格式不正确。');
    const cents=BigInt(value);
    if(cents<0n||cents>MAX_CENTS)throw new Error('金额超出范围。');
    return `${cents/100n}.${String(cents%100n).padStart(2,'0')}`;
  }
  function image(value){
    const raw=text(value,'产品图片地址',300);
    if(!raw)return '';
    // Shared links must work on a new device. Only bundled raster assets are portable.
    if(!/^assets\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(?:png|jpe?g|webp|gif|avif)$/i.test(raw)||raw.includes('..'))throw new Error('分享报价图片须使用网站自带的产品图片。');
    return raw;
  }
  function normalize(input,options={}){
    if(!record(options))throw new Error('报价验证范围不正确。');
    company(options.companyId);
    if(!record(input)||input.version!==1)throw new Error('报价内容格式不正确，请重新生成链接。');
    if(!CURRENCIES.includes(input.currency))throw new Error('请选择支持的报价币种。');
    if(!Array.isArray(input.lines)||!input.lines.length||input.lines.length>MAX_LINES)throw new Error(`每份分享报价须包含 1 至 ${MAX_LINES} 个产品明细。`);
    let scope=null;
    if(options.productIds!==undefined){
      if(!Array.isArray(options.productIds)||options.productIds.length>1000)throw new Error('报价产品范围不正确。');
      scope=new Set(options.productIds.map(id=>text(id,'产品标识',100,true)));
    }
    const seen=new Set();let total=0n;
    const lines=input.lines.map(line=>{
      if(!record(line))throw new Error('报价产品明细格式不正确。');
      const productId=text(line.productId,'产品标识',100,true),skuId=text(line.skuId,'配色标识',100,true);
      if(scope&&!scope.has(productId))throw new Error('报价包含邀请范围之外的产品，请调整产品选择。');
      const key=JSON.stringify([productId,skuId]);
      if(seen.has(key))throw new Error('报价中的产品配色重复，请合并数量。');
      seen.add(key);
      const cents=price(line.unitPrice),count=quantity(line.quantity),amount=cents*count;
      total+=amount;
      if(amount>MAX_CENTS||total>MAX_CENTS)throw new Error('报价总额过大，请核对单价与数量。');
      return {productId,skuId,name:text(line.name,'产品名称',120,true),sku:text(line.sku,'SKU',80),color:text(line.color,'配色',80),brand:text(line.brand,'产品品牌',60),image:image(line.image),unitPrice:money(cents),quantity:String(count)};
    });
    // Do not trust caller-supplied totals, prices from the catalog, or extra fields.
    return {version:1,number:text(input.number,'报价编号',80,true),currency:input.currency,validUntil:date(input.validUntil,'报价有效期'),notes:text(input.notes,'报价备注',500,false,true),lines,totalCents:Number(total)};
  }
  function localDate(){const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;}
  function renderReadOnly(el,envelope){
    if(!el||!record(envelope))throw new Error('报价页面无法显示，请重新打开链接。');
    const brand=company(envelope.companyId),quote=normalize(envelope.quotation,{companyId:brand.id});
    const customer=text(envelope.customer,'客户名称',100,true),contact=text(envelope.contact,'联系人',60);
    const expired=quote.validUntil<localDate();
    const rows=quote.lines.map(line=>{
      const amount=price(line.unitPrice)*quantity(line.quantity);
      const artwork=line.image?`<img class="customer-quote-image" src="${esc(line.image)}" alt="${esc(line.name)}" loading="lazy">`:'<span class="customer-quote-image customer-quote-image-empty" aria-hidden="true">暂无图片</span>';
      return `<tr><td class="customer-quote-product"><div>${artwork}<div class="customer-quote-product-copy">${line.brand?`<small>${esc(line.brand)}</small>`:''}<strong>${esc(line.name)}</strong><span>${esc(line.sku||line.skuId)}</span>${line.color?`<span>${esc(line.color)}</span>`:''}</div></div></td><td class="customer-quote-number" data-label="单价">${esc(quote.currency)} ${money(price(line.unitPrice))}</td><td class="customer-quote-number" data-label="数量">${esc(line.quantity)}</td><td class="customer-quote-number customer-quote-amount" data-label="金额">${esc(quote.currency)} ${money(amount)}</td></tr>`;
    }).join('');
    el.innerHTML=`<article class="customer-quote" aria-labelledby="customer-quote-title"><header class="customer-quote-header"><div class="customer-quote-brand"><img src="${brand.logo}" alt="${brand.name}" data-company-logo="${brand.id}"></div><div class="customer-quote-heading"><p>QUOTATION</p><h1 id="customer-quote-title">客户报价</h1></div></header><section class="customer-quote-info" aria-label="报价信息"><div><span>客户名称</span><strong>${esc(customer)}</strong>${contact?`<small>${esc(contact)}</small>`:''}</div><div><span>报价编号</span><strong>${esc(quote.number)}</strong></div><div><span>有效期至</span><strong>${esc(quote.validUntil)}</strong></div><div><span>币种</span><strong>${esc(quote.currency)}</strong></div></section>${expired?'<p class="customer-quote-expired" role="status">报价已过有效期，请联系业务人员确认。</p>':''}<div class="customer-quote-table-wrap"><table class="customer-quote-table"><caption>产品报价明细</caption><thead><tr><th scope="col">产品 / 配色</th><th scope="col">单价</th><th scope="col">数量</th><th scope="col">金额</th></tr></thead><tbody>${rows}</tbody></table></div><div class="customer-quote-total"><span>报价总额 <small>${quote.lines.length} 个明细</small></span><strong>${esc(quote.currency)} ${money(quote.totalCents)}</strong></div>${quote.notes?`<section class="customer-quote-notes" aria-label="报价备注"><h2>备注</h2><p>${esc(quote.notes)}</p></section>`:''}<footer class="customer-quote-footer">此页面为分享时的报价副本，更新后需重新发送链接。最终价格请与业务人员确认。</footer></article>`;
    return quote;
  }
  function renderCatalog(el,envelope){
    if(!el||!record(envelope))throw new Error('报价页面无法显示，请重新打开链接。');
    const brand=company(envelope.companyId),quote=normalize(envelope.quotation,{companyId:brand.id});
    const customer=text(envelope.customer,'客户名称',100,true),contact=text(envelope.contact,'联系人',60);
    const expiresAt=typeof envelope.expiresAt==='string'?Date.parse(envelope.expiresAt):NaN;
    const quoteEnd=Date.parse(`${quote.validUntil}T23:59:59.999+08:00`);
    const snapshot={companyId:brand.id,customer,contact,quotation:quote};
    const groups=[];const byProduct=new Map();
    quote.lines.forEach(line=>{
      let group=byProduct.get(line.productId);
      if(!group){group={productId:line.productId,lines:[],active:0};byProduct.set(line.productId,group);groups.push(group);}
      group.lines.push(line);
    });
    let view='products',detailIndex=0;
    const raw=value=>`<span data-no-translate>${esc(value)}</span>`;
    const amount=line=>money(price(line.unitPrice)*quantity(line.quantity));
    const quotationInfo=line=>`<section class="quote-catalog-quotation" aria-label="报价信息"><header><span>报价信息</span><small><span>币种</span><span data-no-translate>${esc(quote.currency)}</span></small></header><dl><div><dt>单价</dt><dd class="quote-catalog-unit-price"><strong data-no-translate>${money(price(line.unitPrice))}</strong></dd></div><div><dt>报价数量</dt><dd><strong data-no-translate>${esc(line.quantity)}</strong></dd></div><div><dt>小计</dt><dd><strong data-no-translate>${amount(line)}</strong></dd></div></dl></section>`;
    function ensureActive(){
      if(!Number.isFinite(expiresAt)||!Number.isFinite(quoteEnd))throw new Error('报价链接有效期不正确，请索取新链接。');
      if(Math.min(expiresAt,quoteEnd)<=Date.now())throw new Error('这份报价副本已过有效期，请联系业务人员获取最新报价。');
    }
    const logo=()=>`<img src="${brand.logo}" alt="${brand.name}" data-company-logo="${brand.id}">`;
    const artwork=(line,lazy=true)=>line.image?`<img src="${esc(line.image)}" alt="${esc(line.name)}" ${lazy?'loading="lazy"':''} data-no-translate>`:'<span class="quote-catalog-no-image">图片待补充</span>';
    const variants=(group,index)=>`<div class="quote-catalog-variants" role="group" aria-label="选择报价配色">${group.lines.map((line,i)=>`<button type="button" class="quote-catalog-variant" data-quote-catalog-action="variant" data-quote-group="${index}" data-quote-line="${i}" aria-pressed="${group.active===i}"><span data-no-translate>${esc(line.color||line.sku||line.skuId)}</span></button>`).join('')}</div>`;
    const footer=()=>'<footer class="quote-catalog-footer">此页面为分享时的报价副本，更新后需重新发送链接。最终价格请与业务人员确认。</footer>';
    const notes=()=>quote.notes?`<section class="quote-catalog-notes"><h2>报价备注</h2><p data-no-translate>${esc(quote.notes)}</p></section>`:'';
    function navigation(){
      return `<header class="quote-catalog-nav"><div class="quote-catalog-brand">${logo()}</div><nav aria-label="报价资料导航"><button type="button" data-quote-catalog-action="products" class="quote-catalog-nav-item" ${view!=='summary'?'aria-current="page"':''}>产品资料库</button><button type="button" data-quote-catalog-action="summary" class="quote-catalog-nav-item" ${view==='summary'?'aria-current="page"':''}>报价汇总</button></nav></header>`;
    }
    function intro(){
      return `<section class="quote-catalog-intro" aria-labelledby="quote-catalog-title"><div class="quote-catalog-intro-copy"><p class="quote-catalog-eyebrow">客户专属报价</p><h1 id="quote-catalog-title">产品资料库</h1><p class="quote-catalog-description">浏览已报价产品，查看配色与专属价格。</p><dl class="quote-catalog-context"><div><dt>客户</dt><dd data-no-translate>${esc(customer)}${contact?` · ${esc(contact)}`:''}</dd></div><div><dt>报价编号</dt><dd data-no-translate>${esc(quote.number)}</dd></div><div><dt>有效期至</dt><dd data-no-translate>${esc(quote.validUntil)}</dd></div></dl></div><div class="quote-catalog-overview"><span>报价总额</span><strong data-no-translate>${esc(quote.currency)} ${money(quote.totalCents)}</strong><small>${groups.length} 个产品 · ${quote.lines.length} 个报价配色</small><button type="button" class="quote-catalog-summary-link" data-quote-catalog-action="summary">查看报价汇总 <span aria-hidden="true">→</span></button></div></section>`;
    }
    function card(group,index){
      const line=group.lines[group.active];
      return `<article class="quote-catalog-card" data-quote-card="${index}"><button type="button" class="quote-catalog-image-button" data-quote-catalog-action="detail" data-quote-group="${index}" aria-label="查看产品详情">${artwork(line)}<span class="quote-catalog-image-link">查看详情 <span aria-hidden="true">↗</span></span></button><div class="quote-catalog-card-body"><div class="quote-catalog-product-title">${line.brand?`<p data-no-translate>${esc(line.brand)}</p>`:''}<h2><button type="button" data-quote-catalog-action="detail" data-quote-group="${index}" data-no-translate>${esc(line.name)}</button></h2></div>${variants(group,index)}<p class="quote-catalog-sku">SKU <span data-no-translate>${esc(line.sku||line.skuId)}</span></p>${quotationInfo(line)}</div></article>`;
    }
    function products(){
      return `${intro()}<div class="quote-catalog-section-heading"><h2>已报价产品</h2><span>${groups.length} 个产品</span></div><section class="quote-catalog-grid" aria-label="已报价产品">${groups.map(card).join('')}</section>${notes()}${footer()}`;
    }
    function detail(){
      const group=groups[detailIndex],line=group.lines[group.active];
      return `<div class="quote-catalog-detail-toolbar"><button type="button" class="quote-catalog-back" data-quote-catalog-action="products"><span aria-hidden="true">←</span> 返回产品资料库</button><span>客户专属报价</span></div><section class="quote-catalog-detail" aria-labelledby="quote-catalog-detail-title"><div class="quote-catalog-detail-image">${artwork(line,false)}</div><div class="quote-catalog-detail-copy">${line.brand?`<p class="quote-catalog-eyebrow" data-no-translate>${esc(line.brand)}</p>`:''}<h1 id="quote-catalog-detail-title" tabindex="-1" data-no-translate>${esc(line.name)}</h1><p class="quote-catalog-detail-sku">SKU ${raw(line.sku||line.skuId)}</p><div class="quote-catalog-detail-variants"><h2>报价配色</h2>${variants(group,detailIndex)}</div>${quotationInfo(line)}<dl class="quote-catalog-detail-context"><div><dt>客户</dt><dd data-no-translate>${esc(customer)}</dd></div>${contact?`<div><dt>联系人</dt><dd data-no-translate>${esc(contact)}</dd></div>`:''}<div><dt>报价编号</dt><dd data-no-translate>${esc(quote.number)}</dd></div><div><dt>有效期至</dt><dd data-no-translate>${esc(quote.validUntil)}</dd></div></dl><button type="button" class="quote-catalog-summary-link" data-quote-catalog-action="summary">查看报价汇总 <span aria-hidden="true">→</span></button></div></section>${notes()}${footer()}`;
    }
    function expired(error){
      el.innerHTML=`<section class="customer-quote quote-share-error" role="alert"><div class="quote-catalog-brand">${logo()}</div><h1>报价暂不可用</h1><p>${esc(error.message)}</p><p class="muted">请联系为您提供链接的业务人员。</p></section>`;
    }
    function paint(focusSelector){
      ensureActive();
      el.innerHTML=`<div class="quote-catalog">${navigation()}${view==='summary'?'<div class="quote-catalog-summary"><div data-quote-sheet></div></div>':view==='detail'?detail():products()}</div>`;
      if(view==='summary'){
        const target=el.querySelector?.('[data-quote-sheet]');
        if(target)renderReadOnly(target,snapshot);
      }
      if(focusSelector)el.querySelector?.(focusSelector)?.focus?.({preventScroll:true});
    }
    // Every view change rechecks expiry. No catalog, employee session or storage is consulted.
    el.onclick=event=>{
      const button=event.target?.closest?.('[data-quote-catalog-action]');
      if(!button||el.contains&&!el.contains(button))return;
      event.preventDefault?.();
      try{
        ensureActive();
        const action=button.dataset.quoteCatalogAction;
        if(action==='summary'){view='summary';paint('.quote-catalog-nav-item[aria-current="page"]');}
        else if(action==='products'){view='products';paint('.quote-catalog-nav-item[aria-current="page"]');}
        else if(action==='detail'||action==='variant'){
          const groupIndex=Number(button.dataset.quoteGroup),lineIndex=Number(button.dataset.quoteLine),group=groups[groupIndex];
          if(!Number.isInteger(groupIndex)||!group)return;
          if(action==='detail'){detailIndex=groupIndex;view='detail';paint('#quote-catalog-detail-title');}
          else {if(!Number.isInteger(lineIndex)||!group.lines[lineIndex])return;group.active=lineIndex;paint(`[data-quote-catalog-action="variant"][data-quote-group="${groupIndex}"][data-quote-line="${lineIndex}"]`);}
        }
      }catch(error){expired(error);}
    };
    try{paint();}catch(error){expired(error);}
    return quote;
  }
  L.inviteQuote=Object.freeze({normalize,renderReadOnly,renderCatalog,money,safeImage:image,companies:COMPANIES,currencies:CURRENCIES,maxLines:MAX_LINES});
})();
