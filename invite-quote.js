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
  L.inviteQuote=Object.freeze({normalize,renderReadOnly,money,safeImage:image,companies:COMPANIES,currencies:CURRENCIES,maxLines:MAX_LINES});
})();
