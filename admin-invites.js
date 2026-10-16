/* Browser-local invitation and team management. Production authentication is not implemented here. */
(() => {
  'use strict';
  const L = window.Library;
  const companyId = () => L.companyId?.() || 'uniqmag';
  const e = value => L.esc(value == null ? '' : value);
  const filters = { query: '', status: 'all' };
  const roles = { admin: '管理员', business: '业务人员', customer: '客户' };
  const internalRoles = { admin: roles.admin, business: roles.business };
  const customerAccessPolicy = invite => ['在线浏览产品与素材',invite?.allowDownload===true?'允许下载素材':'不允许下载素材',invite?.allowExport===true?'允许导出表格':'不允许导出表格'].join(' · ');
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
    el.innerHTML = L.pageBanner({eyebrow:'CUSTOMER INVITATIONS',title:'客户与邀请',description:'为客户生成访问链接，选择产品范围与下载、导出权限。',actions:'<button class="btn primary" id="invite-new">＋ 生成邀请链接</button>'}) + `
      <div class="notice invite-demo-notice"><strong>链接邀请 · 模拟演示</strong><span>生成链接后可复制并预览。当前仅在同一浏览器、同一网站地址下有效，正式发给客户需接入后端。</span></div>
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
        <div class="notice"><span>填写客户名称，选择产品范围和访问权限，即可生成模拟链接。</span></div>
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
        <p id="invite-form-error" class="invite-form-error" role="alert" hidden></p>
        <div class="invite-modal-actions"><button type="button" class="btn" id="invite-cancel">取消</button><button class="btn primary" type="submit">${existing?'保存修改':'生成链接'}</button></div>
      </form>`,{wide:true});
    const form=dialog.querySelector('form'),error=form.querySelector('#invite-form-error');
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
      region.querySelectorAll('[name="productIds"]').forEach(input=>input.onchange=()=>{if(input.checked)productIds.add(input.value);else productIds.delete(input.value);updateSummary();});
      updateSummary();
    }
    function updatePolicy(){form.querySelector('#invite-customer-policy').textContent=customerAccessPolicy({allowDownload:form.elements.allowDownload.checked,allowExport:form.elements.allowExport.checked});}
    form.querySelector('#invite-product-search').oninput=renderProducts;
    form.querySelector('#invite-products-all').onclick=()=>{filteredProducts().forEach(product=>productIds.add(product.id));renderProducts();};
    form.querySelector('#invite-products-clear').onclick=()=>{productIds.clear();renderProducts();};
    form.elements.allowDownload.onchange=updatePolicy;form.elements.allowExport.onchange=updatePolicy;
    form.querySelector('#invite-cancel').onclick=()=>L.closeModal();
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
      const allowDownload=form.elements.allowDownload.checked,allowExport=form.elements.allowExport.checked,now=new Date().toISOString();
      const record={...(existing||{}),id:existing?.id||L.uid('invite'),name:existing?.name||company+' · 产品资料',company,contact,email:existing?.email||'',owner,
        code:existing?.code||randomCode(),productIds:[...productIds],assetScope:'products',assetIds:eligibleAssets(productIds).map(asset=>asset.id),
        templateIds:allowExport?L.state.templates.filter(template=>template.status==='published'&&['catalog','sku','packaging'].includes(template.kind)).map(template=>template.id):[],allowDownload,allowExport,
        expiresAt:expiresAt.toISOString(),status:existing?.status||'active',createdAt:existing?.createdAt||now,updatedAt:now};
      const submit=form.querySelector('[type="submit"]');submit.disabled=true;
      const success=await change(()=>{
        if(existing)L.state.invites=L.state.invites.map(invite=>invite.id===existing.id?record:invite);else L.state.invites.unshift(record);
        L.log(existing?'修改客户邀请':'创建客户邀请',company);
      },existing?'邀请修改已保存到当前浏览器。':'模拟邀请链接已生成。');
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
      <div class="notice"><span>这是当前浏览器的访问演示。正式访问时，链接持有人可能转发链接；身份核验、跨设备访问及服务端撤销须由后端实现。</span></div>
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
      L.confirm('重置邀请码', '原来的邀请码和演示链接将失效。重置后，请使用新的链接进行预览。', async () => {
        if (!authorized('invites')) return;
        const confirmation = document.querySelector('dialog.library-dialog[open]');
        const success = await change(() => {
          const record = L.state.invites.find(item => item.id === invite.id);
          record.code = randomCode(); record.updatedAt = new Date().toISOString();
          L.log('重置邀请码', record.company);
        }, '邀请码已重置，旧链接已失效。');
        if (success && confirmation?.isConnected && confirmation.open) { L.render(); linkDialog(L.state.invites.find(item => item.id === invite.id)); }
      });
    });
    dialog.querySelector('#invite-revoke')?.addEventListener('click', () => {
      L.closeModal();
      L.confirm('撤销这条邀请？', '撤销后，这条邀请无法恢复，客户演示页面将停止访问。需要再次开放时，请创建新邀请。', async () => {
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
    const active = statusOf(invite) === 'active';
    const products = publishedProducts().filter(product => granted(invite).has(product.id));
    const dialog = L.modal(created ? '邀请链接已生成' : '客户邀请链接', `<div class="stack invite-link-result">
      <div class="invite-link-heading"><span class="invite-link-symbol">${L.icon('link')}</span><div><span class="badge">模拟链接</span><h2>${e(invite.company)}</h2></div>${badge(invite)}</div>
      <dl class="invite-link-summary"><div><dt>产品范围</dt><dd class="invite-products-summary">${products.map(product => e(productLabel(product))).join('、') || '暂无可浏览产品'}</dd></div><div><dt>有效期至</dt><dd>${e(dateTime(invite.expiresAt))}</dd></div></dl>
      <p class="muted invite-small" data-invite-access-policy>${e(customerAccessPolicy(invite))}</p>
      <label class="field"><span>邀请链接</span><textarea id="invite-link-value" rows="3" readonly>${e(accessURL(invite))}</textarea></label>
      <div class="invite-link-code"><span>邀请码</span><code id="invite-link-code">${e(invite.code)}</code></div>
      <div class="notice invite-small">当前仅在同一浏览器、同一网站地址下预览。正式分享给客户需接入后端。</div>
      <p class="muted invite-small" id="invite-copy-status" aria-live="polite">链接已包含邀请码，打开后可直接进入客户访问页面。</p>
      <div class="invite-modal-actions"><button class="btn" id="invite-open-link" ${active ? '' : 'disabled'}>预览客户访问</button><button class="btn primary" id="invite-copy-link" ${active ? '' : 'disabled'}>${L.icon('link')}复制链接</button></div>
      ${active ? '' : '<p class="invite-form-error">此邀请当前不可访问，请检查状态与有效期。</p>'}
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
      textarea.value = accessURL(record);
      dialog.querySelector('#invite-link-code').textContent = record.code;
      return record;
    };
    dialog.querySelector('#invite-copy-link').onclick = async () => {
      const record = current();
      if (!record) return;
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(accessURL(record));
        status.textContent = '链接已复制，可在当前浏览器中打开预览。';
        L.toast('模拟邀请链接已复制。');
      } catch (error) {
        textarea.focus(); textarea.select();
        status.textContent = '浏览器未允许自动复制，已选中链接；请按 Ctrl+C，或长按复制。';
      }
    };
    dialog.querySelector('#invite-open-link').onclick = () => {
      const record = current();
      if (!record) return;
      L.closeModal(); L.go('login?company=' + encodeURIComponent(companyId()) + '&code=' + encodeURIComponent(record.code));
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
