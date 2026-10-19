/* Portable demonstration snapshots. No server authorization, identity changes or remote revocation. */
(() => {
  'use strict';
  const L=window.Library, MAX_BYTES=16*1024, MAX_URL=24*1024;
  const companies=new Set(['uniqmag','unico']);
  const tooLarge=()=>new Error('报价内容较多，链接超过分享长度上限。请减少报价明细或改发 PDF。');
  function string(value,label,max,required=false){
    if(typeof value!=='string')throw new Error(`${label}格式不正确。`);
    const text=value.trim();if((required&&!text)||text.length>max)throw new Error(`${label}为空或过长。`);return text;
  }
  function instant(value,label){
    const text=string(value,label,32,true),date=new Date(text);
    if(!Number.isFinite(date.getTime())||date.toISOString()!==text)throw new Error(`${label}格式不正确。`);
    return text;
  }
  function normalize(value,expectedCompany){
    if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==1)throw new Error('报价链接版本不受支持，请索取新链接。');
    if(!companies.has(value.companyId)||value.companyId!==expectedCompany)throw new Error('报价所属公司与链接不一致，请索取完整链接。');
    const quotation=L.inviteQuote.normalize(value.quotation,{companyId:value.companyId});
    const createdAt=instant(value.createdAt,'生成时间'),expiresAt=instant(value.expiresAt,'有效期');
    const quoteEnd=Date.parse(quotation.validUntil+'T23:59:59.999+08:00');
    if(Date.parse(expiresAt)>quoteEnd||Date.parse(expiresAt)<=Date.parse(createdAt))throw new Error('报价链接有效期不正确，请索取新链接。');
    return {version:1,companyId:value.companyId,customer:string(value.customer,'客户名称',100,true),contact:string(value.contact??'','联系人',60),createdAt,expiresAt,quotation};
  }
  function encode(value){
    const bytes=new TextEncoder().encode(JSON.stringify(value));if(bytes.length>MAX_BYTES)throw tooLarge();
    let binary='';for(let i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);
    return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
  }
  function decode(token,expectedCompany){
    if(typeof token!=='string'||!token||token.length>Math.ceil(MAX_BYTES*4/3)||!/^[A-Za-z0-9_-]+$/.test(token)||token.length%4===1)throw new Error('报价链接不完整或过长，请重新复制完整链接。');
    let parsed;
    try{
      const raw=atob(token.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-token.length%4)%4));
      if(raw.length>MAX_BYTES)throw tooLarge();
      if(btoa(raw).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')!==token)throw new Error('Noncanonical encoding');
      const bytes=Uint8Array.from(raw,char=>char.charCodeAt(0));
      parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    }catch{throw new Error('报价链接无法读取，请向业务人员索取新链接。');}
    return normalize(parsed,expectedCompany);
  }
  function snapshot(invite){
    if(!L.isStaff()||!L.can('invites')||!L.can('quote'))throw new Error('仅管理员和业务人员可以分享客户报价。');
    if(!L.inviteValid(invite)||!invite.quotation)throw new Error('请先填写报价，并确认邀请处于有效状态。');
    const companyId=L.companyId(),productIds=Array.isArray(invite.productIds)?invite.productIds:[];
    const input=structuredClone(invite.quotation);
    // Uploaded images are browser-local; do not embed source files or private blobs into a URL.
    if(Array.isArray(input.lines))input.lines.forEach(line=>{if(typeof line.image==='string'&&/^(data:|blob:)/.test(line.image))line.image='';});
    const quotation=L.inviteQuote.normalize(input,{companyId,productIds});
    const published=L.liveProducts();
    for(const line of quotation.lines){
      const product=published.find(item=>item.id===line.productId);
      if(!product||!(product.variants||[]).some(item=>item.id===line.skuId))throw new Error('报价中有产品或配色已下架，请重新选择后生成链接。');
    }
    const createdAt=new Date().toISOString();
    const expiresAt=new Date(Math.min(Date.parse(invite.expiresAt),Date.parse(quotation.validUntil+'T23:59:59.999+08:00'))).toISOString();
    const result=normalize({version:1,companyId,customer:invite.company,contact:invite.contact||'',createdAt,expiresAt,quotation},companyId);
    if(Date.parse(result.expiresAt)<=Date.now())throw new Error('报价已过有效期，请调整日期后再生成链接。');
    return result;
  }
  function url(invite){
    const value=snapshot(invite),target=new URL(location.href);
    target.search='';target.hash='/quote?'+new URLSearchParams({company:value.companyId,share:encode(value)}).toString();
    if(target.href.length>MAX_URL)throw tooLarge();return target.href;
  }
  let expiryTimer;
  function render(el,params){
    clearTimeout(expiryTimer);
    try{
      if(params.getAll('share').length!==1||params.getAll('company').length!==1)throw new Error('报价链接不完整，请索取完整链接。');
      const value=decode(params.get('share'),params.get('company'));
      if(Date.parse(value.expiresAt)<=Date.now())throw new Error('这份报价副本已过有效期，请联系业务人员获取最新报价。');
      document.title=`客户报价 · ${value.companyId==='unico'?'UNICO':'UNIQMAG'}`;
      L.inviteQuote.renderReadOnly(el,value);
      const check=()=>{
        if(!el.isConnected||location.hash.replace(/^#\/?/,'').split('?')[0]!=='quote')return;
        if(Date.parse(value.expiresAt)<=Date.now()){render(el,params);return;}
        expiryTimer=setTimeout(check,Math.min(60000,Date.parse(value.expiresAt)-Date.now()+20));
      };check();
    }catch(error){
      document.title='报价暂不可用';
      el.innerHTML=`<section class="customer-quote quote-share-error panel" role="alert"><p class="muted">客户报价</p><h1>报价暂不可用</h1><p>${L.esc(error.message)}</p><p class="muted">请联系为您提供链接的业务人员。</p></section>`;
    }
  }
  L.quoteShare=Object.freeze({url,render,encode,decode,normalize,snapshot});
})();
