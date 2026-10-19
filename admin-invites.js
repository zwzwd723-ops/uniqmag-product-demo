/* Browser-local invitation and team management. Production authentication is not implemented here. */
(() => {
  'use strict';
  const L = window.Library;
  const companyId = () => L.companyId?.() || 'uniqmag';
  const e = value => L.esc(value == null ? '' : value);
  const filters = { query: '', status: 'all' };
  const roles = { admin: '管理员', business: '业务人员', customer: '客户' };
  const internalRoles = { admin: roles.admin, business: roles.business };
  const customerAccessPolicy = invite => ['在线浏览产品与素材',invite?.allowDownload===true?'允许下载素材':'不允许下载素材',invite?.allowExport===true?'允许导出表格':'不允许导出表格',invite?.quotation?'附客户报价':''].filter(Boolean).join(' · ');
  const statusNames = { active: '有效', paused: '已暂停', revoked: '已撤销', expired: '已过期' };
  let refreshTimer;

  function statusOf(invite) {
    if (invite.status === 'revoked') return 'revoked';
    const expiry = new Date(invite.expiresAt).getTime();
    if (!Number.isFinite(expiry) || expiry <= Date.now()) return 'expired';
    return invite.status === 'paused' ? 'paused' : 'active';
  }
  function dateTime(value) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '未设置';
  }
  function badge(invite) {
    const status = statusOf(invite);
    return `<span class="badge ${status === 'active' ? 'green' : status === 'paused' || status === 'expired' ? 'amber' : ''}">${statusNames[status]}</span>`;
  }
  const publishedProducts = () => L.liveProducts();
  const activeTeam = () => L.state.team.filter(person => person.status !== 'disabled' && Object.hasOwn(internalRoles, person.role));
  const displayPerson = person => person.name || person.displayName || '演示成员';
  const ownerName = owner => {
    const person = L.state.team.find(item => item.id === owner);
    return person ? displayPerson(person) : owner || '未分配';
  };
  const inviteName = invite => invite.name || invite.company || '资料访问邀请';
  const ids = value => Array.isArray(value) ? value : [];
  const granted = invite => new Set(ids(invite.productIds));
  function timeInput(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  function accessURL(invite) {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '/login?company=' + encodeURIComponent(companyId()) + '&code=' + encodeURIComponent(invite.code);
    return url.href;
  }
  function customerURL(invite) {
    if (!invite.quotation) return accessURL(invite);
    if (!L.quoteShare?.url) throw new Error('报价链接功能尚未就绪，请刷新页面后重试。');
    return L.quoteShare.url(invite);
  }
  const quoteKey = line => JSON.stringify([line.productId, line.skuId]);
  function quoteSnapshot(product, variant) {
    return {productId:product.id,skuId:variant.id,name:String(product.name||product.id),sku:String(variant.sku||''),color:String(variant.colorLabel||variant.color||''),brand:String(L.productBrand?.(product)?.name||product.brand||''),image:variant.images?.[0]||'',quantity:'1',unitPrice:''};
  }
  function quotationEditor(form, existing, productIds, refreshProducts, showError) {
    const enabled=form.querySelector('#invite-quote-enabled'),panel=form.querySelector('#invite-quote-editor'),rows=form.querySelector('#invite-quote-rows');
    const number=form.querySelector('#invite-quote-number'),currency=form.querySelector('#invite-quote-currency'),validUntil=form.querySelector('#invite-quote-valid-until'),notes=form.querySelector('#invite-quote-notes');
    const selected=new Map(ids(existing?.quotation?.lines).map(line=>[quoteKey(line),structuredClone(line)]));
    const defaults=existing?.quotation||{};
    number.value=defaults.number||`IQ-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${L.uid('iq').split('-').pop().slice(-6).toUpperCase()}`;
    currency.value=defaults.currency||'USD';
    validUntil.value=defaults.validUntil||form.elements.expiresAt.value.slice(0,10);
    notes.value=defaults.notes||'';
    enabled.checked=Boolean(existing?.quotation);
    const available=()=>publishedProducts().flatMap(product=>ids(product.variants).map(variant=>quoteSnapshot(product,variant)));
    function totals() {
      const output=form.querySelector('#invite-quote-total'),hint=form.querySelector('#invite-quote-total-note');
      try {
        const result=L.quotationTools.amounts([...selected.values()],false);
        output.textContent=`${currency.value} ${L.quotationTools.money(result.total)}`;
        hint.textContent=result.pending?`${selected.size} 项明细 · ${result.pending} 项待填写单价或数量`:`${selected.size} 项明细 · 单价 × 数量自动合计`;
      } catch(error) {output.textContent='待核对';hint.textContent=error.message;}
    }
    function render() {
      panel.hidden=!enabled.checked;
      panel.querySelectorAll('input,select,textarea,button').forEach(input=>input.disabled=!enabled.checked);
      if(!enabled.checked)return;
      const live=available(),liveKeys=new Set(live.map(quoteKey));
      const displayed=live.filter(line=>productIds.has(line.productId)).map(line=>selected.get(quoteKey(line))||line);
      selected.forEach((line,key)=>{if(!liveKeys.has(key)||!productIds.has(line.productId))displayed.push(line);});
      rows.innerHTML=displayed.length?displayed.map(line=>{
        const key=quoteKey(line),checked=selected.has(key),invalid=!liveKeys.has(key)||!productIds.has(line.productId);
        return `<div class="invite-quote-row ${invalid?'invite-quote-row-invalid':''}" data-quote-row="${e(key)}"><label class="check-row invite-quote-product"><input type="checkbox" data-quote-check="${e(key)}" ${checked?'checked':''}><span><strong>${e(line.name)}</strong><small>${e([line.brand,line.sku,line.color].filter(Boolean).join(' · '))}</small>${invalid?'<small class="invite-quote-invalid-note">已不在授权范围或已下架，请取消此项报价，或重新选择该产品。</small>':''}</span></label><label class="field"><span>数量</span><input data-quote-quantity="${e(key)}" type="text" inputmode="numeric" maxlength="7" aria-label="${e(line.sku||line.name)} 报价数量" value="${e(line.quantity)}" ${checked?'':'disabled'}></label><label class="field"><span>单价</span><input data-quote-price="${e(key)}" type="text" inputmode="decimal" maxlength="30" aria-label="${e(line.sku||line.name)} 报价单价" placeholder="填写单价" value="${e(line.unitPrice)}" ${checked?'':'disabled'}></label><div class="invite-quote-line-total"><span>金额</span><strong data-quote-amount="${e(key)}">—</strong></div></div>`;
      }).join(''):'<p class="muted invite-small">先在上方选择产品，再勾选要报价的配色 / SKU。</p>';
      rows.querySelectorAll('[data-quote-check]').forEach(input=>input.onchange=()=>{
        const key=input.dataset.quoteCheck;
        if(input.checked){if(selected.size>=100){input.checked=false;showError('一条客户报价链接最多包含 100 项明细，请分开报价。');return;}const line=displayed.find(item=>quoteKey(item)===key);selected.set(key,structuredClone(line));}else selected.delete(key);
        render();
      });
      function sync(input,property,keyName){const key=input.dataset[keyName],line=selected.get(key);if(line){line[property]=input.value;lineTotal(key);totals();}}
      rows.querySelectorAll('[data-quote-quantity]').forEach(input=>input.oninput=()=>sync(input,'quantity','quoteQuantity'));
      rows.querySelectorAll('[data-quote-price]').forEach(input=>input.oninput=()=>sync(input,'unitPrice','quotePrice'));
      rows.querySelectorAll('[data-quote-amount]').forEach(output=>lineTotal(output.dataset.quoteAmount));
      totals();
    }
    function lineTotal(key) {
      const output=[...rows.querySelectorAll('[data-quote-amount]')].find(item=>item.dataset.quoteAmount===key),line=selected.get(key);
      if(!output)return;
      try {const result=line&&L.quotationTools.amounts([line],false);output.textContent=result&&!result.pending?L.quotationTools.money(result.total):'—';}catch(error){output.textContent='待核对';}
    }
    const savedSelect=form.querySelector('#invite-quote-saved');
    let records=[];
    try {records=L.quotationTools?.visibleRecords()||[];} catch(error) { /* A role change is rechecked on submit. */ }
    savedSelect.innerHTML='<option value="">选择已保存的报价单（可选）</option>'+records.map(record=>`<option value="${e(record.id)}">${e(record.number)} · ${e(record.customer||'未填写客户')}</option>`).join('');
    form.querySelector('#invite-quote-apply').onclick=()=>{
      try {
        const record=L.quotationTools.readRecord(savedSelect.value);
        if(!record.lines?.length)throw new Error('这份报价尚未添加产品，请先完善报价单。');
        if(record.lines.length>100)throw new Error('一条报价链接最多包含 100 项明细，请选择较小的报价单。');
        if((record.notes||'').length>500)throw new Error('该报价的备注超过 500 个字符，请先在报价单中缩短备注。');
        const live=new Set(available().map(quoteKey)),replacement=new Map();
        for(const line of record.lines){const snapshot={...line.snapshot,quantity:String(line.quantity??''),unitPrice:String(line.unitPrice??'')},key=quoteKey(snapshot);if(!live.has(key))throw new Error('这份报价包含已下架产品或配色，请先在报价单中更新。');if(replacement.has(key))throw new Error('这份报价包含重复配色，请先在报价单中合并明细。');replacement.set(key,snapshot);}
        selected.clear();replacement.forEach((line,key)=>{selected.set(key,line);productIds.add(line.productId);});
        number.value=record.number||number.value;currency.value=record.currency;validUntil.value=record.validUntil||validUntil.value;notes.value=record.notes||'';
        if(!form.elements.company.value.trim())form.elements.company.value=record.customer||'';
        if(!form.elements.contact.value.trim())form.elements.contact.value=record.contact||'';
        refreshProducts();render();form.querySelector('#invite-quote-fill-status').textContent='已填入报价，并加入对应产品范围。可继续修改本次客户报价。';
      } catch(error) {showError(savedSelect.value?error.message:'请先选择一份已保存的报价单。');}
    };
    enabled.onchange=render;
    currency.onchange=()=>{totals();form.querySelector('#invite-quote-fill-status').textContent='币种已切换，单价不会自动换算，请核对金额。';};
    render();
    return {render,read(){
      if(!enabled.checked)return null;
      if(!L.inviteQuote?.normalize)throw new Error('报价链接功能尚未就绪，请刷新页面后重试。');
      const live=new Set(available().map(quoteKey));
      for(const [key,line] of selected)if(!live.has(key)||!productIds.has(line.productId))throw new Error('报价包含已下架或不在产品范围内的明细，请取消对应报价项，或重新选择该产品。');
      const lines=[...selected.values()].map(line=>({...line,unitPrice:L.quotationTools.money(L.quotationTools.parsePrice(line.unitPrice)),quantity:String(L.quotationTools.parseQuantity(line.quantity)),image:typeof line.image==='string'&&/^(data:|blob:)/i.test(line.image)?'':line.image}));
      return L.inviteQuote.normalize({version:1,number:number.value.trim(),currency:currency.value,validUntil:validUntil.value,notes:notes.value.trim(),lines},{productIds:[...productIds],companyId:companyId()});
    }};
  }
  function randomCode() {
    let code;
    do {
      const bytes = new Uint8Array(6);
      crypto.getRandomValues(bytes);
      code = (companyId() === 'unico' ? 'UNICO-' : 'UNIQ-') + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
    } while (L.state.invites.some(invite => invite.code === code));
    return code;
  }
  function authorized(action) {
    if (L.can(action)) return true;
    L.toast(action==='team'?'仅管理员可以管理员工账号与身份。':'当前账号没有此操作权限，请联系管理员调整。');
    return false;
  }
  async function change(mutator, message) {
    const state = L.state, subject = companyId();
    const old = { invites: structuredClone(state.invites), team: structuredClone(state.team), logs: structuredClone(state.logs) };
    try {
      mutator();
      await L.save();
      if (companyId() !== subject) return false;
      if (message) L.toast(message);
      return true;
    } catch (error) {
      Object.assign(state, old);
      L.toast('保存未成功，请检查浏览器存储空间后重试。');
      return false;
    }
  }
  function deny(el, action) {
    if (L.can(action)) return false;
    if(action==='team'){el.innerHTML='<div class="panel empty-state"><h2>仅管理员可管理员工账号</h2><p class="muted">员工身份由管理员分配，请联系管理员调整账号与权限。</p></div>';return true;}
    el.innerHTML = '<div class="panel empty-state"><h2>当前账号无法管理客户邀请</h2><p class="muted">请联系管理员调整账号权限，再进入相应操作页面。</p></div>';
    return true;
  }

  function renderInvites(el) {
    clearTimeout(refreshTimer);
    if (deny(el, 'invites')) return;
    const all = L.state.invites;
    const query = filters.query.trim().toLowerCase();
    const items = all.filter(invite => (filters.status === 'all' || statusOf(invite) === filters.status) &&
      [invite.name, invite.company, invite.contact, invite.email, ownerName(invite.owner), invite.code].some(value => String(value || '').toLowerCase().includes(query)));
    el.innerHTML = L.pageBanner({eyebrow:'CUSTOMER INVITATIONS',title:'客户与邀请',description:'选择客户可看的产品，按需填写报价并生成分享链接。',actions:'<button class="btn primary" id="invite-new">＋ 生成邀请链接</button>'}) + `
      <div class="notice invite-demo-notice"><strong>产品邀请与客户报价</strong><span>附上报价后，可复制报价链接给客户跨设备查看。资料库访问邀请仍仅在当前浏览器演示。</span></div>
      <section class="panel invite-list-panel">
        <div class="toolbar"><label class="invite-search"><span class="invite-sr-only">搜索公司、联系人或邀请码</span><input class="search-input" id="invite-search" placeholder="搜索公司、联系人或邀请码" value="${e(filters.query)}"></label>
          <label class="invite-filter"><span class="invite-sr-only">邀请状态</span><select id="invite-status" aria-label="邀请状态"><option value="all">全部状态</option>${Object.entries(statusNames).map(([value, label]) => `<option value="${value}" ${filters.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
          <span class="muted invite-result-count">${items.length} 个结果</span></div>
        ${items.length ? `<div class="table-wrap"><table class="invite-table"><thead><tr><th>客户 / 联系人</th><th>访问权限</th><th>有效期</th><th>负责人</th><th>状态</th><th>操作</th></tr></thead><tbody>${items.map(invite => `<tr>
          <td><button class="invite-name" data-invite-action="view" data-id="${e(invite.id)}">${e(invite.company || '未命名公司')}</button><span class="invite-cell-note">${e(invite.contact || '未填写联系人')}${invite.email ? ' · ' + e(invite.email) : ''}</span><span class="invite-code">${e(invite.code)}</span></td>
          <td data-label="访问权限"><span>${ids(invite.productIds).length} 个产品</span><span class="invite-cell-note">${browsableAssets(invite).length} 份素材可浏览</span><span class="invite-cell-note" data-invite-access-policy>${e(customerAccessPolicy(invite))}</span></td>
          <td data-label="有效期至"><span>${e(dateTime(invite.expiresAt))}</span><span class="invite-cell-note">${e(inviteName(invite))}</span></td>
          <td data-label="负责人">${e(ownerName(invite.owner))}</td><td data-label="状态">${badge(invite)}</td>
          <td class="invite-mobile-full"><div class="row-actions"><button class="btn small" data-invite-action="view" data-id="${e(invite.id)}">查看</button><button class="btn small" data-invite-action="edit" data-id="${e(invite.id)}" ${invite.status === 'revoked' ? 'disabled title="已撤销的邀请不可编辑，请新建邀请"' : ''}>编辑</button><button class="btn small" data-invite-action="copy" data-id="${e(invite.id)}">查看链接</button></div></td>
        </tr>`).join('')}</tbody></table></div>` : `<div class="empty-state"><h3>${all.length ? '没有符合条件的邀请' : '还没有客户邀请'}</h3><p class="muted">${all.length ? '尝试其他关键词或状态。' : '先发布产品，再为客户创建访问邀请。'}</p>${all.length ? '<button class="btn" id="invite-clear">清除筛选</button>' : ''}</div>`}
      </section>`;
    el.querySelector('#invite-new').onclick = () => editInvite();
    const search = el.querySelector('#invite-search');
    search.oninput = () => {
      filters.query = search.value;
      const start = search.selectionStart;
      renderInvites(el);
      const replacement = el.querySelector('#invite-search');
      replacement.focus();
      replacement.setSelectionRange(start, start);
    };
    el.querySelector('#invite-status').onchange = event => { filters.status = event.target.value; renderInvites(el); };
    el.querySelector('#invite-clear')?.addEventListener('click', () => { filters.query = ''; filters.status = 'all'; renderInvites(el); });
    el.querySelectorAll('[data-invite-action]').forEach(button => button.onclick = () => {
      const invite = L.state.invites.find(item => item.id === button.dataset.id);
      if (!invite) return;
      if (button.dataset.inviteAction === 'view') viewInvite(invite);
      else if (button.dataset.inviteAction === 'edit') editInvite(invite);
      else linkDialog(invite);
    });
    const nextExpiry = Math.min(...all.filter(invite => statusOf(invite) === 'active' || (invite.status === 'paused' && statusOf(invite) !== 'expired')).map(invite => new Date(invite.expiresAt).getTime() - Date.now()).filter(delay => Number.isFinite(delay) && delay > 0));
    const refreshWhenIdle = () => {
      if (!el.isConnected || location.hash.split('?')[0] !== '#/invites') return;
      if (document.querySelector('dialog[open]') || document.activeElement?.id === 'invite-search') {
        refreshTimer = setTimeout(refreshWhenIdle, 1000);
      } else renderInvites(el);
    };
    refreshTimer = setTimeout(refreshWhenIdle, Math.min(Number.isFinite(nextExpiry) ? nextExpiry + 100 : 60000, 60000));
  }

  function productLabel(product) { return [L.productBrand?.(product)?.name,product.name || product.id].filter(Boolean).join(' · '); }
  function eligibleAssets(productIds,includeUnlinked=false) {
    return L.state.assets.filter(asset => asset.status === 'published' && ((includeUnlinked&&!ids(asset.productIds).length) || ids(asset.productIds).some(id => productIds.has(id))));
  }
  function browsableAssets(invite) {
    const productIds = new Set(publishedProducts().filter(product => ids(invite.productIds).includes(product.id)).map(product => product.id));
    return productIds.size ? eligibleAssets(productIds,invite.assetScope!=='products').filter(asset => invite.assetScope==='products'||ids(invite.assetIds).includes(asset.id)) : [];
  }
  function editInvite(existing) {
    if (!authorized('invites') || existing?.status === 'revoked') return;
    const subject=companyId(),sourceState=L.state,products=publishedProducts();
    const availableIds=new Set(products.map(product=>product.id));
    const productIds=new Set(ids(existing?.productIds).filter(id=>availableIds.has(id)));
    const defaultExpiry=new Date(Date.now()+30*86400000).toISOString();
    const people=activeTeam();
    const initialOwner=existing?.owner||people.find(person=>person.role==='business')?.id||people[0]?.id||'';
    const dialog=L.modal(existing?'编辑客户邀请':'生成邀请链接',`
      <form id="invite-form" class="stack">
        <div class="notice"><span>填写客户名称并选择产品。需要展示价格时，打开下方「附上客户报价」，填写单价与数量。</span></div>
        <div class="form-grid">
          <label class="field"><span>客户公司 <span class="invite-required">*</span></span><input name="company" required maxlength="100" placeholder="填写客户或公司名称" value="${e(existing?.company)}"></label>
          <label class="field"><span>联系人（可选）</span><input name="contact" maxlength="60" placeholder="填写联系人姓名" value="${e(existing?.contact)}"></label>
          <label class="field"><span>我方负责人 <span class="invite-required">*</span></span><select name="owner" required>${people.map(person=>`<option value="${e(person.id)}" ${initialOwner===person.id?'selected':''}>${e(displayPerson(person))} · ${e(roles[person.role]||person.role)}</option>`).join('')}${initialOwner&&!people.some(person=>person.id===initialOwner)?`<option value="${e(initialOwner)}" selected>${e(ownerName(initialOwner))}（当前记录）</option>`:''}</select></label>
          <label class="field"><span>访问截止时间 <span class="invite-required">*</span></span><input name="expiresAt" type="datetime-local" required value="${timeInput(existing?.expiresAt||defaultExpiry)}"><small class="muted">按当前设备时区显示，到期后停止访问。</small></label>
        </div>
        <fieldset class="invite-grant"><legend>1. 产品范围 <span class="invite-required">*</span></legend>
          <p class="muted invite-small">客户可浏览所选产品及其全部已发布素材，后续发布的该产品素材也会纳入。新增产品需另行勾选。</p>
          ${existing&&existing.assetScope!=='products'?'<div class="notice invite-scope-migration">此邀请原按单份素材授权。保存后，将改为开放所选产品的全部已发布素材；下载与导出仍按下方开关执行。</div>':''}
          <div class="invite-product-toolbar"><label class="invite-product-search"><span class="invite-sr-only">搜索产品品牌、型号或 SKU</span><input type="search" id="invite-product-search" class="search-input" placeholder="搜索品牌、型号或 SKU"></label><div class="row-actions"><button type="button" class="btn small" id="invite-products-all">全选当前筛选</button><button type="button" class="btn small" id="invite-products-clear">清空</button></div></div>
          <div class="invite-product-options" id="invite-product-options" aria-label="可选产品"></div>
          <p class="muted invite-small invite-selection-summary" id="invite-selection-summary" aria-live="polite"></p>
        </fieldset>
        <fieldset class="invite-grant"><legend>2. 访问权限</legend><p class="muted invite-small">默认仅浏览。下载素材与导出表格可分别开启，仅限所选产品范围。</p>
          <div class="invite-permission-options"><label class="check-row"><input type="checkbox" name="allowDownload" ${existing?.allowDownload===true?'checked':''}><span><strong>允许下载素材</strong><small>下载所选产品的已发布图片、视频与文件</small></span></label><label class="check-row"><input type="checkbox" name="allowExport" ${existing?.allowExport===true?'checked':''}><span><strong>允许导出表格</strong><small>使用固定模板导出所选产品资料</small></span></label></div>
          <p class="muted invite-small" id="invite-customer-policy" data-invite-access-policy></p>
        </fieldset>
        <fieldset class="invite-grant invite-quote-grant"><legend>3. 客户报价（可选）</legend>
          <label class="check-row invite-quote-toggle"><input type="checkbox" id="invite-quote-enabled"><span><strong>附上客户报价</strong><small>生成可跨设备打开的报价链接，客户直接查看单价、数量与总额。</small></span></label>
          <div id="invite-quote-editor" class="invite-quote-editor" hidden>
            <div class="invite-quote-import"><label class="field"><span>引用已保存报价</span><select id="invite-quote-saved" aria-label="引用已保存报价"></select></label><button type="button" class="btn" id="invite-quote-apply">填入报价</button></div>
            <div class="form-grid"><label class="field"><span>报价编号</span><input id="invite-quote-number" maxlength="80" required></label><label class="field"><span>币种</span><select id="invite-quote-currency"><option value="USD">USD · 美元</option><option value="CNY">CNY · 人民币</option><option value="EUR">EUR · 欧元</option><option value="HKD">HKD · 港币</option></select></label><label class="field"><span>报价有效期</span><input id="invite-quote-valid-until" type="date" required><small class="muted">报价链接以报价有效期与访问截止时间中较早的时间为准。</small></label></div>
            <p class="muted invite-small">勾选需要报价的配色 / SKU，手动填写单价与数量。此处报价不会修改产品库价格。</p>
            <div id="invite-quote-rows" class="invite-quote-rows"></div>
            <div class="invite-quote-total"><div><span>报价总额</span><small id="invite-quote-total-note" aria-live="polite"></small></div><strong id="invite-quote-total" aria-live="polite">—</strong></div>
            <label class="field"><span>报价备注（可选）</span><textarea id="invite-quote-notes" rows="2" maxlength="500" placeholder="填写报价说明，最多 500 个字符"></textarea></label>
            <p class="muted invite-small" id="invite-quote-fill-status" aria-live="polite"></p>
            <div class="notice invite-small">报价链接包含本次报价，拿到链接的人均可查看和转发。修改或撤销本地邀请不会更新或撤回已发出的报价链接；改价后请重新复制链接。本机上传图片不会随链接传送。</div>
          </div>
        </fieldset>
        <p id="invite-form-error" class="invite-form-error" role="alert" hidden></p>
        <div class="invite-modal-actions"><button type="button" class="btn" id="invite-cancel">取消</button><button class="btn primary" type="submit">${existing?'保存修改':'生成链接'}</button></div>
      </form>`,{wide:true});
    const form=dialog.querySelector('form'),error=form.querySelector('#invite-form-error');
    let quoteEditor;
    const showError=text=>{error.textContent=text;error.hidden=false;error.scrollIntoView({block:'nearest'});};
    const filteredProducts=()=>{const query=form.querySelector('#invite-product-search').value.trim().toLowerCase();return products.filter(product=>[productLabel(product),product.model,product.id,...ids(product.variants).map(variant=>variant.sku)].join(' ').toLowerCase().includes(query));};
    function updateSummary(){
      const visible=filteredProducts();
      form.querySelector('#invite-selection-summary').textContent=`已选 ${productIds.size} 个产品 · ${eligibleAssets(productIds).length} 份已发布素材 · 当前筛选 ${visible.length} 个产品`;
      form.querySelector('#invite-products-all').disabled=!visible.length||visible.every(product=>productIds.has(product.id));
      form.querySelector('#invite-products-clear').disabled=!productIds.size;
    }
    function renderProducts(){
      const visible=filteredProducts(),region=form.querySelector('#invite-product-options');
      region.innerHTML=visible.length?visible.map(product=>`<label class="check-row"><input type="checkbox" name="productIds" value="${e(product.id)}" ${productIds.has(product.id)?'checked':''}><span><strong>${e(productLabel(product))}</strong><small>${e(product.categoryLabel||product.type||'产品')} · ${eligibleAssets(new Set([product.id])).length} 份素材</small></span></label>`).join(''):`<p class="muted invite-products-empty">${products.length?'没有匹配产品，请尝试其他品牌或型号。':'暂无已发布产品，请先在产品管理中发布产品。'}</p>`;
      region.querySelectorAll('[name="productIds"]').forEach(input=>input.onchange=()=>{if(input.checked)productIds.add(input.value);else productIds.delete(input.value);updateSummary();quoteEditor?.render();});
      updateSummary();quoteEditor?.render();
    }
    function updatePolicy(){form.querySelector('#invite-customer-policy').textContent=customerAccessPolicy({allowDownload:form.elements.allowDownload.checked,allowExport:form.elements.allowExport.checked});}
    form.querySelector('#invite-product-search').oninput=renderProducts;
    form.querySelector('#invite-products-all').onclick=()=>{filteredProducts().forEach(product=>productIds.add(product.id));renderProducts();};
    form.querySelector('#invite-products-clear').onclick=()=>{productIds.clear();renderProducts();};
    form.elements.allowDownload.onchange=updatePolicy;form.elements.allowExport.onchange=updatePolicy;
    form.querySelector('#invite-cancel').onclick=()=>L.closeModal();
    quoteEditor=quotationEditor(form,existing,productIds,renderProducts,showError);
    renderProducts();updatePolicy();
    form.onsubmit=async event=>{
      event.preventDefault();
      if(!authorized('invites')||companyId()!==subject||L.state!==sourceState||!dialog.isConnected)return;
      error.hidden=true;
      if(!form.reportValidity())return;
      if(!productIds.size)return showError('请至少选择一个客户可浏览的已发布产品。');
      const stillPublished=new Set(publishedProducts().map(product=>product.id));
      if([...productIds].some(id=>!stillPublished.has(id)))return showError('部分所选产品已下架，请重新打开邀请后选择。');
      const expiresAt=new Date(form.elements.expiresAt.value);
      if(!Number.isFinite(expiresAt.getTime())||expiresAt.getTime()<=Date.now())return showError('访问截止时间需要晚于当前时间。');
      const company=form.elements.company.value.trim(),contact=form.elements.contact.value.trim(),owner=form.elements.owner.value;
      if(!company)return showError('请填写客户或公司名称。');
      if(!activeTeam().some(person=>person.id===owner)&&owner!==existing?.owner)return showError('请选择启用中的管理员或业务人员作为负责人。');
      let quotation;
      try {quotation=quoteEditor.read();} catch(error) {return showError(error.message);}
      const allowDownload=form.elements.allowDownload.checked,allowExport=form.elements.allowExport.checked,now=new Date().toISOString();
      const record={...(existing||{}),id:existing?.id||L.uid('invite'),name:existing?.name||company+' · 产品资料',company,contact,email:existing?.email||'',owner,
        code:existing?.code||randomCode(),productIds:[...productIds],assetScope:'products',assetIds:eligibleAssets(productIds).map(asset=>asset.id),
        templateIds:allowExport?L.state.templates.filter(template=>template.status==='published'&&['catalog','sku','packaging'].includes(template.kind)).map(template=>template.id):[],allowDownload,allowExport,quotation,
        expiresAt:expiresAt.toISOString(),status:existing?.status||'active',createdAt:existing?.createdAt||now,updatedAt:now};
      if(quotation){try {customerURL({...record,status:'active'});} catch(error) {return showError(error.message);}}
      const submit=form.querySelector('[type="submit"]');submit.disabled=true;
      const success=await change(()=>{
        if(existing)L.state.invites=L.state.invites.map(invite=>invite.id===existing.id?record:invite);else L.state.invites.unshift(record);
        L.log(existing?'修改客户邀请':'创建客户邀请',company);
      },existing?'邀请修改已保存到当前浏览器。':quotation?'客户报价链接已生成。':'模拟邀请链接已生成。');
      if(success){if(dialog.isConnected){L.closeModal();L.render();if(!existing)linkDialog(record,true);}}else submit.disabled=false;
    };
  }

  function viewInvite(invite) {
    if (!authorized('invites')) return;
    const products = publishedProducts().filter(product => granted(invite).has(product.id));
    const assets = browsableAssets(invite);
    const active = statusOf(invite) === 'active';
    const revoked = invite.status === 'revoked';
    const dialog = L.modal('邀请详情', `
      <div class="invite-detail-head"><div><h2>${e(invite.company)}</h2><p class="muted">${e(inviteName(invite))}</p></div>${badge(invite)}</div>
      <dl class="invite-detail-grid"><div><dt>联系人</dt><dd>${e(invite.contact || '未填写')}</dd></div><div><dt>邮箱</dt><dd>${e(invite.email || '未填写')}</dd></div><div><dt>负责人</dt><dd>${e(ownerName(invite.owner))}</dd></div><div><dt>有效期至</dt><dd>${e(dateTime(invite.expiresAt))}</dd></div><div><dt>创建时间</dt><dd>${e(dateTime(invite.createdAt))}</dd></div><div><dt>邀请码</dt><dd class="invite-mono">${e(invite.code)}</dd></div></dl>
      <div class="invite-detail-grants"><h3>产品范围</h3><div class="invite-tags">${products.length ? products.map(product => `<span class="badge purple">${e(productLabel(product))}</span>`).join('') : '<span class="muted">当前无已发布的授权产品</span>'}</div><p class="muted invite-small">${ids(invite.productIds).length} 个产品授权 · 已下架产品不会显示在客户页面</p>
      <h3>素材与权限</h3><p>${assets.length} 份已发布素材可在线浏览</p><p class="muted invite-small">${invite.assetScope==='products'?'按产品授权，所选产品后续发布的素材也会纳入。':'保留原来的单份素材授权范围，尚未改为按产品授权。'}</p><p data-invite-access-policy>${e(customerAccessPolicy(invite))}</p></div>
      ${invite.quotation?`<div class="invite-detail-quotation"><h3>客户报价</h3><span>${e(invite.quotation.number)} · ${ids(invite.quotation.lines).length} 项明细</span><strong>${e(invite.quotation.currency)} ${e(L.quotationTools.money(invite.quotation.totalCents))}</strong></div>`:''}
      <div class="notice"><span>${invite.quotation?'报价链接可跨设备查看，内容为生成时的报价。暂停、重置或撤销本地邀请，均不能撤回已发出的报价链接；持有人可以转发链接。':'这是当前浏览器的资料库访问演示。身份核验、跨设备访问及服务端撤销须由后端实现。'}</span></div>
      <div class="invite-detail-actions"><button class="btn primary" id="invite-preview" ${active ? '' : 'disabled'}>预览客户访问</button><button class="btn" id="invite-copy">查看 / 复制链接</button><button class="btn" id="invite-edit" ${revoked ? 'disabled' : ''}>编辑权限</button>${revoked ? '' : `<button class="btn" id="invite-toggle">${invite.status === 'paused' ? '恢复邀请' : '暂停邀请'}</button><button class="btn" id="invite-reset">重置邀请码</button><button class="btn danger" id="invite-revoke">撤销邀请</button>`}</div>
      ${statusOf(invite) === 'expired' ? '<p class="muted invite-small">此邀请已过期，请先编辑有效期。恢复暂停状态不会延长有效期。</p>' : ''}`, { wide: true });
    dialog.querySelector('#invite-preview').onclick = () => { if (statusOf(invite) !== 'active') return L.toast('邀请已失效，请检查状态与有效期。'); L.closeModal(); L.go('login?company=' + encodeURIComponent(companyId()) + '&code=' + encodeURIComponent(invite.code)); };
    dialog.querySelector('#invite-copy').onclick = () => { L.closeModal(); linkDialog(invite); };
    dialog.querySelector('#invite-edit').onclick = () => { L.closeModal(); editInvite(invite); };
    dialog.querySelector('#invite-toggle')?.addEventListener('click', async () => {
      if (!authorized('invites')) return;
      const next = invite.status === 'paused' ? 'active' : 'paused';
      if (next === 'active' && statusOf(invite) === 'expired') return L.toast('邀请已过期，请先编辑并延长有效期。');
      const success = await change(() => {
        const record = L.state.invites.find(item => item.id === invite.id);
        record.status = next; record.updatedAt = new Date().toISOString();
        L.log(next === 'active' ? '恢复客户邀请' : '暂停客户邀请', record.company);
      }, next === 'active' ? '已恢复本地邀请。' : '已暂停本地邀请。');
      if (success && dialog.isConnected) { L.closeModal(); L.render(); viewInvite(L.state.invites.find(item => item.id === invite.id)); }
    });
    dialog.querySelector('#invite-reset')?.addEventListener('click', () => {
      L.closeModal();
      L.confirm('重置邀请码', '原来的本地邀请码和资料库演示链接将失效。重置后，请使用新的链接进行预览。'+(invite.quotation?' 已发出的客户报价链接仍可查看，重置邀请码不会撤回报价。':''), async () => {
        if (!authorized('invites')) return;
        const confirmation = document.querySelector('dialog.library-dialog[open]');
        const success = await change(() => {
          const record = L.state.invites.find(item => item.id === invite.id);
          record.code = randomCode(); record.updatedAt = new Date().toISOString();
          L.log('重置邀请码', record.company);
        }, '本地邀请码已重置。'+(invite.quotation?'已发出的报价链接保持不变。':'旧资料库演示链接已失效。'));
        if (success && confirmation?.isConnected && confirmation.open) { L.render(); linkDialog(L.state.invites.find(item => item.id === invite.id)); }
      });
    });
    dialog.querySelector('#invite-revoke')?.addEventListener('click', () => {
      L.closeModal();
      L.confirm('撤销这条邀请？', '撤销后，这条本地邀请无法恢复，资料库演示页面将停止访问。需要再次开放时，请创建新邀请。'+(invite.quotation?' 已发出的客户报价链接无法远程撤回，仍可查看至报价截止。':''), async () => {
        if (!authorized('invites')) return;
        const confirmation = document.querySelector('dialog.library-dialog[open]');
        const success = await change(() => {
          const record = L.state.invites.find(item => item.id === invite.id);
          record.status = 'revoked'; record.updatedAt = new Date().toISOString();
          L.log('撤销客户邀请', record.company);
        }, '邀请已撤销。');
        if (success && confirmation?.isConnected && confirmation.open) L.render();
      });
    });
  }

  function linkDialog(invite, created = false) {
    if (!authorized('invites')) return;
    let shareURL='',linkError='';
    try {shareURL=customerURL(invite);} catch(error) {linkError=error.message;}
    const quoted=Boolean(invite.quotation),active=statusOf(invite)==='active'&&!linkError;
    const products = publishedProducts().filter(product => granted(invite).has(product.id));
    const dialog = L.modal(created ? (quoted?'客户报价链接已生成':'邀请链接已生成') : (quoted?'客户报价链接':'客户邀请链接'), `<div class="stack invite-link-result">
      <div class="invite-link-heading"><span class="invite-link-symbol">${L.icon('link')}</span><div><span class="badge">${quoted?'客户报价 · 可跨设备查看':'资料库邀请 · 本机演示'}</span><h2>${e(invite.company)}</h2></div>${badge(invite)}</div>
      <dl class="invite-link-summary"><div><dt>产品范围</dt><dd class="invite-products-summary">${products.map(product => e(productLabel(product))).join('、') || '暂无可浏览产品'}</dd></div><div><dt>有效期至</dt><dd>${e(dateTime(invite.expiresAt))}</dd></div></dl>
      ${quoted?`<div class="invite-detail-quotation"><span>${e(invite.quotation.number)} · ${ids(invite.quotation.lines).length} 项明细</span><strong>${e(invite.quotation.currency)} ${e(L.quotationTools.money(invite.quotation.totalCents))}</strong><small class="muted">报价有效期：${e(invite.quotation.validUntil)}，与访问截止时间以较早者为准。</small></div>`:''}
      <p class="muted invite-small" data-invite-access-policy>${e(customerAccessPolicy(invite))}</p>
      <label class="field"><span>${quoted?'客户报价链接':'邀请链接'}</span><textarea id="invite-link-value" rows="3" readonly>${e(shareURL)}</textarea></label>
      ${quoted?`<details class="invite-local-link"><summary>本机资料库演示邀请</summary><p class="muted invite-small">以下邀请码与资料库邀请仅在当前浏览器有效。上方客户报价链接可浏览本次报价产品与专属价格，素材权限由原资料库邀请控制。</p><label class="field"><span>本机资料库邀请链接</span><textarea rows="2" readonly>${e(accessURL(invite))}</textarea></label>`:''}
      <div class="invite-link-code"><span>邀请码</span><code id="invite-link-code">${e(invite.code)}</code></div>
      ${quoted?'</details>':''}
      <div class="notice invite-small">${quoted?'链接内含本次报价，客户无需登录即可查看，持有人可以转发。改价后需重新复制链接；暂停、重置或撤销本地邀请不会撤回已发出的报价。':'当前仅在同一浏览器、同一网站地址下预览。正式分享资料库访问权限需接入后端。'}</div>
      <p class="muted invite-small" id="invite-copy-status" aria-live="polite">${quoted?'客户打开链接后，可在产品卡片和详情中查看专属价格，也可切换到报价汇总。':'链接已包含邀请码，打开后可直接进入客户访问页面。'}</p>
      <div class="invite-modal-actions"><button class="btn" id="invite-open-link" ${active ? '' : 'disabled'}>${quoted?'预览客户资料库':'预览客户访问'}</button><button class="btn primary" id="invite-copy-link" ${active ? '' : 'disabled'}>${L.icon('link')}${quoted?'复制客户报价链接':'复制链接'}</button></div>
      ${active ? '' : `<p class="invite-form-error">${e(linkError||'此邀请当前不可访问，请检查状态与有效期。')}</p>`}
    </div>`);
    const textarea = dialog.querySelector('#invite-link-value');
    const status = dialog.querySelector('#invite-copy-status');
    const current = () => {
      if (!authorized('invites')) return null;
      const record = L.state.invites.find(item => item.id === invite.id);
      if (!record || statusOf(record) !== 'active') {
        status.textContent = '此邀请当前不可访问，请检查状态与有效期。';
        dialog.querySelector('#invite-copy-link').disabled = true;
        dialog.querySelector('#invite-open-link').disabled = true;
        return null;
      }
      try {textarea.value=customerURL(record);} catch(error) {status.textContent=error.message;return null;}
      dialog.querySelector('#invite-link-code').textContent = record.code;
      return record;
    };
    dialog.querySelector('#invite-copy-link').onclick = async () => {
      const record = current();
      if (!record) return;
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(textarea.value);
        status.textContent = record.quotation?'报价链接已复制，可发给客户跨设备查看。':'链接已复制，可在当前浏览器中打开预览。';
        L.toast(record.quotation?'客户报价链接已复制。':'模拟邀请链接已复制。');
      } catch (error) {
        textarea.focus(); textarea.select();
        status.textContent = '浏览器未允许自动复制，已选中链接；请按 Ctrl+C，或长按复制。';
      }
    };
    dialog.querySelector('#invite-open-link').onclick = () => {
      const record = current();
      if (!record) return;
      const hash=new URL(textarea.value).hash;
      L.closeModal();L.go(hash.replace(/^#\//,''));
    };
  }

  const roleDescriptions = {
    admin: { label: roles.admin, description: '管理产品与客户资料、分类、模板和内部成员，查看操作记录。', permissions: ['产品与素材编辑、发布', '客户邀请与资料导出', '分类与模板管理', '账号角色与操作记录'] },
    business: { label: roles.business, description: '维护并发布产品与素材，为客户配置邀请和资料范围。', permissions: ['产品与素材编辑、发布', '客户邀请与访问范围', '使用固定模板导出资料'] },
    customer: { label: roles.customer, description: '通过邀请码访问资料库，按邀请范围在线浏览产品与素材。', permissions: ['浏览获授权产品与素材', '按邀请设置下载和导出权限', '客户访问通过邀请管理'] }
  };
  function renderTeam(el) {
    if (deny(el, 'team')) return;
    const team=L.state.team.filter(person=>Object.hasOwn(internalRoles,person.role)),currentId=L.currentMember?.()?.id;
    el.innerHTML=L.pageBanner({eyebrow:'ACCOUNTS & ROLES',title:'账号与角色',description:'由管理员维护员工账号、分配身份并控制启用状态。',actions:'<button class="btn primary" id="team-new">＋ 添加员工</button>'})+`
      <div class="notice invite-demo-notice"><strong>员工登录 · 本机演示</strong><span>这些账号可在当前浏览器中用于员工登录，身份由管理员分配。目前共用演示密码，正式身份认证尚未接入。</span></div>
      <div class="team-role-grid">${Object.entries(roleDescriptions).map(([key,role])=>`<section class="panel team-role-card"><span class="badge ${key==='admin'?'purple':''}">${e(role.label)}</span><p>${e(role.description)}</p><ul>${role.permissions.map(permission=>`<li>${e(permission)}</li>`).join('')}</ul>${key==='customer'?'<a class="btn small" href="#/invites">管理客户邀请</a>':''}</section>`).join('')}</div>
      <section class="panel invite-list-panel"><div class="team-list-heading"><h2>员工账号</h2><span class="muted">${team.filter(person=>person.status!=='disabled').length} 位启用 · ${team.length} 位总计</span></div><div class="table-wrap"><table class="invite-table team-member-table"><thead><tr><th>员工</th><th>登录账号</th><th>员工身份</th><th>状态</th><th>负责邀请</th><th>操作</th></tr></thead><tbody>${team.map(person=>`<tr><td><strong>${e(displayPerson(person))}</strong>${person.id===currentId?'<span class="team-current-member">当前登录</span>':''}<span class="invite-cell-note">${e(person.email||'未填写邮箱')}</span></td><td data-label="登录账号"><code class="team-login-id">${e(person.login||'待设置')}</code></td><td data-label="员工身份">${e(roles[person.role]||person.role)}</td><td data-label="状态"><span class="badge ${person.status==='disabled'?'':'green'}">${person.status==='disabled'?'已停用':'启用中'}</span></td><td data-label="负责邀请">${L.state.invites.filter(invite=>invite.owner===person.id).length} 条</td><td class="invite-mobile-full"><div class="row-actions"><button class="btn small" data-team-edit="${e(person.id)}">编辑</button><button class="btn small ${person.status==='disabled'?'':'danger'}" data-team-toggle="${e(person.id)}" ${isLastAdmin(person)?'disabled title="请至少保留一位启用中的管理员"':''}>${person.status==='disabled'?'启用':'停用'}</button></div></td></tr>`).join('')}</tbody></table></div></section>
      <p class="muted invite-small">员工可使用登录账号或工作邮箱登录。停用后无法在当前浏览器登录；已发出的客户邀请仍保留，可在「客户与邀请」中另行调整。</p>`;
    el.querySelector('#team-new').onclick=()=>editMember();
    el.querySelectorAll('[data-team-edit]').forEach(button=>button.onclick=()=>editMember(team.find(person=>person.id===button.dataset.teamEdit)));
    el.querySelectorAll('[data-team-toggle]').forEach(button=>button.onclick=()=>toggleMember(team.find(person=>person.id===button.dataset.teamToggle)));
  }
  function isLastAdmin(person) {
    return person?.role==='admin'&&person.status!=='disabled'&&L.state.team.filter(item=>item.role==='admin'&&item.status!=='disabled').length<=1;
  }
  const normalizedIdentity=value=>String(value??'').trim().normalize('NFKC').toLowerCase();
  function validateMember(record,previous){
    if(!record.name?.trim())return '请填写员工姓名。';
    if(!record.login?.trim())return '请填写登录账号。';
    if(record.login.length>80)return '登录账号最多 80 个字符。';
    if(!Object.hasOwn(internalRoles,record.role))return '员工身份只能选择管理员或业务人员，客户请通过邀请管理。';
    if(previous&&isLastAdmin(previous)&&record.role!=='admin')return '请至少保留一位启用中的管理员，再调整这位员工的身份。';
    const identifiers=[record.login,record.email].map(normalizedIdentity).filter(Boolean);
    if(L.state.team.some(item=>item.id!==previous?.id&&[item.login,item.email].map(normalizedIdentity).filter(Boolean).some(identifier=>identifiers.includes(identifier))))return '该登录账号或邮箱已被其他员工使用，请换一个。';
    return '';
  }
  function editMember(person) {
    if(!authorized('team'))return;
    if(person&&!Object.hasOwn(internalRoles,person.role))return L.toast('客户通过「客户邀请」管理访问，无需添加内部成员。');
    const subject=companyId(),sourceState=L.state;
    const dialog=L.modal(person?'编辑员工账号':'添加员工',`<form id="team-form" class="stack"><div class="notice"><span>登录账号与工作邮箱均可用于本机员工登录，身份由管理员分配。当前使用统一演示密码，不用于真实身份认证。</span></div><label class="field"><span>员工姓名 *</span><input name="name" required maxlength="60" value="${e(person?displayPerson(person):'')}" placeholder="填写员工姓名"></label><label class="field"><span>登录账号 *</span><input name="login" required maxlength="80" autocomplete="username" spellcheck="false" value="${e(person?.login)}" placeholder="例如：sales01"><small class="muted">不区分大小写，不能与其他员工的账号或邮箱重复。</small></label><label class="field"><span>工作邮箱</span><input name="email" type="email" maxlength="180" value="${e(person?.email)}" placeholder="可选，也可用于登录"></label><label class="field"><span>员工身份 *</span><select name="role">${Object.entries(internalRoles).map(([key,label])=>`<option value="${key}" ${(person?.role||'business')===key?'selected':''} ${person&&isLastAdmin(person)&&key!=='admin'?'disabled':''}>${label}</option>`).join('')}</select></label><p id="team-role-help" class="muted"></p><p id="team-form-error" class="invite-form-error" role="alert" hidden></p><div class="invite-modal-actions"><button class="btn" type="button" id="team-cancel">取消</button><button class="btn primary" type="submit">保存员工</button></div></form>`);
    const form=dialog.querySelector('form'),error=form.querySelector('#team-form-error');
    const fail=text=>{error.hidden=false;error.textContent=text;};
    const roleHelp=()=>{form.querySelector('#team-role-help').textContent=person&&isLastAdmin(person)?'当前仅有这一位启用中的管理员，请先添加另一位管理员再调整身份。':roleDescriptions[form.elements.role.value]?.description||'';};
    roleHelp();form.elements.role.onchange=roleHelp;
    form.querySelector('#team-cancel').onclick=()=>L.closeModal();
    form.onsubmit=async event=>{
      event.preventDefault();
      if(!authorized('team')||companyId()!==subject||L.state!==sourceState||!dialog.isConnected||!form.reportValidity())return;
      error.hidden=true;
      const previous=person?L.state.team.find(item=>item.id===person.id):null;
      if(person&&!previous)return fail('员工账号已不存在，请刷新后重试。');
      const record={...(previous||{}),id:previous?.id||L.uid('member'),name:form.elements.name.value.trim(),login:form.elements.login.value.trim(),email:form.elements.email.value.trim(),role:form.elements.role.value,status:previous?.status||'active',updatedAt:new Date().toISOString()};
      const validation=validateMember(record,previous);if(validation)return fail(validation);
      const submit=form.querySelector('[type="submit"]');submit.disabled=true;
      const success=await change(()=>{
        if(previous)L.state.team=L.state.team.map(item=>item.id===previous.id?record:item);else L.state.team.push(record);
        L.log(previous?'编辑员工账号':'新增员工账号',record.name);
      },'员工账号已保存，登录身份按最新设置生效。');
      if(success){if(dialog.isConnected)L.closeModal();L.render();}else submit.disabled=false;
    };
  }
  function toggleMember(person) {
    if(!person||!authorized('team'))return;
    const current=L.state.team.find(item=>item.id===person.id);
    if(!current)return L.toast('员工账号已不存在，请刷新后重试。');
    if(!Object.hasOwn(internalRoles,current.role))return L.toast('客户通过「客户邀请」管理访问。');
    const disabled=current.status!=='disabled',subject=companyId(),sourceState=L.state;
    if(disabled&&isLastAdmin(current))return L.toast('请至少保留一位启用中的管理员。');
    L.confirm(disabled?'停用员工账号？':'启用员工账号？',disabled?'停用后，该员工无法在当前浏览器登录，已登录的身份也将失效。已发出的客户邀请仍保留，请按需另行调整。':'启用后，该员工可使用登录账号或工作邮箱进入当前浏览器的工作台。',async()=>{
      if(!authorized('team')||companyId()!==subject||L.state!==sourceState)return;
      const record=L.state.team.find(item=>item.id===person.id);
      if(!record)return L.toast('员工账号已不存在，请刷新后重试。');
      if(disabled&&isLastAdmin(record))return L.toast('请至少保留一位启用中的管理员。');
      const success=await change(()=>{
        record.status=disabled?'disabled':'active';record.updatedAt=new Date().toISOString();
        L.log(disabled?'停用员工账号':'启用员工账号',displayPerson(record));
      },disabled?'员工账号已停用。':'员工账号已启用。');
      if(success)L.render();
    });
  }


  L.register('invites', { title: '客户与邀请', banner:true, subtitle: '配置客户产品范围与下载、导出权限', render: renderInvites });
  L.register('team', { title: '账号与角色', banner:true, subtitle: '管理员维护员工账号与身份', render: renderTeam });
})();
