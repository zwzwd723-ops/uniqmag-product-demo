(() => {
  'use strict';
  const L=window.Library,E=L.esc;
  const selectedVariants={};
  const entryBrands=[{id:'uniqmag',name:'UNIQMAG',logo:'assets/logo.png'},{id:'unico',name:'UNICO',logo:'assets/unico-logo.png'}];
  const entryBrandMarks=()=>`<div class="login-brands" aria-label="UNIQMAG / UNICO">${entryBrands.map(company=>`<img class="login-brand" src="${E(company.logo)}" alt="${E(company.name)}">`).join('<span aria-hidden="true"></span>')}</div>`;
  const productName=id=>L.state.products.find(p=>p.id===id)?.name||id;
  const invalid=el=>{L.selection.clear();el.innerHTML=`<div class="empty-state">${L.icon('lock')}<h2>此访问暂不可用</h2><p>邀请可能已过期、暂停、撤销或重置。请联系对接人员获取新的访问方式。</p><a class="btn primary" href="#/access">重新输入邀请码</a></div>`;};
  const inviteCheck=()=>{const i=L.currentInvite();if(!L.inviteValid(i))throw new Error('邀请已失效，请重新输入邀请码。');return i;};
  const swatch=v=>/^#[a-f0-9]{3,8}$/i.test(v?.swatch||'')?v.swatch:'#b8b8b8';
  function customerPrice(invite,productId,skuId){
    if(L.isStaff()||!invite||!L.customerPricing?.get)return {status:'none'};
    try{return L.customerPricing.get(invite,productId,skuId)||{status:'none'};}catch{return {status:'invalid'};}
  }
  function customerQuoteAvailable(invite){
    if(L.isStaff()||!invite||!L.customerPricing?.getQuote)return false;
    try{return Boolean(L.customerPricing.getQuote(invite));}catch{return false;}
  }
  function customerPriceContent(price,detail){
    if(price.status==='none')return '';
    const footer=detail&&['quoted','unquoted'].includes(price.status)?`<div class="customer-product-price-meta"><div><span>报价编号</span><b data-no-translate>${E(price.number)}</b></div><div><span>有效期至</span><b data-no-translate>${E(price.validUntil)}</b></div></div><button class="btn small" type="button" data-view-customer-quote>查看完整报价 ${L.icon('arrow')}</button>`:'';
    if(price.status!=='quoted'){
      const label=price.status==='unquoted'?'该配色暂未报价':price.status==='expired'?'报价已过有效期':'报价暂不可用';
      return `<div class="customer-product-price-empty"><strong>${label}</strong>${detail?'<span>请联系业务人员确认当前配色的报价。</span>':''}</div>${footer}`;
    }
    return `<div class="customer-product-price-heading"><span>报价信息</span><small><span>币种</span><b data-no-translate>${E(price.currency)}</b></small></div><dl class="customer-product-price-terms"><div><dt>单价</dt><dd data-no-translate>${E(price.unitPrice)}</dd></div><div><dt>报价数量</dt><dd data-no-translate>${E(price.quantity)}</dd></div><div><dt>小计</dt><dd data-no-translate>${E(price.amount)}</dd></div></dl>${footer}`;
  }
  function customerPriceHTML(invite,productId,skuId,detail=false){
    const price=customerPrice(invite,productId,skuId);
    return `<section class="customer-product-price ${detail?'customer-product-price-detail':''}" data-customer-pricing data-pricing-product="${E(productId)}" data-pricing-sku="${E(skuId)}" data-pricing-detail="${detail?'true':'false'}" data-pricing-status="${E(price.status)}" aria-label="当前配色报价" ${price.status==='none'?'hidden':''}>${customerPriceContent(price,detail)}</section>`;
  }
  function bindCustomerQuote(root,invite){
    root.querySelectorAll('[data-view-customer-quote]').forEach(button=>button.onclick=()=>{try{if(!customerQuoteAvailable(invite))throw new Error('这份报价暂不可用，请联系业务人员确认。');L.customerPricing.open(invite);}catch(error){L.toast(error.message);}});
  }
  function refreshCustomerPrices(root,invite){
    root.querySelectorAll('[data-customer-pricing]').forEach(panel=>{
      const price=customerPrice(invite,panel.dataset.pricingProduct,panel.dataset.pricingSku),content=customerPriceContent(price,panel.dataset.pricingDetail==='true');
      panel.hidden=price.status==='none';panel.dataset.pricingStatus=price.status;
      if(panel.innerHTML!==content){panel.innerHTML=content;bindCustomerQuote(panel,invite);}
    });
    root.querySelectorAll('[data-customer-quote-summary]').forEach(button=>button.hidden=!customerQuoteAvailable(invite));
  }
  function watchCustomerPrices(root,invite){
    if(L.isStaff())return;
    L.customerPricing?.watch?.(root,invite,()=>{refreshCustomerPrices(root,invite);watchCustomerPrices(root,invite);});
  }
  const countSelection=()=>new Set([...L.selection.values()].map(x=>x.productId)).size;
  function updateSelection(el){const bar=el.querySelector('.selection-tray');if(bar){bar.hidden=!L.selection.size;bar.querySelector('strong').textContent=`已选 ${countSelection()} 个型号 · ${L.selection.size} 个 SKU`;bar.querySelector('[data-export-selection]').disabled=!L.selection.size||!L.can('export');}const n=document.querySelector('#customer-selection b');if(n)n.textContent=L.selection.size||'';}
  function logRows(logs){return logs.length?logs.map(x=>`<div class="audit-row">${L.icon('clock')}<div><p>${E(x.action)} · ${E(x.target)}</p><small>${E(x.actor)} · ${new Date(x.time).toLocaleString('zh-CN')}</small></div></div>`).join(''):'<p class="muted" style="font-size:12px;padding:20px 0">还没有操作记录。保存产品、上传素材或创建邀请后，会显示在这里。</p>';}
  L.register('overview',{title:'产品资料库',banner:true,render:()=>L.go('products')});
  L.register('activity',{title:'操作记录',subtitle:'查看当前浏览器中产生的维护和下载记录。',render(el){el.innerHTML=`<div class="notice">${L.icon('info')}这里记录本机演示操作，不代表服务器访问统计或客户实名行为。</div><div class="toolbar"><input class="search-input" id="activity-search" placeholder="搜索操作、产品或操作者" aria-label="搜索操作记录"><span class="muted">${L.state.logs.length} 条记录</span></div><div class="panel" id="activity-list"></div>`;const draw=()=>{const q=el.querySelector('input').value.toLowerCase();el.querySelector('#activity-list').innerHTML=logRows(L.state.logs.filter(x=>[x.action,x.target,x.actor].join(' ').toLowerCase().includes(q)));};el.querySelector('input').oninput=draw;draw();}});
  function accessForm(code=''){
    return `<form id="access-form"><label class="field"><span>访问邀请码</span><input id="invite-code" name="code" value="${E(code)}" placeholder="请输入邀请码" autocomplete="off" spellcheck="false" required maxlength="80" aria-describedby="access-error"></label><p class="form-error" id="access-error" role="alert"></p><button type="submit" class="btn primary">进入资料库 ${L.icon('arrow')}</button></form>`;
  }
  function bindAccessForm(el,{onBusy=()=>{},companyHint}={}){
    const form=el.querySelector('#access-form'),input=form.querySelector('input'),error=form.querySelector('#access-error');let busy=false;
    const clearError=()=>{error.textContent='';input.removeAttribute('aria-invalid');};
    const showError=message=>{error.textContent=message;input.setAttribute('aria-invalid','true');input.focus();};
    input.addEventListener('input',clearError);
    el.querySelectorAll('[data-example]').forEach(b=>b.onclick=()=>{if(busy)return;input.value=L.state.invites.find(i=>i.id===b.dataset.example)?.code||'';clearError();});
    form.onsubmit=async event=>{
      event.preventDefault();if(busy)return;clearError();
      const value=input.value.trim();
      if(!value){showError('请输入邀请码。');return;}
      const button=form.querySelector('[type=submit]');
      busy=true;button.disabled=true;input.disabled=true;onBusy(true);form.setAttribute('aria-busy','true');
      try{
        const result=await L.loginCustomer(value,companyHint);
        if(!result?.redirecting&&form.isConnected)L.go('products');
      }catch(reason){showError(reason.message||'暂时无法保存访问状态，请重试。');}
      finally{busy=false;button.disabled=false;input.disabled=false;onBusy(false);form.removeAttribute('aria-busy');}
    };
  }
  L.register('login',{title:'登录',banner:true,render(el,params){
    const customer=params.has('code')||params.get('mode')!=='employee';
    el.innerHTML=`<section class="login-layout" aria-labelledby="login-title"><div class="login-panel">${entryBrandMarks()}<div class="login-heading"><h1 id="login-title">进入产品资料库</h1><p>UNIQMAG / UNICO 统一登录入口</p></div><div class="login-tabs" role="tablist" aria-label="登录方式"><button type="button" role="tab" id="login-customer-tab" data-login-tab="customer" aria-controls="login-customer-panel">客户访问</button><button type="button" role="tab" id="login-employee-tab" data-login-tab="employee" aria-controls="login-employee-panel">员工登录</button></div><div id="login-customer-panel" class="login-entry-form" role="tabpanel" aria-labelledby="login-customer-tab"><p class="login-form-description">输入邀请码，进入对应公司的产品资料库。</p>${accessForm(params.get('code')||'')}<p class="login-note">按邀请范围浏览，下载和导出需获授权。</p></div><div id="login-employee-panel" class="login-entry-form" role="tabpanel" aria-labelledby="login-employee-tab"><p class="login-form-description">使用员工账号登录，登录后选择公司主体。</p><form id="employee-login-form"><label class="field"><span>员工账号</span><input id="employee-account" name="account" type="text" placeholder="输入员工账号或工作邮箱" autocomplete="username" autocapitalize="none" spellcheck="false" required maxlength="180" aria-describedby="employee-login-error"></label><div class="field"><label for="employee-password">密码</label><div class="login-password"><input id="employee-password" name="password" type="password" placeholder="请输入密码" autocomplete="off" required maxlength="128" aria-describedby="employee-password-help employee-login-error"><button type="button" id="employee-password-toggle" aria-label="显示密码" aria-pressed="false" aria-controls="employee-password">显示</button></div><small id="employee-password-help" class="muted">当前使用演示密码，请勿输入真实密码。</small></div><p class="form-error" id="employee-login-error" role="alert"></p><button class="btn primary" type="submit">登录 ${L.icon('arrow')}</button></form><p class="login-note">员工身份与权限由管理员设置。</p><details class="login-demo-accounts"><summary>演示账号</summary><p data-no-translate>${(L.state.team||[]).filter(member=>['staff-admin','staff-business'].includes(member.id)&&member.status!=='disabled').map(member=>`<code>${E(member.login||'')}</code>`).join(' / ')}</p><p><span>演示密码：</span><code data-no-translate>demo2026</code></p><small>所有演示员工共用此密码，仅用于体验登录流程。</small></details></div><p class="login-demo-note">当前为在线演示，修改仅保存在当前浏览器。</p></div></section>`;
    const tabs=[...el.querySelectorAll('[data-login-tab]')];let busy=false;
    function setBusy(value){busy=value;tabs.forEach(tab=>tab.disabled=value);}
    function show(mode,focus=false){
      if(busy)return;
      tabs.forEach(tab=>{const selected=tab.dataset.loginTab===mode;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;el.querySelector('#login-'+tab.dataset.loginTab+'-panel').hidden=!selected;if(selected&&focus)tab.focus();});
    }
    tabs.forEach(tab=>{tab.onclick=()=>show(tab.dataset.loginTab);tab.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const mode=event.key==='Home'?'customer':event.key==='End'?'employee':tab.dataset.loginTab==='customer'?'employee':'customer';show(mode,true);};});
    bindAccessForm(el.querySelector('#login-customer-panel'),{onBusy:setBusy,companyHint:params.has('code')?params.get('company'):undefined});
    const form=el.querySelector('#employee-login-form'),input=el.querySelector('#employee-account'),password=el.querySelector('#employee-password'),toggle=el.querySelector('#employee-password-toggle'),error=el.querySelector('#employee-login-error'),submit=form.querySelector('[type="submit"]');
    const clearEmployeeError=()=>{error.textContent='';input.removeAttribute('aria-invalid');password.removeAttribute('aria-invalid');};
    input.oninput=clearEmployeeError;password.oninput=clearEmployeeError;
    toggle.onclick=()=>{const show=password.type==='password';password.type=show?'text':'password';toggle.textContent=show?'隐藏':'显示';toggle.setAttribute('aria-label',show?'隐藏密码':'显示密码');toggle.setAttribute('aria-pressed',String(show));};
    form.onsubmit=async event=>{
      event.preventDefault();if(busy)return;clearEmployeeError();
      if(!input.value.trim()){error.textContent='请输入员工账号或工作邮箱。';input.setAttribute('aria-invalid','true');input.focus();return;}
      if(!password.value){error.textContent='请输入密码。';password.setAttribute('aria-invalid','true');password.focus();return;}
      setBusy(true);submit.disabled=true;input.disabled=true;password.disabled=true;toggle.disabled=true;form.setAttribute('aria-busy','true');
      try{const result=await L.loginEmployee(input.value.trim(),password.value);password.value='';if(!result?.redirecting&&form.isConnected){L.go('workspaces');L.toast('员工登录成功。');}}
      catch(reason){error.textContent=reason.message||'暂时无法登录，请重试。';(String(reason.message).includes('密码')?password:input).setAttribute('aria-invalid','true');password.value='';}
      finally{setBusy(false);submit.disabled=false;input.disabled=false;password.disabled=false;toggle.disabled=false;form.removeAttribute('aria-busy');if(error.textContent)(password.getAttribute('aria-invalid')==='true'?password:input).focus();}
    };
    show(customer?'customer':'employee');
  }});
  L.register('workspaces',{title:'选择公司',banner:true,async render(el){
    if(!L.isStaff()){L.go('login?mode=employee');return;}
    el.innerHTML=`<section class="login-layout" aria-labelledby="workspace-title"><div class="login-panel workspace-panel">${entryBrandMarks()}<div class="login-heading"><h1 id="workspace-title">选择公司</h1><p>进入对应公司的产品资料库。</p></div><div class="workspace-options" aria-live="polite">正在读取可访问的公司…</div><p class="form-error" id="workspace-error" role="alert"></p><button class="btn" id="workspace-signout">退出登录</button><p class="login-demo-note">当前为在线演示，修改仅保存在当前浏览器。</p></div></section>`;
    const options=el.querySelector('.workspace-options'),error=el.querySelector('#workspace-error');
    el.querySelector('#workspace-signout').onclick=async()=>{if(await L.logout())L.go('login');};
    try{
      const companies=await L.employeeCompanies();
      if(!options.isConnected||!L.isStaff())return;
      options.innerHTML=companies.length?companies.map(company=>`<button class="workspace-option" data-workspace="${E(company.id)}" data-member-id="${E(company.memberId)}"><img src="${E(company.logo)}" alt="${E(company.name)}"><span><strong>${E(company.name)}</strong><small>${E(L.roleName(company.role))}</small></span>${L.icon('arrow')}</button>`).join(''):'<p class="muted">暂无可访问的公司，请联系管理员。</p>';
      options.querySelectorAll('[data-workspace]').forEach(button=>button.onclick=async()=>{
        options.querySelectorAll('button').forEach(item=>item.disabled=true);error.textContent='';
        try{const switching=await L.switchCompany(button.dataset.workspace,button.dataset.memberId);if(!switching&&options.isConnected)L.go('products');}
        catch(reason){error.textContent=reason.message||'暂时无法进入，请重试。';options.querySelectorAll('button').forEach(item=>item.disabled=false);}
      });
    }catch(reason){if(options.isConnected){options.textContent='';error.textContent=reason.message||'暂时无法读取公司，请重试。';}}
  }});
  L.register('access',{title:'客户访问',banner:true,render(el,params){
    const query=new URLSearchParams(params);query.set('mode','customer');L.go('login?'+query.toString());
  }});

  const productStatus=p=>({published:'已发布',draft:'草稿',review:'待发布',archived:'已下架'}[p.status]||'草稿');
  const staffSelectable=(p,v)=>p.status==='published'&&p.isLive&&!!p.liveSnapshot?.variants?.some(x=>x.id===v?.id);
  const productBrandMark=(p,className)=>{const brand=L.productBrand(p);return brand&&(L.companyId()!=='uniqmag'||brand.id!=='uniqmag')?L.brandMark(p,{className}):'';};
  L.renderCollection=(el)=>{
    const staff=L.isStaff(),invite=staff?null:L.currentInvite();if(!staff&&!L.inviteValid(invite)){invalid(el);return;}
    let category='',brand='',query='',status='';const products=staff?L.state.products:L.liveProducts(invite);
    const visibleCategories=L.getCategories().filter(c=>staff||products.some(p=>L.categoryKey(p)===c.id));
    const visibleBrands=L.productBrands(products),showBrands=products.length>0&&(L.companyId()==='unico'||visibleBrands.length>1);
    for(const [id,selection] of L.selection){const p=products.find(p=>p.id===selection.productId),v=p?.variants?.find(v=>v.id===selection.skuId);if(!v||(staff&&!staffSelectable(p,v)))L.selection.delete(id);}
    const canExport=staff?L.can('export'):L.hasInvitePermission(invite,'export'),canDownload=staff||L.hasInvitePermission(invite,'download');
    if(!canExport)L.selection.clear();
    const accessLabel=canExport||canDownload?'可浏览'+(canDownload?' · 可下载素材':'')+(canExport?' · 可导出表格':''):'仅浏览产品与素材';
    el.innerHTML=L.pageBanner({eyebrow:L.company().name+' COLLECTION',title:'产品资料库',description:'浏览产品规格、配色与素材，整理所需的产品资料。',actions:staff?`<button class="btn primary" id="portal-export" ${!canExport?'disabled':''}>${L.icon('template')}导出表格</button><button class="btn" id="collection-quote">${L.icon('template')}创建报价</button><button class="btn" id="collection-new">＋ 新增产品</button><button class="btn" id="collection-import">导入 Excel</button><button class="btn" id="collection-backup">产品资料备份</button>`:`${canExport?`<button class="btn primary" id="portal-export">${L.icon('template')}导出表格</button>`:''}<button class="btn" data-view-customer-quote data-customer-quote-summary ${customerQuoteAvailable(invite)?'':'hidden'}>查看完整报价</button>`,aside:`<div class="workspace-banner-stats"><div><strong>${products.length}</strong><span>产品型号</span></div><div><strong>${products.reduce((n,p)=>n+(p.variants||[]).length,0)}</strong><span>颜色 / SKU</span></div></div>`})+
      `${!staff?`<div class="collection-access-note"><span>${E(invite.company)} · ${E(invite.name)} · 有效期至 ${L.date(invite.expiresAt)}</span><span class="badge">${E(accessLabel)}</span></div>`:''}<section class="panel collection-filters" aria-label="产品筛选">${showBrands?'<div class="collection-brand-section"><div class="collection-filter-heading"><h2>产品品牌</h2></div><div id="portal-brand-chips" class="portal-brand-chips" role="group" aria-label="按产品品牌筛选"></div></div>':''}<div class="collection-filter-heading"><h2>产品类型</h2>${staff&&L.can('categories')?'<button class="btn small" id="collection-categories">管理分类</button>':''}</div><div id="portal-category-chips" class="portal-category-chips" role="group" aria-label="按产品类型筛选"></div><div class="toolbar collection-search"><input class="search-input" id="portal-search" placeholder="搜索型号、配色、SKU 或规格" aria-label="搜索产品">${staff?'<select id="collection-status" aria-label="发布状态"><option value="">全部状态</option><option value="published">已发布</option><option value="draft">草稿</option><option value="review">待发布</option><option value="archived">已下架</option></select>':''}<button class="btn" id="collection-reset" disabled>清空筛选</button></div><div class="collection-results"><small class="muted" id="portal-count" aria-live="polite"></small>${staff?'<small class="muted">可直接编辑；导出仅使用已发布资料</small>':''}</div></section><div class="collection-grid" id="portal-grid"></div>${canExport?`<div class="selection-tray" hidden><div><strong></strong><small>勾选所需配色，按模板导出产品资料</small></div><div class="row-actions"><button class="btn small" id="clear-selection">清空</button>${staff?'<button class="btn" data-quote-selection>创建报价</button>':''}<button class="btn primary" data-export-selection>${L.icon('download')}按模板导出</button></div></div>`:''}`;
    function draw(){
      const scope=products.filter(p=>(!status||p.status===status)&&[p.name,p.type,p.description,L.productBrand(p)?.name||'',...(p.tags||[]),...(p.variants||[]).flatMap(v=>[v.sku,v.color,v.colorLabel]),...(p.specs||[]).map(s=>s.value)].join(' ').toLowerCase().includes(query));
      const brandScope=scope.filter(p=>!brand||brand===L.brandKey(p)),results=brandScope.filter(p=>!category||category===L.categoryKey(p));
      if(showBrands){
        const counts=scope.filter(p=>!category||category===L.categoryKey(p));
        el.querySelector('#portal-brand-chips').innerHTML=[{id:'',name:'全部品牌'},...visibleBrands].map(item=>{
          const count=item.id?counts.filter(p=>L.brandKey(p)===item.id).length:counts.length;
          const mark=item.logo?L.brandMark({brand:item.name},{className:'brand-filter-logo'}):'<span class="brand-filter-name">'+E(item.name)+'</span>';
          return `<button type="button" class="brand-filter-chip ${item.id===brand?'active':''}" data-brand-filter="${E(item.id)}" aria-pressed="${item.id===brand}" aria-label="${E(item.name)}，${count} 个产品型号">${mark}<span class="brand-filter-count" aria-hidden="true">${count}</span></button>`;
        }).join('');
        el.querySelectorAll('[data-brand-filter]').forEach(button=>button.onclick=()=>{brand=button.dataset.brandFilter;draw();el.querySelectorAll('[data-brand-filter]').forEach(next=>{if(next.dataset.brandFilter===brand)next.focus({preventScroll:true});});});
      }
      el.querySelector('#portal-category-chips').innerHTML=[{id:'',name:'全部产品'},...visibleCategories].map(c=>`<button class="filter-chip ${c.id===category?'active':''}" data-filter="${E(c.id)}" aria-pressed="${c.id===category}">${E(c.name)} <span>${c.id?brandScope.filter(p=>L.categoryKey(p)===c.id).length:brandScope.length}</span></button>`).join('');
      el.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{category=b.dataset.filter;draw();el.querySelectorAll('[data-filter]').forEach(next=>{if(next.dataset.filter===category)next.focus({preventScroll:true});});});
      el.querySelector('#portal-count').textContent=`${results.length} 个产品型号${brand?' · '+(visibleBrands.find(item=>item.id===brand)?.name||''):''}${category?' · '+L.categoryName(category):''}`;
      el.querySelector('#collection-reset').disabled=!(category||brand||query||status);
      const grid=el.querySelector('#portal-grid');grid.innerHTML=results.map(p=>{
        const brandMark=productBrandMark(p,'collection-brand-mark'),productBrand=L.productBrand(p),brandNames=['UNIQMAG','UNICO','NEOCADE','BLAZEPRO',...(brandMark&&productBrand?[productBrand.name,productBrand.id]:[])].map(name=>name.toLowerCase().replace(/\s+/g,''));
        const visibleTags=(p.tags||[]).filter(tag=>!brandNames.includes(String(tag).toLowerCase().replace(/\s+/g,'')));
        const v=p.variants?.find(v=>v.id===selectedVariants[p.id])||p.variants?.[0],selectable=!!v&&(!staff||staffSelectable(p,v)),detail='#/product?id='+encodeURIComponent(p.id)+(v?'&sku='+encodeURIComponent(v.id):'');
        return `<article class="collection-card" data-product-card="${E(p.id)}">${canExport?`<label class="card-check" title="${selectable?'选择当前配色':'发布后可选择导出'}"><input type="checkbox" data-select="${E(p.id)}" data-sku="${E(v?.id||'')}" aria-label="选择 ${E(p.name)} ${E(v?.colorLabel||v?.color||'')}" ${!selectable?'disabled':''} ${selectable&&L.selection.has(v.id)?'checked':''}></label>`:''}<a class="collection-photo" href="${detail}"><span class="collection-watermark">${E(p.name)}</span>${L.image(v?.images?.[0],p.name+' '+(v?.colorLabel||v?.color||''))}<span class="collection-kind">${E(L.categoryName(p))}</span></a><div class="collection-body"><div class="collection-card-heading"><div class="collection-model-brand"><a href="${detail}"><h2>${E(p.name)}</h2></a>${brandMark}</div>${staff?`<span class="badge">${productStatus(p)}</span>`:''}</div><p>${E(p.type)}</p><div class="collection-tags">${visibleTags.slice(0,3).map(t=>`<span>${E(t)}</span>`).join('')}</div><div class="collection-bottom"><div class="swatches">${(p.variants||[]).map(variant=>`<button class="swatch ${variant.id===v?.id?'active':''}" style="--swatch:${swatch(variant)}" data-color="${E(variant.id)}" data-product="${E(p.id)}" aria-label="${E(p.name+' '+(variant.colorLabel||variant.color||'待补充配色'))}" aria-pressed="${variant.id===v?.id}"></button>`).join('')}</div><small>${E(v?.sku||'货号待补充')}</small></div>${staff?'':customerPriceHTML(invite,p.id,v?.id||'')}${staff?`<div class="collection-card-actions"><a class="btn small" href="${detail}&edit=basic" data-edit-card="${E(p.id)}">${L.icon('edit')}编辑产品</a><a class="btn small" href="#/downloads?product=${encodeURIComponent(p.id)}" data-product-download="${E(p.id)}">${L.icon('download')}资料下载</a></div>`:canDownload?`<div class="collection-card-actions"><a class="btn small" href="${detail}&tab=assets">${L.icon('download')}素材下载</a></div>`:''}</div></article>`;
      }).join('')||(products.length?'<div class="empty-state collection-empty"><h2>当前筛选下没有产品</h2><p>调整品牌、产品类型或搜索内容，再试一次。</p><button class="btn" id="portal-reset">清空筛选</button></div>':`<div class="empty-state collection-empty"><h2>${staff?'还没有产品资料':'暂无可浏览的产品'}</h2><p>${staff?'可以新增产品，也可以导入现有 Excel。':'请联系业务人员确认产品授权范围。'}</p>${staff?'<button class="btn" id="collection-empty-new">新增产品</button>':''}</div>`);
      bindCustomerQuote(el,invite);
      grid.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{selectedVariants[b.dataset.product]=b.dataset.color;draw();});
      grid.querySelectorAll('[data-select]').forEach(input=>input.onchange=()=>{if(!staff){try{L.requireInvitePermission(invite,'export');}catch(error){input.checked=false;L.selection.clear();L.toast(error.message);L.render();return;}}input.checked?L.selection.set(input.dataset.sku,{productId:input.dataset.select,skuId:input.dataset.sku}):L.selection.delete(input.dataset.sku);updateSelection(el);});
      grid.querySelector('#portal-reset')?.addEventListener('click',reset);grid.querySelector('#collection-empty-new')?.addEventListener('click',()=>L.go('editor'));updateSelection(el);
    }
    function reset(){category='';brand='';query='';status='';el.querySelector('#portal-search').value='';if(staff)el.querySelector('#collection-status').value='';draw();}
    el.querySelector('#portal-search').oninput=e=>{query=e.target.value.trim().toLowerCase();draw();};el.querySelector('#collection-status')?.addEventListener('change',e=>{status=e.target.value;draw();});el.querySelector('#collection-reset').onclick=reset;
    el.querySelector('#clear-selection')?.addEventListener('click',()=>{L.selection.clear();draw();});const exportSelected=()=>{try{const current=staff?null:L.requireInvitePermission(invite,'export');if(!L.selection.size){L.go('exports');return;}L.openExport([...L.selection.values()],current);}catch(error){L.toast(error.message);L.render();}};
    el.querySelector('#portal-export')?.addEventListener('click',exportSelected);el.querySelector('[data-export-selection]')?.addEventListener('click',exportSelected);
    const quoteSelected=()=>{try{L.openQuotation([...L.selection.values()]);}catch(error){L.toast(error.message);}};el.querySelector('#collection-quote')?.addEventListener('click',quoteSelected);el.querySelector('[data-quote-selection]')?.addEventListener('click',quoteSelected);
    el.querySelector('#collection-new')?.addEventListener('click',()=>L.go('editor'));el.querySelector('#collection-import')?.addEventListener('click',()=>L.openProductImport());el.querySelector('#collection-backup')?.addEventListener('click',()=>L.openProductBackup());el.querySelector('#collection-categories')?.addEventListener('click',()=>L.openCategoryManager());draw();watchCustomerPrices(el,invite);
  };
  L.register('portal',{title:'产品资料库',banner:true,render:el=>L.renderCollection(el)});
  L.register('product',{title:'产品详情',banner:true,render(el,params){
    const staff=L.isStaff(),invite=staff?null:L.currentInvite();if(!staff&&!L.inviteValid(invite)){invalid(el);return;}
    const p=(staff?L.state.products:L.liveProducts(invite)).find(p=>p.id===params.get('id'));if(!p){el.innerHTML='<div class="empty-state"><h2>产品不可用或未获授权</h2><a class="btn primary" href="#/products">返回资料库</a></div>';return;}
    let v=p.variants?.find(v=>v.id===params.get('sku'))||p.variants?.[0];if(!v){el.innerHTML=`<div class="empty-state"><h2>此产品尚未添加配色</h2>${staff?`<a class="btn" href="#/editor?id=${encodeURIComponent(p.id)}">编辑产品</a>`:''}</div>`;return;}
    const tabs=[['overview','产品概览'],['specs','完整规格'],['packaging','包装资料'],['details','详情图库'],['assets',staff||L.hasInvitePermission(invite,'download')?'素材与下载':'素材浏览']];let tab=tabs.some(([id])=>id===params.get('tab'))?params.get('tab'):'overview',imageIndex=0;
    const canExport=staff?L.can('export'):L.hasInvitePermission(invite,'export'),canDownload=staff||L.hasInvitePermission(invite,'download');
    function remember(){history.replaceState(null,'',L.routeURL(`#/product?id=${encodeURIComponent(p.id)}&sku=${encodeURIComponent(v.id)}&tab=${tab}`));}
    function finishEditing(){L.isDirty=null;remember();L.render();}
    function edit(section){if(!L.can('edit'))return;remember();const editorParams=new URLSearchParams({id:p.id,tab:section});if(section==='details')L.renderDetailEditor(el,editorParams,{onDone:finishEditing,onCancel:finishEditing});else L.renderProductEditor(el,editorParams,{onDone:finishEditing,onCancel:finishEditing});}
    function draw(){
      const selectable=staff?staffSelectable(p,v):true;
      el.innerHTML=`<div class="product-context-bar"><a class="btn small" href="#/products">${L.icon('back')}返回产品资料库</a>${staff?`<div class="row-actions"><span class="badge">${productStatus(p)}</span>${p.status!=='published'?'<small class="muted">修改发布后才更新客户资料</small>':''}<button class="btn small" id="product-print">${L.icon('print')}打印产品资料</button><button class="btn small" data-edit-product="basic">${L.icon('edit')}编辑产品</button>${p.isLive?'<button class="btn small" id="product-unpublish">下架产品</button>':''}</div>`:''}</div><section class="product-hero"><div class="product-gallery">${L.image(v.images?.[imageIndex],p.name+' '+(v.colorLabel||v.color))}<div class="product-thumbs">${(v.images||[]).map((img,index)=>`<button data-thumb="${index}" class="${index===imageIndex?'active':''}" aria-label="查看图片 ${index+1}">${L.image(img,'产品图片 '+(index+1))}</button>`).join('')}</div>${staff?'<button class="btn small product-edit-images" data-edit-product="variants">编辑配色与图片</button>':''}</div><div class="product-description"><div class="product-brand-heading">${productBrandMark(p,'product-detail-brand')}<span class="badge">${E(L.categoryName(p))}</span></div><h2>${E(p.name)}</h2><h3>${E(p.type)}</h3><p>${E(p.description)}</p><small class="muted">选择配色 / SKU</small><div class="variant-buttons">${p.variants.map(variant=>`<button data-variant="${E(variant.id)}" class="${variant.id===v.id?'active':''}" aria-pressed="${variant.id===v.id}"><i style="--swatch:${swatch(variant)}"></i>${E(variant.colorLabel||variant.color||'配色待补充')}</button>`).join('')}</div><div class="sku-line">货号 ${E(v.sku||'未提供')} · ${(v.images||[]).length} 张产品图片</div>${staff?'':customerPriceHTML(invite,p.id,v.id,true)}${staff||canExport||canDownload?`<div class="row-actions">${canExport?`<button class="btn primary" id="select-current" ${!selectable?'disabled':''}>${L.icon(L.selection.has(v.id)?'check':'plus')}${L.selection.has(v.id)?'已加入导出清单':'选择此配色'}</button><button class="btn" id="export-current" ${!(staff?selectable:canExport)?'disabled':''}>${L.icon('template')}导出当前 SKU</button>`:''}${staff?`<button class="btn" id="product-create-quote" ${!selectable?'disabled':''}>${L.icon('template')}创建报价</button><a class="btn" id="product-download-assets" href="#/downloads?product=${encodeURIComponent(p.id)}">${L.icon('download')}资料下载</a>`:canDownload?`<button class="btn" id="customer-download-assets">${L.icon('download')}素材下载</button>`:''}</div>`:''}${staff&&!selectable?'<p class="muted">发布产品后即可选择和导出此配色。</p>':''}</div></section><div class="panel"><div class="tabs">${tabs.map(([id,name])=>`<button data-tab="${id}" class="${tab===id?'active':''}" aria-selected="${tab===id}">${name}</button>`).join('')}</div>${staff?`<div class="product-section-actions">${tab==='assets'?'<button class="btn small" id="product-upload-asset">＋ 上传素材</button>':`<button class="btn small" data-edit-product="${{overview:'basic',specs:'specs',packaging:'packaging',details:'details'}[tab]}">${L.icon('edit')}${{overview:'编辑基本资料',specs:'编辑规格',packaging:'编辑包装资料',details:'编辑详情图库'}[tab]}</button>`}</div>`:''}<div id="product-panel"></div></div>`;
      bindCustomerQuote(el,invite);
      el.querySelectorAll('[data-edit-product]').forEach(button=>button.onclick=()=>edit(button.dataset.editProduct));
      el.querySelector('#customer-download-assets')?.addEventListener('click',()=>{tab='assets';remember();draw();});
      el.querySelector('#product-create-quote')?.addEventListener('click',()=>{try{L.openQuotation([{productId:p.id,skuId:v.id}]);}catch(error){L.toast(error.message);}});
      el.querySelector('#product-print')?.addEventListener('click',()=>L.openProductPrint(p.id,v.id));
      el.querySelector('#product-unpublish')?.addEventListener('click',()=>L.withdrawProduct(p.id,()=>L.render()));
      el.querySelector('#product-upload-asset')?.addEventListener('click',()=>L.openAssetUpload({productId:p.id,onDone:draw}));
      el.querySelectorAll('[data-variant]').forEach(b=>b.onclick=()=>{v=p.variants.find(x=>x.id===b.dataset.variant);imageIndex=0;remember();draw();});el.querySelectorAll('[data-thumb]').forEach(b=>b.onclick=()=>{imageIndex=Number(b.dataset.thumb);draw();});el.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;remember();draw();});
      el.querySelector('#select-current')?.addEventListener('click',()=>{try{if(!staff)L.requireInvitePermission(invite,'export');else if(!staffSelectable(p,v))return;L.selection.has(v.id)?L.selection.delete(v.id):L.selection.set(v.id,{productId:p.id,skuId:v.id});draw();const n=document.querySelector('#customer-selection b');if(n)n.textContent=L.selection.size||'';}catch(error){L.toast(error.message);L.go('access');}});
      el.querySelector('#export-current')?.addEventListener('click',()=>{try{L.openExport([{productId:p.id,skuId:v.id}],staff?null:L.requireInvitePermission(invite,'export'));}catch(error){L.toast(error.message);}});
      const panel=el.querySelector('#product-panel');
      if(tab==='overview'||tab==='specs'){const specs=tab==='overview'?p.specs.slice(0,8):p.specs;panel.innerHTML=`<div class="section-title"><h2>${tab==='overview'?'关键规格':'完整技术规格'}</h2><span class="muted" style="font-size:10px">缺项保留，待确认参数已标注</span></div><div class="spec-list">${specs.map(spec=>`<div class="spec-item"><span>${E(spec.label||spec.key)}</span><strong>${E(spec.value??'未提供')} ${spec.pending?'<span class="badge">待确认</span>':''}</strong></div>`).join('')}</div>`;}
      else if(tab==='packaging'){const packs=p.packaging.filter(a=>!a.appliesTo||a.appliesTo===v.id||a.appliesTo===v.sku);panel.innerHTML=`<p class="muted" style="font-size:12px;margin-bottom:18px">当前配色：${E(v.colorLabel||v.color||'未提供')}；仅显示适用的包装。</p><div class="pack-cards">${packs.map(a=>`<article><h3>${E(a.title)} ${a.pending?'<span class="badge">待确认</span>':''}</h3>${a.appliesTo?`<span class="badge">仅适用于 ${E(a.appliesTo)}</span>`:''}<pre>${E(a.text)}</pre>${a.image?L.image(a.image,p.name+' '+a.title):''}</article>`).join('')}</div>`;}
      else if(tab==='details'){const accessible=staff?null:L.portalAssets(invite,p.id,v.id),details=(p.details||[]).filter(d=>staff||!d.assetId||accessible.some(a=>a.id===d.assetId));panel.innerHTML=details.length?`<div class="detail-images">${details.map(d=>`<figure>${L.image(d.assetId?L.state.assets.find(a=>a.id===d.assetId)?.url:d.url,d.caption||p.name+' 详情图')}<figcaption>${E(d.caption||'')}</figcaption></figure>`).join('')}</div>`:`<div class="empty-state">${L.icon('image')}<h2>${staff?'还没有详情图':'暂无获授权的详情图'}</h2><p>${staff?'点击“编辑详情图库”添加和整理产品长图。':'请联系业务人员补充所需资料。'}</p></div>`;}
      else renderAssets(panel,p,v,invite,staff);
    }
    const requested=params.get('edit');if(staff&&['basic','specs','variants','packaging','details'].includes(requested))edit(requested);else draw();watchCustomerPrices(el,invite);
  }});
  function renderAssets(panel,p,v,invite,preview){const assets=preview?L.state.assets.filter(a=>(a.productIds||[]).includes(p.id)&&a.status!=='archived'):L.portalAssets(invite,p.id,v.id);const allow=preview?L.isStaff():L.hasInvitePermission(invite,'download');panel.innerHTML=`<div class="toolbar"><div><h3 style="font-size:15px">${assets.length} 份可浏览素材</h3><p class="muted" style="font-size:11px">${allow?'可预览、下载或打包当前产品获授权的素材。':'可在线预览当前产品素材；此邀请未允许素材下载。'}</p></div>${allow?`<button class="btn" id="asset-bundle">${L.icon('download')}打包下载已选素材</button>`:'<span class="badge">客户仅浏览</span>'}</div>${assets.length?`<div class="asset-grid">${assets.map(a=>{const canDownload=allow&&a.downloadable!==false;return `<article class="portal-asset" data-asset-card="${E(a.id)}"><button class="portal-asset-thumb" data-asset-preview="${E(a.id)}" aria-label="预览 ${E(a.name)}">${a.type==='image'?L.image(a.url,a.name):`<span class="image-placeholder">${L.icon(a.type==='video'?'eye':'file')}<span>${E(a.type==='video'?'视频':'文档')}</span></span>`}</button><div>${canDownload?`<label class="check-row"><input type="checkbox" data-file="${E(a.id)}"><h3>${E(a.name)}</h3></label>`:`<h3>${E(a.name)}</h3>`}<small>${E(a.language||'通用')} · ${L.size(a.size)} · v${E(a.version||1)}${canDownload?'':' · 仅浏览'}</small><div class="row-actions">${preview?`<button class="btn small" data-inline-asset-edit="${E(a.id)}">${L.icon('edit')}编辑素材</button>`:''}<button class="btn small" data-asset-preview="${E(a.id)}">${L.icon('eye')}在线预览</button>${canDownload?`<button class="btn small" data-download="${E(a.id)}">${L.icon('download')}下载文件</button>`:''}</div></div></article>`;}).join('')}</div>`:'<div class="empty-state"><h2>暂无可用素材</h2><p>该配色的素材尚未提供或尚未获授权。</p></div>'}`;
    panel.querySelectorAll('[data-asset-preview]').forEach(b=>b.onclick=()=>previewAsset(b.dataset.assetPreview,p.id,v.id,preview));
    panel.querySelectorAll('[data-inline-asset-edit]').forEach(b=>b.onclick=()=>{if(!L.can('upload'))return;L.openAssetEditor(b.dataset.inlineAssetEdit);document.querySelector('dialog.library-dialog')?.addEventListener('close',()=>{if(panel.isConnected)renderAssets(panel,p,v,invite,preview);},{once:true});});
    function permitted(ids){
      let available;
      if(preview){if(!L.isStaff())throw new Error('当前身份已改变，请重新打开产品资料。');available=L.state.assets.filter(a=>a.status!=='archived'&&(a.productIds||[]).includes(p.id));}
      else{const current=L.requireInvitePermission(invite,'download');available=L.portalAssets(current,p.id,v.id);}
      const result=available.filter(a=>ids.includes(a.id)&&a.downloadable!==false);
      if(new Set(ids).size!==ids.length||result.length!==ids.length)throw new Error('部分素材已不可用或未获下载授权，请刷新后重试。');
      return result;
    }
    const downloadAuthorization=()=>preview?undefined:{invite,action:'download'};
    const revision=asset=>JSON.stringify([asset.id,asset.url,asset.originalUrl,asset.version,asset.size,asset.originalSize,asset.updatedAt]);
    const snapshotAssets=ids=>permitted(ids).map(asset=>({asset:{...asset},revision:revision(asset)}));
    function recheck(snapshots){const current=permitted(snapshots.map(item=>item.asset.id));for(const item of snapshots){if(revision(current.find(asset=>asset.id===item.asset.id))!==item.revision)throw new Error('素材已更新，请重新选择下载。');}}
    async function readAsset(asset){const url=L.safeURL(asset.originalUrl||asset.url);if(!url)throw new Error('素材文件地址不可用。');const response=await fetch(url);if(!response.ok)throw new Error('素材读取失败：'+asset.name);return response;}
    panel.querySelectorAll('[data-download]').forEach(button=>button.onclick=async()=>{
      button.disabled=true;
      try{const snapshots=snapshotAssets([button.dataset.download]),asset=snapshots[0].asset;const response=await readAsset(asset),blob=await response.blob();recheck(snapshots);L.download(blob,asset.name,downloadAuthorization());L.log('下载素材',asset.name);await L.save();L.toast('文件已准备下载');}
      catch(error){L.toast(error.message);}finally{button.disabled=false;}
    });
    const bundle=panel.querySelector('#asset-bundle');if(bundle)bundle.onclick=async()=>{
      const ids=[...panel.querySelectorAll('[data-file]:checked')].map(input=>input.dataset.file);if(!ids.length){L.toast('请先勾选需要打包的素材。');return;}
      bundle.disabled=true;bundle.textContent='正在整理文件…';
      try{
        const snapshots=snapshotAssets(ids),zip=new JSZip();
        for(let index=0;index<snapshots.length;index++){recheck(snapshots);const asset=snapshots[index].asset,response=await readAsset(asset);zip.file(String(index+1).padStart(2,'0')+'_'+asset.name.replace(/[<>:"/\\|?*]/g,'_'),await response.arrayBuffer());}
        const blob=await zip.generateAsync({type:'blob'});recheck(snapshots);L.download(blob,`${L.company().name}_${p.name}_${v.sku||'配色素材'}.zip`,downloadAuthorization());L.log('打包下载',p.name+' · '+snapshots.length+' 份素材');await L.save();L.toast('素材包已准备下载');
      }catch(error){L.toast(error.message);}finally{bundle.disabled=false;bundle.innerHTML=L.icon('download')+'打包下载已选素材';}
    };
  }
  function previewAsset(assetId,productId,skuId,internal){
    function current(){if(internal){if(!L.can('edit'))throw new Error('当前角色没有预览权限。');const a=L.state.assets.find(a=>a.id===assetId&&a.status!=='archived'&&(a.productIds||[]).includes(productId));if(a)return a;}else{const a=L.portalAssets(inviteCheck(),productId,skuId).find(a=>a.id===assetId);if(a)return a;}throw new Error('此素材已不可用或未获授权，请关闭预览后重新选择。');}
    let initial;try{initial=current();}catch(e){L.toast(e.message);return;}
    const dialog=L.modal('在线预览 · '+initial.name,'<div class="portal-preview" id="portal-preview-content"></div>',{wide:true});const body=dialog.querySelector('#portal-preview-content');let key='',timer;
    const paint=()=>{if(!dialog.isConnected||!dialog.open)return;let a;try{a=current();}catch(e){body.innerHTML=`<div class="empty-state"><h2>预览已停止</h2><p>${E(e.message)}</p></div>`;return;}
      const next=JSON.stringify([a.id,a.name,a.url,a.type,a.mime,a.version]);if(key!==next){key=next;const url=L.safeURL(a.url),ext=a.name.split('.').pop().toLowerCase();body.innerHTML=`<p class="portal-preview-meta">${E(a.name)} · v${E(a.version||1)} · 在线预览</p><div class="portal-preview-media" id="portal-preview-media"></div>`;const media=body.querySelector('#portal-preview-media');
        if(a.type==='image')media.innerHTML=L.image(url,a.name);
        else if(a.type==='video'&&url)media.innerHTML=`<video controls controlslist="nodownload" disablepictureinpicture preload="metadata" src="${E(url)}" aria-label="${E(a.name)}"></video>`;
        else if(['txt','csv'].includes(ext)&&url){media.textContent='正在读取文本…';fetch(url).then(r=>{if(!r.ok)throw new Error('读取失败');return r.text();}).then(text=>{if(!dialog.isConnected||key!==next)return;current();media.innerHTML=`<pre>${E(text.slice(0,200000))}</pre>${text.length>200000?'<p class="muted">内容较长，当前预览前 200,000 个字符。</p>':''}`;}).catch(()=>{if(dialog.isConnected&&key===next)media.textContent='此文本暂时无法预览，请联系对接人员。';});}
        else media.innerHTML=`<div class="empty-state">${L.icon('file')}<h2>此格式暂不支持在线预览</h2><p>请联系对接人员提供图片或文本预览版本。</p></div>`;
      }timer=setTimeout(paint,1000);
    };dialog.addEventListener('close',()=>{clearTimeout(timer);dialog.querySelector('video')?.pause();},{once:true});paint();
  }
  setInterval(()=>{if(L.ready&&!L.isStaff()&&['products','portal','product'].includes(L.route)&&!L.inviteValid(L.currentInvite()))L.render();},20000);
})();
