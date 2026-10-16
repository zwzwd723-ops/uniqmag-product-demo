(() => {
  'use strict';
  const L=window.Library={routes:{},state:null,selection:new Map(),ready:false};
  const companies=Object.freeze({uniqmag:Object.freeze({id:'uniqmag',name:'UNIQMAG',logo:'assets/logo.png',database:'uniqmag-b2b-v1'}),unico:Object.freeze({id:'unico',name:'UNICO',logo:'assets/unico-logo.png',database:'unico-b2b-v1'})});
  const companySession='product-library-company',roleSession='product-library-role',memberSession='product-library-member-id',memberCompanySession='product-library-member-company',memberTransferSession='product-library-member-transfer',entryTransferSession='product-library-entry-transfer';
  let companyChoices=null;
  const hasOwn=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
  const storedSession=key=>{try{return sessionStorage.getItem(key);}catch{return null;}};
  const initialParams=new URLSearchParams(location.hash.split('?')[1]||''),requestedCompany=initialParams.get('company');
  const activeCompanyId=hasOwn(companies,requestedCompany)?requestedCompany:hasOwn(companies,storedSession(companySession))?storedSession(companySession):'uniqmag';
  L.company=()=>companies[activeCompanyId];L.companyId=()=>activeCompanyId;
  const catalogFor=id=>id==='unico'?window.UNICO_CATALOG:window.CATALOG;
  L.catalog=()=>catalogFor(activeCompanyId);
  L.companyName=()=>L.company().name;L.companyLogo=()=>L.company().logo;
  function clearInviteSession(){['uniqmag-demo-invite','uniqmag-demo-code','uniqmag-demo-company'].forEach(key=>sessionStorage.removeItem(key));}
  function clearEmployeeSession(){[memberSession,memberCompanySession,memberTransferSession,entryTransferSession,roleSession].forEach(key=>sessionStorage.removeItem(key));companyChoices=null;}
  const loginKey=value=>String(value??'').trim().normalize('NFKC').toLowerCase();
  const activeMember=member=>member?.status==='active'&&['admin','business'].includes(member.role);
  const identityKeys=[memberSession,memberCompanySession,memberTransferSession,entryTransferSession,roleSession,'uniqmag-demo-invite','uniqmag-demo-code','uniqmag-demo-company'];
  const snapshotIdentity=()=>new Map(identityKeys.map(key=>[key,storedSession(key)]));
  function restoreIdentity(snapshot){for(const [key,value] of snapshot){if(value===null)sessionStorage.removeItem(key);else sessionStorage.setItem(key,value);}}
  L.esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  L.uid=p=>`${p||'id'}-${crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)}`;
  const paths={print:'M6 9V3h12v6 M6 18H3V9h18v9h-3 M6 14h12v7H6z M17 12h.01',grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',box:'m12 3 9 5v9l-9 5-9-5V8z M3 8l9 5 9-5 M12 13v9',image:'M3 3h18v18H3z M3 17l5-5 4 4 3-3 6 6 M8 7h.01',users:'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3 M13 3a4 4 0 0 1 0 8 M22 21v-3a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',template:'M4 3h16v18H4z M4 8h16 M10 8v13 M4 14h16',download:'M12 3v13 m-4-4 4 4 4-4 M4 16v5h16v-5',upload:'M12 16V3 m-4 4 4-4 4 4 M4 16v5h16v-5',plus:'M12 4v16 M4 12h16',arrow:'M4 12h16 m-6-6 6 6-6 6',back:'M20 12H4 m6-6-6 6 6 6',check:'m4 12 5 5L20 6',close:'m6 6 12 12 M6 18 18 6',search:'m21 21-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',link:'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2 M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2',clock:'M12 7v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',settings:'M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6',edit:'m16 3 5 5-12 12-6 1 1-6z M13 6l5 5',copy:'M8 8h13v13H8z M16 4V1H1v15h3',lock:'M5 10h14v11H5z M8 10V6a4 4 0 0 1 8 0v4 M12 14v3',alert:'m12 3 10 18H2z M12 9v5 M12 17h.01',info:'M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',file:'M5 2h9l5 5v15H5z M14 2v6h5 M8 12h8 M8 16h8',logout:'M9 3H3v18h6 M10 12h12 m-5-5 5 5-5 5',chevron:'m9 5 7 7-7 7',menu:'M3 6h18 M3 12h18 M3 18h18',list:'M8 5h13 M8 12h13 M8 19h13 M3 5h.01 M3 12h.01 M3 19h.01'};
  L.icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.box}"/></svg>`;
  L.safeURL=url=>/^(assets\/[\w./-]+|data:(?:image\/(?:png|jpeg|webp|gif)|video\/(?:mp4|webm)|application\/[\w.+-]+|text\/[\w.+-]+);base64,[A-Za-z0-9+/=]+|blob:[^<>"']+)$/.test(url||'')?url:'';
  L.image=(url,alt,cls='')=>L.safeURL(url)?`<img src="${L.esc(L.safeURL(url))}" alt="${L.esc(alt)}" class="${L.esc(cls)}" loading="lazy">`:`<span class="image-placeholder ${L.esc(cls)}">${L.icon('image')}<span>图片待补充</span></span>`;
  L.date=v=>v?new Date(v).toLocaleDateString('zh-CN'):'—';L.size=n=>!n?'网页素材':n>=1048576?(n/1048576).toFixed(1)+' MB':Math.ceil(n/1024)+' KB';
  let timer;L.toast=t=>{const el=document.getElementById('toast');el.textContent=t;el.classList.add('visible');clearTimeout(timer);timer=setTimeout(()=>el.classList.remove('visible'),4500);};
  L.clearToast=()=>{clearTimeout(timer);const el=document.getElementById('toast');el.classList.remove('visible');el.textContent='';};
  L.readFile=file=>new Promise((resolve,reject)=>{if(file.size>12*1024*1024)return reject(new Error('演示版单个文件上限为 12 MB。'));const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('文件读取失败，请重试。'));r.readAsDataURL(file);});
  L.download=(blob,filename,authorization)=>{if(!L.isStaff()){if(!authorization||!['download','export'].includes(authorization.action))throw new Error('此文件需要有效的邀请授权。');L.requireInvitePermission(authorization.invite,authorization.action);}const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename.replace(/[<>:"/\\|?*]/g,'_');document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),10000);};
  L.downloadURL=async(url,name)=>{if(!L.isStaff())throw new Error('文件下载仅限内部人员。');if(!L.safeURL(url)&&!/^data:[\w+./-]+;base64,[A-Za-z0-9+/=]+$/.test(url||''))throw new Error('文件地址不可用。');const r=await fetch(url);if(!r.ok)throw new Error('文件下载失败。');const raw=await r.blob();if(!L.isStaff())throw new Error('当前身份不可下载文件。');const ext=(name||url).split('.').pop().toLowerCase(),mime={webp:'image/webp',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',pdf:'application/pdf'}[ext];L.download(mime?new Blob([raw],{type:mime}):raw,name);};
  L.closeModal=()=>{document.querySelectorAll('dialog.library-dialog').forEach(d=>{d.close();d.remove();});};
  L.modal=(title,html,options={})=>{L.closeModal();const previous=document.activeElement,d=document.createElement('dialog');d.className='library-dialog'+(options.wide?' wide':'');d.setAttribute('aria-labelledby','modal-title');d.innerHTML=`<div class="modal-heading"><h2 id="modal-title">${L.esc(title)}</h2><button type="button" class="icon-btn" data-modal-close aria-label="关闭">${L.icon('close')}</button></div><div class="modal-body">${html}</div>`;document.body.append(d);d.querySelector('[data-modal-close]').onclick=()=>d.close();d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});d.addEventListener('close',()=>{d.remove();if(previous?.isConnected)previous.focus();});d.showModal();return d;};
  L.confirm=(title,message,onConfirm)=>{const d=L.modal(title,`<p>${L.esc(message)}</p><div class="modal-actions"><button class="btn" data-no>取消</button><button class="btn primary" data-yes>确认</button></div>`);d.querySelector('[data-no]').onclick=()=>d.close();d.querySelector('[data-yes]').onclick=async()=>{d.querySelector('[data-yes]').disabled=true;try{await onConfirm();if(d.isConnected)d.close();}catch(e){L.toast(e.message);if(d.isConnected)d.querySelector('[data-yes]').disabled=false;}};};
  L.routeURL=route=>{const raw=String(route||'products').replace(/^#?\//,''),split=raw.indexOf('?'),page=split<0?raw:raw.slice(0,split),params=new URLSearchParams(split<0?'':raw.slice(split+1));if(['login','access','workspaces'].includes(page)){if(page==='workspaces'||!params.has('code'))params.delete('company');}else if(!params.has('company'))params.set('company',activeCompanyId);const query=params.toString();return '#/'+page+(query?'?'+query:'');};
  L.decorateCompanyLinks=root=>{if(!root)return;const decorate=anchor=>{const href=anchor.getAttribute('href');if(href?.startsWith('#/')){const next=L.routeURL(href);if(next!==href)anchor.setAttribute('href',next);}};if(root.matches?.('a[href]'))decorate(root);root.querySelectorAll?.('a[href^="#/"]').forEach(decorate);};
  L.register=(name,route)=>L.routes[name]=route;L.go=route=>{const hash=L.routeURL(route);if(location.hash===hash)L.render();else location.hash=hash;};
  L.pageBanner=({eyebrow,title,description,actions='',aside='',variant=''})=>{const dashboard=L.isStaff()?L.bannerDashboard?.()||'':'';const content=dashboard||aside;return `<section class="workspace-banner${variant==='image'?' workspace-banner-image':''}${dashboard?' has-dashboard':''}" aria-labelledby="page-banner-title"><div class="workspace-banner-copy"><p class="workspace-banner-eyebrow">${L.esc(eyebrow)}</p><h1 id="page-banner-title">${L.esc(title)}</h1><p class="workspace-banner-description">${L.esc(description)}</p>${actions?`<div class="workspace-banner-actions">${actions}</div>`:''}</div>${content?`<div class="workspace-banner-aside">${content}</div>`:''}</section>`;};
  L.normalizeRole=role=>['operator','contact'].includes(role)?'business':['admin','business','customer'].includes(role)?role:'customer';
  L.currentMember=()=>{if(storedSession(memberCompanySession)!==activeCompanyId)return null;const id=storedSession(memberSession);return (L.state?.team||[]).find(member=>member.id===id&&activeMember(member))||null;};
  L.currentRole=()=>L.currentMember()?.role||'customer';
  L.roleName=role=>({admin:'管理员',business:'业务人员',customer:'客户'}[L.normalizeRole(role)]);
  L.isStaff=()=>['admin','business'].includes(L.currentRole());
  L.can=action=>L.currentRole()==='admin'||(L.currentRole()==='business'&&['edit','upload','publish','invites','export','internal-download'].includes(action))||(action==='export'&&L.hasInvitePermission?.(L.currentInvite(),'export')===true);
  L.log=(action,target)=>{const member=L.currentMember();L.state.logs.unshift({id:L.uid('log'),action,target,time:new Date().toISOString(),actor:member?member.name+' · '+L.roleName(member.role):'客户（演示）'});};
  L.switchRole=async()=>{throw new Error('员工身份由管理员分配，请使用员工账号登录。');};
  async function discardUnsaved(title){
    if(!L.isDirty?.())return true;
    return new Promise(resolve=>{const d=L.modal(title,'<p>本页还有未保存的编辑。继续后将放弃这些编辑。</p><div class="modal-actions"><button class="btn" data-stay>继续编辑</button><button class="btn danger" data-continue>放弃编辑并继续</button></div>');let accepted=false;d.querySelector('[data-stay]').onclick=()=>d.close();d.querySelector('[data-continue]').onclick=()=>{accepted=true;d.close();};d.addEventListener('close',()=>resolve(accepted),{once:true});});
  }
  let changingIdentity=false,entryPending=false,leavingDocument=false;
  async function identityEntry(run){
    if(leavingDocument||entryPending||changingIdentity||changingCompany)throw new Error('正在更新登录状态，请稍候。');
    entryPending=true;try{return await run();}finally{entryPending=false;}
  }
  const matchingEmployees=(state,key,loginOnly=false)=>(state.team||[]).filter(member=>loginKey(member.login)===key||!loginOnly&&!!loginKey(member.email)&&loginKey(member.email)===key);
  function requireEmployee(state,key,memberId,loginOnly=false){
    const matches=matchingEmployees(state,key,loginOnly);
    if(matches.length!==1)throw new Error(matches.length?'此账号对应多个员工，请联系管理员调整。':'未找到此员工账号，请联系管理员。');
    if(!activeMember(matches[0]))throw new Error('此员工账号已停用或未分配内部身份，请联系管理员。');
    if(memberId&&matches[0].id!==memberId)throw new Error('员工账号已变化，请重新登录。');
    return matches[0];
  }
  async function establishIdentity({role,action,target,actor,validate,commit}){
    if(changingIdentity)throw new Error('正在更新登录状态，请稍候。');
    if(!await discardUnsaved('切换登录账号'))throw new Error('已取消登录，当前编辑已保留。');
    if(changingIdentity)throw new Error('正在更新登录状态，请稍候。');
    changingIdentity=true;const previousRole=L.state.role,snapshot=snapshotIdentity(),logId=L.uid('log');
    L.state.role=role;L.state.logs.unshift({id:logId,action,target,time:new Date().toISOString(),actor});
    try{await L.save();const identity=validate();commit(identity);sessionStorage.removeItem(roleSession);sessionStorage.setItem(companySession,activeCompanyId);L.state.role=L.currentRole();L.selection.clear();L.clearToast();L.isDirty=null;L.closeModal();return identity;}
    catch(error){L.state.role=previousRole;L.state.logs=L.state.logs.filter(entry=>entry.id!==logId);try{restoreIdentity(snapshot);}catch{}throw error;}
    finally{changingIdentity=false;}
  }
  L.loginEmployee=(identifier,password)=>identityEntry(async()=>{
    if(typeof password!=='string'||!password)throw new Error('请输入密码。');
    if(password!=='demo2026')throw new Error('演示密码不正确，请使用下方提供的演示密码。');
    const key=loginKey(identifier);if(!key)throw new Error('请输入员工账号或邮箱。');
    // An explicitly disabled or ambiguous local account must not become a different company's account.
    if(matchingEmployees(L.state,key).length){
      const member=requireEmployee(L.state,key),memberId=member.id;
      return establishIdentity({role:member.role,action:'员工登录',target:member.name,actor:member.name+' · '+L.roleName(member.role),validate:()=>requireEmployee(L.state,key,memberId),commit:current=>{clearInviteSession();clearEmployeeSession();sessionStorage.setItem(memberCompanySession,activeCompanyId);sessionStorage.setItem(memberSession,current.id);}});
    }
    const candidates=[];
    for(const company of Object.values(companies)){if(company.id===activeCompanyId)continue;const state=await readCompanyWorkspace(company.id);if(matchingEmployees(state,key).length)candidates.push({company,member:requireEmployee(state,key)});}
    if(candidates.length!==1)throw new Error(candidates.length?'此账号对应多个员工，请联系管理员调整。':'未找到此员工账号，请联系管理员。');
    const {company,member}=candidates[0],proof={kind:'employee',companyId:company.id,memberId:member.id,login:member.login,identifier:key};
    return transferEntry(proof,async()=>{const current=requireEmployee(await readCompanyWorkspace(company.id),key,proof.memberId);if(loginKey(current.login)!==loginKey(proof.login))throw new Error('员工账号已变化，请重新登录。');});
  });
  async function enterCustomerIdentity(invite,extraValidate=()=>{}){
    const inviteId=invite?.id,inviteCode=invite?.code;
    const resolve=()=>{extraValidate();const current=L.state.invites.find(item=>item.id===inviteId&&item.code===inviteCode);if(!L.inviteValid(current))throw new Error('此邀请已失效，请联系对接人员。');return current;};
    const current=resolve();
    return establishIdentity({role:'customer',action:'演示邀请访问',target:current.company,actor:'客户（演示）',validate:resolve,commit:item=>{clearEmployeeSession();clearInviteSession();sessionStorage.setItem('uniqmag-demo-company',activeCompanyId);sessionStorage.setItem('uniqmag-demo-invite',item.id);sessionStorage.setItem('uniqmag-demo-code',item.code);}});
  }
  L.enterCustomer=invite=>identityEntry(()=>enterCustomerIdentity(invite));
  L.loginCustomer=(code,companyHint)=>identityEntry(async()=>{
    const key=loginKey(code);if(!key)throw new Error('请输入邀请码。');
    if(companyHint&&!hasOwn(companies,companyHint))throw new Error('邀请所属公司不存在，请向对接人员索取新链接。');
    const candidates=[];
    for(const company of Object.values(companies)){
      if(companyHint&&company.id!==companyHint)continue;
      const state=await readCompanyWorkspace(company.id);
      for(const invite of state.invites||[])if(loginKey(invite.code)===key)candidates.push({company,invite});
    }
    if(candidates.length!==1)throw new Error(candidates.length?'此邀请码对应多个邀请，请使用对接人员提供的完整邀请链接。':'未找到此邀请码，请核对后重试。');
    const {company,invite}=candidates[0];if(!L.inviteValid(invite))throw new Error('此邀请已失效，请联系对接人员。');
    if(company.id===activeCompanyId)return enterCustomerIdentity(invite);
    const proof={kind:'customer',companyId:company.id,inviteId:invite.id,code:invite.code};
    return transferEntry(proof,async()=>{const state=await readCompanyWorkspace(company.id),matches=(state.invites||[]).filter(item=>loginKey(item.code)===key);if(matches.length!==1||matches[0].id!==proof.inviteId||matches[0].code!==proof.code||!L.inviteValid(matches[0]))throw new Error('此邀请已失效，请联系对接人员。');});
  });
  L.employeeCompanies=async()=>{
    const member=L.currentMember();if(!member)throw new Error('请先使用员工账号登录。');
    const sourceId=member.id,key=loginKey(member.login),choices=[];
    for(const company of Object.values(companies)){
      const state=await readCompanyWorkspace(company.id),matches=matchingEmployees(state,key,true);
      if(matches.length===1&&activeMember(matches[0]))choices.push({id:company.id,name:company.name,logo:company.logo,role:matches[0].role,memberId:matches[0].id});
    }
    const current=L.currentMember();if(!current||current.id!==sourceId||loginKey(current.login)!==key)throw new Error('员工账号已停用或登录状态已改变，请重新登录。');
    companyChoices={sourceId,key,members:new Map(choices.map(item=>[item.id,item.memberId]))};return choices;
  };
  L.logout=()=>identityEntry(async()=>{
    if(!await discardUnsaved('退出登录'))return false;
    const member=L.currentMember();clearEmployeeSession();clearInviteSession();L.selection.clear();L.clearToast();L.isDirty=null;L.closeModal();L.state.role='customer';
    if(member){L.state.logs.unshift({id:L.uid('log'),action:'员工退出',target:member.name,time:new Date().toISOString(),actor:member.name+' · '+L.roleName(member.role)});try{await L.save();}catch{L.toast('已退出，操作记录暂未保存。');}}
    return true;
  });
  function migrateRoles(state){
    let changed=false;
    const role=L.normalizeRole(state.role);if(role!==state.role){state.role=role;changed=true;}
    const reserved=new Set((state.team||[]).flatMap(person=>[person.login,person.email]).map(loginKey).filter(Boolean));
    for(const person of state.team||[]){
      if(['operator','contact'].includes(person.role)){person.role='business';changed=true;}
      if(!loginKey(person.login)){const base=person.id==='staff-admin'?'admin':person.id==='staff-business'?'sales':loginKey(person.id).replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'employee';let login=base,n=2;while(reserved.has(loginKey(login)))login=base+'-'+n++;person.login=login;reserved.add(loginKey(login));changed=true;}
    }
    for(const invite of state.invites||[]){for(const key of ['allowDownload','allowExport'])if(typeof invite[key]!=='boolean'){invite[key]=false;changed=true;}if(!Array.isArray(invite.templateIds)){invite.templateIds=[];changed=true;}}
    return changed;
  }
  const categoryDefaults=(id=activeCompanyId)=>id==='unico'?[...(catalogFor(id)?.categories||[]),{id:'other',name:'其他产品'}]:[{id:'keyboard',name:'键盘'},{id:'controller',name:'游戏控制器'},{id:'tv',name:'游戏电视棒'},{id:'other',name:'其他产品'}];
  L.categoryKey=p=>String(p?.category??'').trim()||'other';
  L.getCategories=()=>{
    const list=[],seen=new Set();
    const add=(id,name)=>{id=String(id??'').trim();if(!id||seen.has(id))return;seen.add(id);list.push({id,name:String(name??'').trim()||id,builtin:categoryDefaults().some(c=>c.id===id)});};
    (Array.isArray(L.state?.categories)?L.state.categories:[]).forEach(c=>{if(c&&typeof c==='object')add(c.id,c.name);});
    categoryDefaults().forEach(c=>add(c.id,c.name));
    (L.state?.products||[]).forEach(p=>{[p,p.liveSnapshot].filter(Boolean).forEach(v=>add(L.categoryKey(v),v.categoryLabel||v.category));});
    return list;
  };
  L.categoryName=value=>{const id=typeof value==='object'?L.categoryKey(value):String(value??'').trim()||'other';return L.getCategories().find(c=>c.id===id)?.name||String(value?.categoryLabel||id);};
  L.categoryUsage=id=>({products:(L.state?.products||[]).filter(p=>L.categoryKey(p)===id).length,snapshots:(L.state?.products||[]).filter(p=>p.liveSnapshot&&L.categoryKey(p.liveSnapshot)===id).length});
  let savingCategories=false;
  L.saveCategories=async items=>{
    if(!L.can('categories'))throw new Error('仅管理员可以管理分类。');
    if(savingCategories)throw new Error('分类正在保存，请稍候。');
    if(!Array.isArray(items))throw new Error('分类格式不正确。');
    const ids=new Set(),names=new Set(),next=items.map(c=>{
      const id=String(c?.id??'').trim(),name=String(c?.name??'').trim(),normalized=name.normalize('NFKC').toLocaleLowerCase();
      if(!id||ids.has(id))throw new Error('分类标识重复或为空，请重新打开后重试。');
      if(!name||[...name].length>30)throw new Error('分类名称需要填写 1–30 个字符。');
      if(names.has(normalized))throw new Error('分类名称不能重复。');
      ids.add(id);names.add(normalized);return {id,name};
    });
    for(const c of L.getCategories()){
      const used=L.categoryUsage(c.id);
      if(!ids.has(c.id)&&(c.builtin||used.products||used.snapshots))throw new Error(c.builtin?'系统分类需要保留，可修改名称。':'此分类仍有关联产品或发布版本，暂时不能删除。');
    }
    const previous=L.state.categories,hadCategories=Object.prototype.hasOwnProperty.call(L.state,'categories'),previousLogs=L.state.logs.slice();
    const logId=L.uid('log');savingCategories=true;L.state.categories=next;
    L.state.logs.unshift({id:logId,action:'管理产品分类',target:next.length+' 个分类',time:new Date().toISOString(),actor:'管理员（演示）'});
    try{await L.save();}catch(error){if(hadCategories)L.state.categories=previous;else delete L.state.categories;const otherLogs=L.state.logs.filter(entry=>entry.id!==logId&&!previousLogs.some(old=>old.id===entry.id));L.state.logs=[...otherLogs,...previousLogs];throw error;}finally{savingCategories=false;}
    return L.getCategories();
  };
  L.publishProduct=p=>{p.status='published';p.isLive=true;p.updatedAt=new Date().toISOString();const s={...p};delete s.liveSnapshot;p.liveSnapshot=structuredClone(s);};
  L.unpublishProduct=p=>{p.status='archived';p.isLive=false;p.updatedAt=new Date().toISOString();};
  L.inviteValid=i=>!!i&&i.status==='active'&&new Date(i.expiresAt).getTime()>Date.now();
  L.liveProducts=invite=>L.state.products.filter(p=>p.isLive&&p.liveSnapshot&&(!invite||(invite.productIds||[]).includes(p.id))).map(p=>structuredClone(p.liveSnapshot));
  L.currentInvite=()=>{if(L.currentMember())return undefined;const company=storedSession('uniqmag-demo-company')||'uniqmag';return company===activeCompanyId?(L.state?.invites||[]).find(i=>i.id===storedSession('uniqmag-demo-invite')&&i.code===storedSession('uniqmag-demo-code')):undefined;};
  L.requireInvitePermission=(invite,action)=>{
    if(!['download','export'].includes(action))throw new Error('邀请权限类型无效。');
    const current=L.currentInvite();
    if(L.currentRole()!=='customer'||!L.inviteValid(current)||!invite||current.id!==invite.id||current.code!==invite.code)throw new Error('邀请已失效或当前访问身份已改变，请重新进入资料库。');
    if(current[action==='download'?'allowDownload':'allowExport']!==true)throw new Error(action==='download'?'此邀请未允许素材下载。':'此邀请未允许表格导出。');
    return current;
  };
  L.hasInvitePermission=(invite,action)=>{try{L.requireInvitePermission(invite,action);return true;}catch{return false;}};
  L.portalAssets=(invite,pid,sku)=>{
    const current=L.state.invites.find(i=>i.id===invite?.id),session=L.isStaff()?current:L.currentInvite();
    if(!L.inviteValid(current)||current.code!==invite?.code||!session||session.id!==current.id||session.code!==current.code||!L.liveProducts(current).some(p=>p.id===pid))return [];
    return L.state.assets.filter(a=>{
      const productIds=a.productIds||[],matchesProduct=current.assetScope==='products'?productIds.includes(pid):(!productIds.length||productIds.includes(pid))&&(current.assetIds||[]).includes(a.id);
      return a.status==='published'&&matchesProduct&&(!(a.skuIds||[]).length||!sku||a.skuIds.includes(sku));
    });
  };
  let db,templateBaseline=[],pendingSave=null,saveQueue=Promise.resolve();
  const storageTimeout=15000;
  const database=(id=activeCompanyId)=>new Promise((resolve,reject)=>{
    let settled=false;const q=indexedDB.open(companies[id].database,1);
    const finish=(error,connection)=>{if(settled){connection?.close?.();return;}settled=true;clearTimeout(timeout);if(error)reject(error);else resolve(connection);};
    const timeout=setTimeout(()=>finish(new Error('浏览器存储响应超时。请关闭其他产品库标签页后重试，不要清除网站数据。')),storageTimeout);
    q.onupgradeneeded=()=>{if(settled){try{q.transaction?.abort();}catch{}return;}q.result.createObjectStore('state');};
    q.onblocked=()=>finish(new Error('浏览器存储被其他产品库页面占用。请关闭其他产品库标签页后重试。'));
    q.onerror=()=>finish(new Error('无法打开浏览器存储。请允许本网站使用存储后重试。'));
    q.onsuccess=()=>finish(null,q.result);
  });
  const readWorkspace=connection=>new Promise((resolve,reject)=>{
    const tx=connection.transaction('state'),q=tx.objectStore('state').get('workspace');let settled=false;
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timeout);if(error)reject(error);else resolve(value);};
    const timeout=setTimeout(()=>{finish(new Error('读取本机资料超时。请关闭其他产品库标签页后重试，不要清除网站数据。'));try{tx.abort();}catch{}},storageTimeout);
    q.onsuccess=()=>finish(null,q.result);q.onerror=()=>finish(new Error('本机资料暂时无法读取，请重试。'));
    tx.onabort=()=>finish(new Error('读取本机资料被中止，请重试。'));tx.onerror=()=>finish(new Error('本机资料暂时无法读取，请重试。'));
  });
  async function readCompanyWorkspace(id){
    if(id===activeCompanyId)return L.state;
    const connection=await database(id);
    try{const state=await readWorkspace(connection);
      if(state&&state.schemaVersion!==1)throw new Error('公司资料版本暂不兼容，请先打开该公司检查。');
      const snapshot=state||seed(id);migrateRoles(snapshot);return snapshot;
    }finally{connection.close?.();}
  }
  const sameTemplate=(a,b)=>{
    if(a===b)return true;
    if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
    const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.prototype.hasOwnProperty.call(b,k)&&sameTemplate(a[k],b[k]));
  };
  const templateMap=items=>{
    if(!Array.isArray(items))throw new Error('模板记录格式不正确，请重新打开页面后重试。');
    const map=new Map();for(const item of items){if(!item?.id||map.has(item.id))throw new Error('模板标识重复或为空，请重新打开页面后重试。');map.set(item.id,item);}return map;
  };
  function mergeTemplates(base,local,remote){
    const before=templateMap(base),ours=templateMap(local),theirs=templateMap(remote),merged=[];
    for(const id of new Set([...ours.keys(),...theirs.keys(),...before.keys()])){
      const b=before.get(id),l=ours.get(id),r=theirs.get(id);
      if(!sameTemplate(l,b)&&!sameTemplate(r,b)&&!sameTemplate(l,r))throw new Error(`模板“${l?.name||r?.name||b?.name||id}”已在其他标签页修改，本次保存未覆盖任何资料。请先保留当前编辑，再刷新页面核对。`);
      const value=sameTemplate(l,b)?r:l;if(value)merged.push(structuredClone(value));
    }
    return merged;
  }
  function acceptSavedTemplates(captured,saved){
    const before=templateMap(captured),current=templateMap(L.state.templates),stored=templateMap(saved),next=[],baseline=[];
    for(const id of new Set([...current.keys(),...stored.keys(),...before.keys()])){
      const b=before.get(id),l=current.get(id),r=stored.get(id),unchanged=sameTemplate(l,b);
      const value=unchanged?r:l;if(value)next.push(structuredClone(value));
      // An edit made while saving must still detect an unseen remote change on its next save.
      const reference=!unchanged&&!sameTemplate(r,b)&&!sameTemplate(r,l)?b:r;if(reference)baseline.push(structuredClone(reference));
    }
    L.state.templates=next;templateBaseline=baseline;
  }
  L.save=async()=>{
    if(!db)throw new Error('浏览器保存不可用，请允许网站使用存储后重试。');
    L.state.logs=L.state.logs.slice(0,300);
    const job={snapshot:structuredClone(L.state),baseline:templateBaseline,previous:pendingSave,database:db,state:L.state};pendingSave=job;
    const run=saveQueue.then(()=>{
      // Rebase queued snapshots against their own predecessor, not a newer global baseline.
      let ancestor=job.previous;while(ancestor&&!ancestor.saved)ancestor=ancestor.previous;
      const base=ancestor?ancestor.saved:job.baseline;
      const local=ancestor?mergeTemplates(ancestor.snapshot.templates,job.snapshot.templates,ancestor.saved):job.snapshot.templates;
      return new Promise((resolve,reject)=>{
        const tx=job.database.transaction('state','readwrite'),store=tx.objectStore('state');let failure,merged,settled=false;
        const timeout=setTimeout(()=>{if(settled)return;settled=true;failure=new Error('保存本机资料超时，请关闭其他产品库标签页后重试。');try{tx.abort();}catch{}reject(failure);},storageTimeout*2);
        tx.oncomplete=()=>{if(settled)return;settled=true;clearTimeout(timeout);job.saved=merged;if(L.state===job.state&&db===job.database){try{acceptSavedTemplates(job.snapshot.templates,merged);}catch(error){L.toast(error.message);}}resolve();};
        tx.onerror=()=>{failure=failure||new Error('本机保存失败，可能空间不足，请减少大文件后重试。');};
        tx.onabort=()=>{if(settled)return;settled=true;clearTimeout(timeout);reject(failure||new Error('保存未完成，请重试。'));};
        // Read and merge within the same write transaction so another tab cannot race this put.
        const read=store.get('workspace');read.onsuccess=()=>{
          if(settled)return;try{merged=mergeTemplates(base,local,read.result?.templates||[]);store.put({...job.snapshot,templates:merged},'workspace');}
          catch(error){failure=error;tx.abort();}
        };
      });
    });
    saveQueue=run.catch(()=>{});const finish=()=>{if(pendingSave===job)pendingSave=null;};run.then(finish,finish);return run;
  };
  function seed(id=activeCompanyId){
    const catalog=catalogFor(id);if(!Array.isArray(catalog?.products))throw new Error('当前公司的产品资料尚未加载，请刷新后重试。');
    const products=structuredClone(catalog.products).map(p=>({...p,status:'published',isLive:true,liveSnapshot:structuredClone(p),updatedAt:'2026-10-10T00:00:00Z',details:p.details||[]}));const assets=[];const byUrl=new Map();
    function asset(url,p,v,usage){if(!url)return;let a=byUrl.get(url);if(!a){const media=catalog.media?.[url],original=media?.originalUrl||url;a={id:'asset-'+(assets.length+1),name:`${p.name} ${usage} ${v?.colorLabel||v?.color||''}`.trim()+'.'+original.split('.').pop(),url,type:'image',mime:media?.mime||(url.endsWith('.png')?'image/png':'image/webp'),size:media?.originalSize||media?.size||0,productIds:[],skuIds:[],usage,language:'通用',status:'published',version:1,updatedAt:'2026-10-10T00:00:00Z',downloadable:true};if(media?.originalUrl){a.originalUrl=media.originalUrl;a.originalMime=media.originalMime;a.originalSize=media.originalSize;}byUrl.set(url,a);assets.push(a);}if(!a.productIds.includes(p.id))a.productIds.push(p.id);if(v&&!a.skuIds.includes(v.id))a.skuIds.push(v.id);}
    products.forEach(p=>{
      p.variants.forEach(v=>{v.images.forEach(x=>asset(x,p,v,'产品图'));asset(v.barcodeImage,p,v,'条码图');});
      p.packaging.forEach(x=>{asset(x.image,p,x.appliesTo?p.variants.find(v=>v.id===x.appliesTo):null,'包装图');if(x.image&&!x.appliesTo){const a=byUrl.get(x.image);p.variants.forEach(v=>{if(!a.skuIds.includes(v.id))a.skuIds.push(v.id);});}});
      (p.contentImages||[]).forEach(item=>{if(!item?.url)return;asset(item.url,p,null,'detail');const record=byUrl.get(item.url),extension=(record.originalUrl||record.url).split('.').pop();record.name=String(item.title||p.name+' 详情资料')+'.'+extension;if(item.source)record.source=structuredClone(item.source);});
    });assets.forEach(a=>a.usage=({'产品图':'product','条码图':'barcode','包装图':'packaging'}[a.usage]||a.usage));
    const templates=[{id:'tpl-catalog',name:'图文产品目录',kind:'catalog',status:'published',version:1,description:'把产品、配色与关键规格排成一份清晰的图文目录。',language:'中文'},{id:'tpl-sku',name:'SKU 明细表',kind:'sku',status:'published',version:1,description:'每个配色一行，方便客户筛选货号与规格。',language:'中文'},{id:'tpl-packaging',name:'包装参数表',kind:'packaging',status:'published',version:1,description:'按实际 SKU 展开包装、尺寸、重量与适用范围。',language:'中文'}];
    const expiry=new Date(Date.now()+30*86400000).toISOString();
    const sampleProducts=products.slice(0,2).map(p=>p.id),prefix=id==='unico'?'UNICO':'UNIQ';
    const invites=[{id:'invite-demo',name:'完整资料体验',company:'演示客户 A',contact:'演示联系人',email:'',owner:'staff-business',code:prefix+'-DEMO',productIds:products.map(p=>p.id),assetIds:assets.map(a=>a.id),templateIds:[],assetScope:'products',allowDownload:false,allowExport:false,expiresAt:expiry,status:'active',createdAt:new Date().toISOString()},{id:'invite-view',name:'仅浏览体验',company:'演示客户 B',contact:'演示联系人',email:'',owner:'staff-business',code:prefix+'-VIEW',productIds:sampleProducts,assetIds:assets.filter(a=>a.productIds.some(p=>sampleProducts.includes(p))).map(a=>a.id),templateIds:[],assetScope:'products',allowDownload:false,allowExport:false,expiresAt:expiry,status:'active',createdAt:new Date().toISOString()}];
    invites.forEach(i=>i.owner='staff-business');return {schemaVersion:1,companyId:id,role:'customer',categories:categoryDefaults(id).filter((c,i,a)=>a.findIndex(x=>x.id===c.id)===i),products,assets,templates,invites,jobs:[],logs:[],team:[{id:'staff-admin',name:'管理员（演示）',login:'admin',email:'',role:'admin',status:'active'},{id:'staff-business',name:'业务人员（演示）',login:'sales',email:'',role:'business',status:'active'}]};
  }
  let changingCompany=false;
  async function transferEntry(proof,validate){
    if(!await discardUnsaved('切换登录账号'))throw new Error('已取消登录，当前编辑已保留。');
    await L.save();await validate();
    const snapshot=snapshotIdentity(),previousCompany=storedSession(companySession);
    try{
      clearEmployeeSession();clearInviteSession();
      sessionStorage.setItem(entryTransferSession,JSON.stringify({...proof,expiresAt:Date.now()+60000}));sessionStorage.setItem(companySession,proof.companyId);
      L.selection.clear();L.clearToast();L.isDirty=null;L.closeModal();
      window.dispatchEvent(new CustomEvent('companychange',{detail:{from:activeCompanyId,to:proof.companyId}}));
      leavingDocument=true;L.ready=false;history.replaceState(null,'',proof.kind==='employee'?'#/workspaces':'#/products?company='+encodeURIComponent(proof.companyId));location.reload();
      return {redirecting:true};
    }catch(error){restoreIdentity(snapshot);if(previousCompany===null)sessionStorage.removeItem(companySession);else sessionStorage.setItem(companySession,previousCompany);leavingDocument=false;L.ready=true;throw error;}
  }
  async function activateCompany(id,login,hash,expectedMemberId){
    if(changingCompany)return false;
    if(!hasOwn(companies,id))throw new Error('此公司主体不存在。');
    const source=L.currentMember(),sourceId=source?.id,key=loginKey(login);
    if(!source||loginKey(source.login)!==key)throw new Error('员工账号已停用或登录状态已改变，请重新登录。');
    changingCompany=true;document.getElementById('company-switcher-trigger')?.setAttribute('aria-busy','true');
    document.querySelectorAll('[data-switch-company]').forEach(button=>button.disabled=true);
    try{
      const target=requireEmployee(await readCompanyWorkspace(id),key,expectedMemberId,true),targetId=target.id;
      // Persist only the current workspace, then recheck both memberships before the document reload.
      await L.save();
      const current=L.currentMember();if(!current||current.id!==sourceId||loginKey(current.login)!==key)throw new Error('员工账号已停用或登录状态已改变，请重新登录。');
      requireEmployee(await readCompanyWorkspace(id),key,targetId,true);
      if(L.currentMember()?.id!==sourceId||loginKey(L.currentMember()?.login)!==key)throw new Error('员工账号已停用或登录状态已改变，请重新登录。');
      sessionStorage.setItem(companySession,id);clearEmployeeSession();
      sessionStorage.setItem(memberTransferSession,JSON.stringify({companyId:id,memberId:targetId,login,expiresAt:Date.now()+60000}));
      clearInviteSession();L.selection.clear();L.clearToast();L.isDirty=null;L.closeModal();
      window.dispatchEvent(new CustomEvent('companychange',{detail:{from:activeCompanyId,to:id}}));
      L.ready=false;history.replaceState(null,'',hash);location.reload();return true;
    }catch(error){changingCompany=false;document.getElementById('company-switcher-trigger')?.removeAttribute('aria-busy');document.querySelectorAll('[data-switch-company]').forEach(button=>button.disabled=false);throw error;}
  }
  L.switchCompany=(id,expectedMemberId)=>identityEntry(async()=>{
    if(!L.isStaff())throw new Error('客户仅可浏览邀请所属公司的资料。');
    if(!hasOwn(companies,id))throw new Error('此公司主体不存在。');
    const member=L.currentMember(),key=loginKey(member.login);
    if(companyChoices?.sourceId===member.id&&companyChoices.key===key){
      if(!companyChoices.members.has(id))throw new Error('当前员工账号未获该公司的访问权限。');
      expectedMemberId=expectedMemberId||companyChoices.members.get(id);
    }
    if(id===activeCompanyId){if(expectedMemberId&&expectedMemberId!==member.id)throw new Error('员工账号已变化，请重新登录。');return false;}
    if(!await discardUnsaved('切换公司主体'))return false;
    return activateCompany(id,member.login,'#/products?company='+encodeURIComponent(id),expectedMemberId);
  });
  function companyBrand(staff){
    const company=L.company();
    if(!staff)return `<a class="brand company-brand-static" href="#/products"><img src="${L.esc(company.logo)}" alt="${L.esc(company.name)}" data-company-logo="${company.id}"><span>PRODUCT LIBRARY</span></a>`;
    return `<div class="company-switcher"><button type="button" class="company-switcher-trigger" id="company-switcher-trigger" aria-label="切换公司主体，当前 ${L.esc(company.name)}" aria-expanded="false" aria-controls="company-switcher-menu"><span class="company-switcher-brand"><img src="${L.esc(company.logo)}" alt="${L.esc(company.name)}" data-company-logo="${company.id}">${L.icon('chevron')}</span><span class="company-switcher-caption">PRODUCT LIBRARY</span></button><div class="company-switcher-menu" id="company-switcher-menu" hidden><p class="company-switcher-label">切换公司主体</p><div role="group" aria-label="公司主体">${Object.values(companies).map(item=>`<button type="button" data-switch-company="${item.id}" class="company-switcher-option ${item.id===activeCompanyId?'selected':''}" aria-pressed="${item.id===activeCompanyId}"><span class="company-option-logo"><img src="${L.esc(item.logo)}" alt="" data-company-logo="${item.id}"></span><span>${L.esc(item.name)}</span>${item.id===activeCompanyId?L.icon('check'):'<span class="company-option-check"></span>'}</button>`).join('')}</div><p class="company-switcher-note">产品、素材与模板分别管理</p></div></div>`;
  }
  function bindCompanySwitcher(){
    const trigger=document.getElementById('company-switcher-trigger'),menu=document.getElementById('company-switcher-menu');if(!trigger||!menu)return;
    const toggle=open=>{menu.hidden=!open;trigger.setAttribute('aria-expanded',String(open));};
    trigger.onclick=()=>toggle(menu.hidden);
    trigger.onkeydown=event=>{if(event.key==='ArrowDown'){event.preventDefault();toggle(true);menu.querySelector('[data-switch-company]')?.focus();}};
    menu.onkeydown=event=>{if(event.key==='Escape'){toggle(false);trigger.focus();}};
    menu.querySelectorAll('[data-switch-company]').forEach(button=>button.onclick=async()=>{toggle(false);try{await L.switchCompany(button.dataset.switchCompany);}catch(error){L.toast(error.message);}});
  }
  function sidebarNavigation(route,params,staff,catalogRoute) {
    const link=(id,icon,label,{tab,permission,selection=false}={})=>{
      if(permission&&!L.can(permission))return '';
      const active=id==='products'?catalogRoute:route===id&&(!tab||(params.get('tab')||'new')===tab);
      return `<a class="nav-link ${active?'active':''}" href="#/${id}${tab==='history'?'?tab=history':''}" data-nav-route="${id}" ${tab?`data-nav-tab="${tab}"`:''} ${selection?'id="customer-selection"':''} ${active?'aria-current="page"':''}>${L.icon(icon)}<span>${label}</span>${selection?`<b>${L.selection.size||''}</b>`:''}</a>`;
    };
    let nav=`<p class="nav-caption">资料浏览</p>${link('products','grid','产品资料库')}`;
    if(staff){
      nav+=`<p class="nav-caption nav-group-caption">内容与客户</p>${link('assets','image','素材中心',{permission:'upload'})}${link('invites','link','客户与邀请',{permission:'invites'})}`;
      nav+=`<p class="nav-caption nav-group-caption">下载与导出</p>${link('downloads','download','资料下载',{permission:'export'})}${link('exports','template','导出表格',{tab:'new',permission:'export',selection:true})}${link('exports','clock','导出记录',{tab:'history',permission:'export'})}${link('templates','settings','导出模板',{permission:'templates'})}`;
      if(L.can('team')||L.can('activity'))nav+=`<p class="nav-caption nav-group-caption">系统管理</p>${link('team','users','账号与角色',{permission:'team'})}${link('activity','list','操作记录',{permission:'activity'})}`;
      nav+=`<a class="nav-link nav-preview-link" href="#/access?company=${L.companyId()}&code=${encodeURIComponent(L.state.invites.find(i=>i.id==='invite-demo')?.code||'')}">${L.icon('eye')}<span>客户预览</span></a>`;
    }
    else if(L.can('export'))nav+=`<p class="nav-caption nav-group-caption">下载与导出</p>${link('exports','template','导出表格',{tab:'new',permission:'export',selection:true})}`;
    return nav;
  }
  const routePermission={editor:'edit','detail-editor':'edit',assets:'upload',downloads:'internal-download',invites:'invites',templates:'templates',exports:'export',team:'team',activity:'activity'};
  let renderedHash=null;
  L.render=async()=>{
    if(!L.ready)return;
    const normalizedHash=L.routeURL(location.hash||'products');if(location.hash!==normalizedHash)history.replaceState(null,'',normalizedHash);
    if(renderedHash!==null&&location.hash!==renderedHash&&L.isDirty?.()){
      const requested=location.hash,d=L.modal('资料尚未保存','<p>离开后，本次未保存的编辑将丢失。已保存的资料不受影响。</p><div class="modal-actions"><button class="btn" data-stay>继续编辑</button><button class="btn danger" data-leave>放弃修改并离开</button></div>');let accepted=false;
      d.querySelector('[data-stay]').onclick=()=>d.close();d.querySelector('[data-leave]').onclick=()=>{accepted=true;L.isDirty=null;d.close();history.replaceState(null,'',requested);L.render();};d.addEventListener('close',()=>{if(!accepted)history.replaceState(null,'',renderedHash||'#/products');});return;
    }
    let raw=location.hash.replace(/^#\/?/,'')||'products';if(raw.split('?')[0]==='overview'){raw=raw.replace(/^overview/,'products');history.replaceState(null,'',L.routeURL(raw));}
    const [route,qs='']=raw.split('?'),params=new URLSearchParams(qs),staff=L.isStaff(),isEntry=['access','login','workspaces'].includes(route);
    const linkedCompany=params.get('company');
    if(!isEntry&&hasOwn(companies,linkedCompany)&&linkedCompany!==activeCompanyId){
      if(!staff){history.replaceState(null,'',L.routeURL('login'));return L.render();}
      try{if(entryPending||changingIdentity)throw new Error('正在更新登录状态，请稍候。');await activateCompany(linkedCompany,L.currentMember()?.login,location.hash);}catch(error){history.replaceState(null,'',renderedHash||L.routeURL('workspaces'));L.toast(error.message);}return;
    }
    if(route==='workspaces'&&!staff){history.replaceState(null,'',L.routeURL('login?mode=employee'));return L.render();}
    if(!staff&&!isEntry&&!L.inviteValid(L.currentInvite())){const employee=!!storedSession(memberSession);clearEmployeeSession();clearInviteSession();L.selection.clear();history.replaceState(null,'',L.routeURL('login'+(employee?'?mode=employee':'')));return L.render();}
    L.state.role=L.currentRole();
    renderedHash=location.hash;L.isDirty=null;L.closeModal();L.route=route;
    const denied=!!routePermission[route]&&!L.can(routePermission[route]),meta=L.routes[route],catalogRoute=['products','portal','product','editor','detail-editor'].includes(route);
    document.title=`${meta?.title||'产品资料库'} · ${isEntry?'UNIQMAG / UNICO':L.company().name}`;
    document.getElementById('app').classList.toggle('login-page',isEntry);
    const role=L.currentRole(),label=L.roleName(role),member=L.currentMember(),accountName=member?.name||label,invite=staff?null:L.currentInvite();
    document.getElementById('app').innerHTML=`<div class="demo-banner">${L.icon('info')}<span><strong>前端演示版</strong> · 修改仅保存在本浏览器，账号与邀请尚未连接服务器。</span><button id="demo-info">了解保存范围</button></div>${!isEntry?`<aside class="sidebar ${staff?'staff-sidebar':'customer-sidebar'}"><div class="sidebar-brand-row">${companyBrand(staff)}<button class="btn small sidebar-toggle" id="sidebar-toggle" aria-expanded="false" aria-controls="workspace-navigation">${L.icon('menu')}导航</button></div>${window.LibraryPreferences.controls()}<div class="sidebar-navigation" id="workspace-navigation"><nav aria-label="主要导航">${sidebarNavigation(route,params,staff,catalogRoute)}</nav></div><div class="sidebar-foot"><span class="status-dot"></span><div>${label}<small>${staff?'编辑资料、下载与导出':'按邀请范围查看资料'}</small></div></div></aside>`:''}<div class="workspace ${isEntry?'entry-workspace':''}"><header class="topbar"><div class="breadcrumb">${L.esc(isEntry?'UNIQMAG / UNICO':L.company().name)} <span>/</span> ${L.esc(meta?.title||'产品资料库')}</div><div class="top-actions">${isEntry?'<a class="btn small" href="#/login">登录</a>':`<button class="profile-button" id="role-button" aria-label="当前账号：${L.esc(accountName)}，${label}，返回登录"><span class="avatar">${L.esc(member?String(accountName).slice(0,1):'客')}</span><span>${L.esc(accountName)}${member?' · '+label:''}</span>${L.icon('chevron')}</button><button class="btn small" id="leave-account">退出</button>`}</div></header><main id="main" tabindex="-1">${!isEntry&&meta&&!meta.banner&&!denied?L.pageBanner({eyebrow:meta.eyebrow||L.company().name+' PRODUCT LIBRARY',title:meta.title,description:meta.subtitle||''}):''}<div id="route-view"></div></main><footer class="site-footer"><span>${L.esc(isEntry?'UNIQMAG / UNICO':L.company().name)} · 产品资料，井然有序</span><span>产品资料库 · 前端演示</span></footer></div>`;
    window.LibraryPreferences.attachBanner();bindCompanySwitcher();L.decorateCompanyLinks(document.getElementById('app'));
    document.getElementById('demo-info').onclick=()=>L.modal('当前版本的保存与权限','<div class="stack"><p>产品、上传文件、邀请和模板配置保存在当前浏览器，换设备不会同步。</p><p>管理员、业务人员和客户共用产品界面，按身份展示操作入口。客户按邀请范围浏览资料，素材下载和表格导出由邀请分别授权。当前角色和邀请仍为流程演示，正式身份认证、跨设备客户授权与文件保护需要后端接入。</p><p>固定模板可以生成真实 Excel；云端保存与公司模板保真套版由后端接入。</p></div>');
    document.getElementById('role-button')?.addEventListener('click',()=>L.go('login'+(staff?'?mode=employee':'')));
    document.getElementById('leave-account')?.addEventListener('click',async()=>{try{if(await L.logout())L.go('login');}catch(error){L.toast(error.message);}});
    document.getElementById('sidebar-toggle')?.addEventListener('click',event=>{const button=event.currentTarget,expanded=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(expanded));document.querySelector('.sidebar')?.classList.toggle('nav-expanded',expanded);});
    const el=document.getElementById('route-view');
    if(denied){el.innerHTML=`<div class="empty-state">${L.icon('lock')}<h2>当前身份没有此操作权限</h2><p>可返回产品资料库继续浏览。</p><a class="btn primary" href="#/products">返回产品资料库</a></div>`;return;}
    try{if(meta)await meta.render(el,params);else el.innerHTML=`<div class="empty-state">${L.icon('search')}<h2>这个页面不存在</h2><a class="btn primary" href="#/products">返回产品资料库</a></div>`;}catch(error){console.error(error);el.innerHTML=`<div class="empty-state"><h2>页面暂未打开</h2><p>${L.esc(error.message)}</p><button class="btn" id="retry-route">重新加载</button></div>`;el.querySelector('button').onclick=L.render;}
    L.decorateCompanyLinks(el);
  };
  function startupFailure(error){
    L.ready=false;L.state=null;try{db?.close?.();}catch{}db=null;
    const app=document.getElementById('app');
    app.innerHTML=`<main class="empty-state" role="alert"><h1>产品资料库暂未打开</h1><p>${L.esc(error?.message||'加载暂时失败，请重试。')}</p><p>已有资料未被清除。请勿清除网站数据，以免丢失本机上传的素材和模板。</p><button type="button" class="btn primary" id="retry-startup">重新尝试</button></main>`;
    document.getElementById('retry-startup').onclick=()=>location.reload();
  }
  document.addEventListener('DOMContentLoaded',async()=>{
    // Verify session persistence before reading identities; unavailable storage must never imply a login.
    try{sessionStorage.setItem(companySession,activeCompanyId);if(sessionStorage.getItem(companySession)!==activeCompanyId)throw new Error();sessionStorage.removeItem(roleSession);}
    catch{startupFailure(new Error('浏览器已阻止会话存储，无法维持登录。请允许本网站使用存储，或使用普通浏览窗口后重试。'));return;}
    try{db=await database();const saved=await readWorkspace(db);if(saved&&saved.schemaVersion!==1)throw new Error('本机资料版本暂不兼容，请联系维护人员。');L.state=saved||seed();templateBaseline=structuredClone(saved?.templates||[]);if(migrateRoles(L.state)||!saved)await L.save();}
    catch(error){startupFailure(error);return;}
    try{
      sessionStorage.removeItem(roleSession);sessionStorage.setItem(companySession,activeCompanyId);
      let transfer,entry;try{transfer=JSON.parse(storedSession(memberTransferSession)||'null');}catch{}try{entry=JSON.parse(storedSession(entryTransferSession)||'null');}catch{}
      sessionStorage.removeItem(memberTransferSession);sessionStorage.removeItem(entryTransferSession);
      if(entry){
        clearEmployeeSession();clearInviteSession();
        const validateProof=()=>{if(entry.companyId!==activeCompanyId||!(entry.expiresAt>Date.now()))throw new Error('登录已过期，请重新登录。');if(entry.kind==='employee'&&(!entry.memberId||!loginKey(entry.login)||!loginKey(entry.identifier))||entry.kind==='customer'&&(!entry.inviteId||!entry.code))throw new Error('登录状态无效，请重新登录。');};
        try{
          validateProof();
          if(entry.kind==='employee'){
            const resolve=()=>{validateProof();const member=requireEmployee(L.state,entry.identifier,entry.memberId);if(loginKey(member.login)!==loginKey(entry.login))throw new Error('员工账号已变化，请重新登录。');return member;},member=resolve();
            await establishIdentity({role:member.role,action:'员工登录',target:member.name,actor:member.name+' · '+L.roleName(member.role),validate:resolve,commit:current=>{sessionStorage.setItem(memberCompanySession,activeCompanyId);sessionStorage.setItem(memberSession,current.id);}});
            history.replaceState(null,'',L.routeURL('workspaces'));
          }else if(entry.kind==='customer'){
            const matches=(L.state.invites||[]).filter(item=>loginKey(item.code)===loginKey(entry.code));
            if(matches.length!==1||matches[0].id!==entry.inviteId||matches[0].code!==entry.code)throw new Error('此邀请已失效，请联系对接人员。');
            await enterCustomerIdentity(matches[0],validateProof);history.replaceState(null,'',L.routeURL('products'));
          }else throw new Error('登录状态无效，请重新登录。');
        }catch(error){clearEmployeeSession();clearInviteSession();history.replaceState(null,'',L.routeURL('login'+(entry.kind==='employee'?'?mode=employee':'')));L.toast(error.message);}
      }else if(transfer){
        clearEmployeeSession();clearInviteSession();const matches=transfer.memberId&&transfer.companyId===activeCompanyId&&transfer.expiresAt>Date.now()?matchingEmployees(L.state,loginKey(transfer.login),true):[];
        if(matches.length===1&&matches[0].id===transfer.memberId&&activeMember(matches[0])){sessionStorage.setItem(memberCompanySession,activeCompanyId);sessionStorage.setItem(memberSession,matches[0].id);}
        else history.replaceState(null,'',L.routeURL('login?mode=employee'));
      }else if(storedSession(memberSession)&&!L.currentMember())clearEmployeeSession();
      L.state.role=L.currentRole();
    }catch{try{clearEmployeeSession();clearInviteSession();}catch{}startupFailure(new Error('登录状态无法保存。请允许本网站使用存储后重试。'));return;}
    if(typeof MutationObserver!=='undefined'){new MutationObserver(records=>{for(const record of records){if(record.type==='attributes')L.decorateCompanyLinks(record.target);else record.addedNodes.forEach(node=>L.decorateCompanyLinks(node));}}).observe(document.getElementById('app'),{childList:true,subtree:true,attributes:true,attributeFilter:['href']});}
    L.ready=true;await L.render();
  });
  document.addEventListener('click',event=>{const menu=document.getElementById('company-switcher-menu');if(menu&&!menu.hidden&&!event.target.closest?.('.company-switcher')){menu.hidden=true;document.getElementById('company-switcher-trigger')?.setAttribute('aria-expanded','false');}});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){const trigger=document.getElementById('company-switcher-trigger'),menu=document.getElementById('company-switcher-menu');if(menu&&!menu.hidden){menu.hidden=true;trigger?.setAttribute('aria-expanded','false');trigger?.focus();}}});
  addEventListener('hashchange',()=>{L.render();scrollTo({top:0,behavior:'instant'});});addEventListener('unhandledrejection',e=>L.toast(e.reason?.message||'操作未完成，请重试。'));
  addEventListener('beforeunload',e=>{if(L.isDirty?.()){e.preventDefault();e.returnValue='';}});
})();
