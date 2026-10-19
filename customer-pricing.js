/* Customer-specific display prices come only from the active invitation. */
(() => {
  'use strict';
  const L=window.Library,watchers=new WeakMap();
  function resolve(invite){
    if(L.isStaff())return {status:'none'};
    const current=L.currentInvite();
    if(!current||!invite||current.id!==invite.id||current.code!==invite.code||!L.inviteValid(current))return {status:'invalid'};
    if(!current.quotation)return {status:'none'};
    try{
      const quotation=L.inviteQuote.normalize(current.quotation,{companyId:L.companyId(),productIds:current.productIds});
      const expiresAt=Math.min(Date.parse(current.expiresAt),Date.parse(quotation.validUntil+'T23:59:59.999+08:00'));
      if(!Number.isFinite(expiresAt)||expiresAt<=Date.now())return {status:'expired'};
      const products=L.liveProducts(current);
      if(quotation.lines.some(line=>!products.some(product=>product.id===line.productId&&product.variants?.some(variant=>variant.id===line.skuId))))return {status:'invalid'};
      return {status:'quoted',quotation,expiresAt,current};
    }catch{return {status:'invalid'};}
  }
  function get(invite,productId,skuId){
    const state=resolve(invite);
    if(state.status!=='quoted')return {status:state.status};
    const {quotation:q}=state,line=q.lines.find(item=>item.productId===productId&&item.skuId===skuId);
    const metadata={currency:q.currency,number:q.number,validUntil:q.validUntil};
    if(!line)return {status:'unquoted',...metadata};
    const [whole,fraction]=line.unitPrice.split('.'),cents=BigInt(whole)*100n+BigInt(fraction);
    return {status:'quoted',...metadata,unitPrice:line.unitPrice,quantity:line.quantity,amount:L.inviteQuote.money(cents*BigInt(line.quantity))};
  }
  function getQuote(invite){return resolve(invite).quotation||null;}
  function watch(el,invite,onChange){
    watchers.get(el)?.();
    let timer,stopped=false;
    const route=L.route,companyId=L.companyId();
    const signature=state=>JSON.stringify([state.status,state.current?.id,state.current?.code,state.quotation]);
    const initial=signature(resolve(invite));
    const stop=()=>{stopped=true;clearTimeout(timer);if(watchers.get(el)===stop)watchers.delete(el);};
    watchers.set(el,stop);
    const check=()=>{
      if(stopped||!el.isConnected||L.route!==route||L.companyId()!==companyId){stop();return;}
      const state=resolve(invite);
      if(signature(state)!==initial){stop();onChange();return;}
      timer=setTimeout(check,Math.max(1,Math.min(60000,(state.expiresAt||Date.now()+60000)-Date.now()+20)));
    };
    check();return stop;
  }
  function open(invite){
    const state=resolve(invite);
    if(state.status!=='quoted')throw new Error(state.status==='expired'?'报价已过有效期，请联系业务人员确认。':'暂无有效的客户报价，请联系业务人员。');
    const dialog=L.modal('我的报价','<div data-customer-quotation></div>',{wide:true});
    const root=dialog.querySelector('[data-customer-quotation]');
    const envelope={companyId:L.companyId(),customer:state.current.company,contact:state.current.contact||'',quotation:state.quotation};
    L.inviteQuote.renderReadOnly(root,envelope);
    watch(root,invite,()=>{root.innerHTML='<div class="empty-state"><h2>报价暂不可用</h2><p>报价或访问状态已变化，请关闭后重新查看。</p></div>';});
    return dialog;
  }
  L.customerPricing=Object.freeze({get,getQuote,open,watch});
})();
