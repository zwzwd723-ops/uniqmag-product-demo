(() => {
  'use strict';
  const L = window.Library;
  const company=()=>L.company?.()||{id:'uniqmag',name:'UNIQMAG',logo:'assets/logo.png'};
  const assertCompany=id=>{if(company().id!==id)throw new Error('主体已切换，请在当前主体重新操作。');};
  const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const TYPES = {
    catalog: {name:'图文产品目录', subtitle:'把品牌、产品、配色与主要参数放在同一张表里。', headers:['产品图片','品牌','产品型号','SKU','颜色','产品类别','产品说明','主要参数'], widths:[23,17,17,20,19,19,42,65]},
    sku: {name:'SKU 配色清单', subtitle:'逐一列出品牌、型号与配色，方便核对产品范围。', headers:['产品图片','品牌','产品型号','SKU','颜色','产品类别','条码信息'], widths:[23,17,18,23,23,23,32]},
    packaging: {name:'包装资料表', subtitle:'按品牌与配色匹配适用包装，保留原始尺寸与待确认说明。', headers:['包装图片','品牌','产品型号','SKU','颜色','包装类型','包装说明','适用范围','资料状态'], widths:[23,17,17,20,20,20,65,26,18]}
  };
  const FIELD_NAMES = {image:'产品图片', brand:'品牌', name:'产品型号', sku:'SKU', color:'颜色', category:'产品类别', description:'产品说明', specs:'主要参数', packaging:'包装说明'};
  const fileLanguage = lang => L.documentLanguage?.normalize?.(lang) || (lang==='en'?'en':'zh-CN');
  const english = lang => fileLanguage(lang)==='en';
  const fileText = (text,lang) => L.documentLanguage?.t?.(text,fileLanguage(lang)) ?? text;
  const languageLabel = lang => english(lang)?'English':'中文';
  const documentType = (kind,lang) => ({...TYPES[kind],name:fileText(TYPES[kind].name,lang),subtitle:fileText(TYPES[kind].subtitle,lang),headers:TYPES[kind].headers.map(text=>fileText(text,lang))});
  const translatedPair = (p,v,lang) => ({p:L.documentLanguage?.product?.(p,fileLanguage(lang))||p,v:L.documentLanguage?.variant?.(v,fileLanguage(lang))||v});
  const scopeText = (products,variants,lang) => english(lang)?`${products} products / ${variants} variants`:`${products} 个产品 / ${variants} 个配色`;
  const productBrandName = p => L.productBrand?.(p)?.name || String(p.brand || '').trim();
  const activeJobs=new Set();
  const internalExport = () => ['admin','business'].includes(typeof L.currentRole==='function'?L.currentRole():L.state?.role);
  function requireInternalExport(invite=null) {
    if(!internalExport()||!L.can('export')||invite)throw new Error('公司模板原稿与配置仅供内部人员使用。');
  }
  function requireExport(invite=null) {
    if(internalExport()){
      if(!L.can('export'))throw new Error('当前身份没有表格导出权限。');
      if(!invite)return null;
      const current=L.state.invites.find(item=>item.id===invite.id);
      if(!L.inviteValid(current)||current.code!==invite.code||current.allowExport!==true)throw new Error('此邀请已失效或已关闭表格导出，请重新生成资料。');
      return current;
    }
    if(!L.requireInvitePermission)throw new Error('当前邀请未开放表格导出。');
    return L.requireInvitePermission(invite||L.currentInvite?.(),'export');
  }
  function downloadExport(blob,filename,invite) {
    const current=requireExport(invite);
    if(internalExport())L.download(blob,filename);
    else L.download(blob,filename,{invite:current,action:'export'});
  }
  function visibleJobs(invite=null) {
    const current=requireExport(invite);
    return L.state.jobs.filter(job=>(job.companyId||'uniqmag')===company().id&&(internalExport()||job.inviteId===current.id&&job.inviteCode===current.code));
  }
  const xml = v => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  const esc = v => L.esc(v ?? '');
  const safeError = e => e?.message || '操作未完成，请重试。';
  const now = () => new Date().toISOString();
  const fixed = t => !!TYPES[t.kind];
  const excelTemplates = () => L.state.templates.filter(t=>t&&!['print','print-settings','quotation-template','quotation-template-settings'].includes(t.kind));
  const nodeText = n => n?.textContent ?? '';
  const nodes = (d,n) => Array.from(d.getElementsByTagNameNS('*',n));
  function col(n) { let s=''; for(n++;n;n=Math.floor((n-1)/26)) s=String.fromCharCode(65+(n-1)%26)+s; return s; }
  function parseXML(s) { const d=new DOMParser().parseFromString(s,'application/xml'); if(d.getElementsByTagName('parsererror').length) throw new Error('Excel 内部文件格式有误，无法解析。'); return d; }
  const normalizeURL = url => { try{return new URL(url,location.href).href;}catch{return '';} };
  function resolveSelection(selection, invite) {
    const products=L.liveProducts(invite); const seen=new Set();
    return selection.map(s=>{ const p=products.find(x=>x.id===s.productId); const v=p?.variants?.find(x=>x.id===s.skuId); const key=`${s.productId}:${s.skuId}`; if(!p||!v||seen.has(key))return null; seen.add(key); return {p,v}; }).filter(Boolean);
  }
  function checkScope(selection, template, invite, language='zh-CN') {
    const current=requireExport(invite);
    const t=allowedTemplates(current).find(x=>x.id===template?.id);
    if(!t||t.status!=='published')throw new Error('所选模板已停用，请重新选择。');
    if(!fixed(t))throw new Error('上传模板已保存配置，保真生成需要接入服务端模板引擎。请选择固定模板。');
    const rows=resolveSelection(selection,current);
    if(!rows.length||rows.length!==selection.length)throw new Error('部分产品已下架或尚未发布，请重新选择。');
    return {invite:current,template:t,rows,language:fileLanguage(language)};
  }
  function assetFor(url,p,v,invite) {
    if(!url)return null;
    const key=normalizeURL(url);
    const assets=invite?L.portalAssets(invite,p.id,v.id):L.state.assets;
    return assets.find(a=>a.status==='published' && a.type==='image' && normalizeURL(a.url)===key && (!a.productIds?.length || a.productIds.includes(p.id)) && (!a.skuIds?.length || a.skuIds.includes(v.id))) || null;
  }
  function dataRows(rows,kind,invite,images=true,language='zh-CN') {
    invite=requireExport(invite);
    if(invite){const scoped=resolveSelection(rows.map(({p,v})=>({productId:p.id,skuId:v.id})),invite);if(scoped.length!==rows.length)throw new Error('部分产品不在当前邀请范围内，请重新选择。');rows=scoped;}
    const out=[];
    rows.forEach(({p,v})=>{
      const translated=translatedPair(p,v,language),display=translated.p,variant=translated.v;
      const brand=productBrandName(p), name=p.name??p.id, sku=v.sku??'', color=variant.colorLabel??variant.color??'', category=display.categoryLabel??display.category??'';
      const primary=(v.images||[]).find(u=>assetFor(u,p,v,invite));
      const asset=images&&primary?assetFor(primary,p,v,invite):null;
      if(kind==='packaging'){
        const packs=(display.packaging||[]).filter(a=>!a.appliesTo||a.appliesTo===v.sku||a.appliesTo===v.id);
        (packs.length?packs:[{title:'',text:'',image:null,pending:true}]).forEach(a=>{
          const image=images&&a.image?assetFor(a.image,p,v,invite):null;
          out.push({values:['',brand,name,sku,color,a.title??'',a.text??'',a.appliesTo??fileText('全部配色',language),a.pending?fileText('待确认',language):''],asset:image,p,v});
        });
      }else if(kind==='sku')out.push({values:['',brand,name,sku,color,category,v.barcode??v.ean??''],asset,p,v});
      else out.push({values:['',brand,name,sku,color,category,display.description??'',(display.specs||[]).map(s=>`${s.label??s.key??''}${english(language)?': ':'：'}${s.value??''}${s.pending?(english(language)?` (${fileText('待确认',language)})`:'（待确认）'):''}`).join('\n')],asset,p,v});
    });
    return out;
  }
  function tablePreview(rows,kind,limit=8,language='zh-CN') {
    const more=english(language)?`Previewing the first ${limit} rows. The download includes all ${rows.length} rows.`:`预览前 ${limit} 行，下载文件包含全部 ${rows.length} 行。`;
    return `<div class="ex-document-preview" data-no-translate lang="${fileLanguage(language)}"><div class="ex-preview-scroll"><table class="ex-preview-table"><thead><tr>${documentType(kind,language).headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0,limit).map(r=>`<tr>${r.values.map((v,i)=>`<td>${i===0?(r.asset?L.image(r.asset.url,r.p.name,''): `<span class="ex-no-image">${english(language)?'No embedded image':'不嵌入图片'}</span>`):esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${rows.length>limit?`<p class="ex-caption">${esc(more)}</p>`:''}</div>`;
  }
  function art(kind) {
    const t=TYPES[kind]||TYPES.catalog;
    const examples=L.liveProducts().slice(0,2);
    return `<div class="ex-sheet-art" aria-hidden="true"><div class="ex-sheet-paper"><b>${esc(company().name)} <span style="font-weight:400">/ ${esc(t.name)}</span></b><table><thead><tr>${t.headers.slice(0,5).map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${[0,1,2,3].map(r=>{const p=examples[Math.floor(r/2)];return `<tr><td><div class="ex-art-picture"></div></td><td>${esc(p?productBrandName(p):'')}</td><td>${esc(p?.name||p?.id||'······')}</td><td>······</td><td>······</td></tr>`;}).join('')}</tbody></table></div></div>`;
  }
  function failure(el,e) { const old=el.querySelector('.ex-error'); old?.remove(); const box=document.createElement('div');box.className='ex-error';box.setAttribute('role','alert');box.textContent=safeError(e);el.append(box); }
  async function pngAsset(asset) {
    return new Promise((resolve,reject)=>{
      const img=new Image(); img.crossOrigin='anonymous';
      img.onload=()=>{ try{const scale=Math.min(1,800/img.naturalWidth,650/img.naturalHeight),w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(img,0,0,w,h);resolve({data:canvas.toDataURL('image/png').split(',')[1],width:w,height:h});}catch(e){reject(new Error(`图片无法嵌入：${asset.name}。请检查素材或关闭图片选项。`));}};
      img.onerror=()=>reject(new Error(`图片无法读取：${asset.name}。请检查素材或关闭图片选项。`));img.src=asset.url;
    });
  }
  async function buildXlsx(rows,kind,metadata,progress=()=>{}) {
    let invite=requireExport(metadata.invite);
    const brand={...(metadata.company||company())},checkCompany=()=>{
      assertCompany(brand.id);invite=requireExport(invite);
      if(invite)for(const row of rows){
        const pair=resolveSelection([{productId:row.p?.id,skuId:row.v?.id}],invite)[0];
        if(!pair)throw new Error('产品已撤回或不在当前邀请范围内，请重新导出。');
        if(row.asset){const asset=assetFor(row.asset.url,pair.p,pair.v,invite);if(!asset||asset.id!==row.asset.id||String(asset.version)!==String(row.asset.version))throw new Error('素材授权或版本已调整，请重新导出。');}
      }
      metadata.revalidate?.();
    };checkCompany();
    const language=fileLanguage(metadata.language),zip=new JSZip(), type=documentType(kind,language), last=col(type.headers.length-1), generatedAt=now();
    const cells=(values,r,style=0)=>values.map((v,c)=>{const ref=`${col(c)}${r}`;if(v===null||v===undefined||v==='')return `<c r="${ref}" s="${style}"/>`;if(typeof v==='number'&&Number.isFinite(v))return `<c r="${ref}" s="${style}" t="n"><v>${v}</v></c>`;return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;}).join('');
    const sheetRows=[`<row r="1" ht="40" customHeight="1">${cells([`${brand.name} · ${type.name}`],1,1)}</row>`,`<row r="2" ht="23" customHeight="1">${cells([`${fileText('资料快照',language)} · ${generatedAt.slice(0,10)} · ${metadata.version||'v1.0'} · ${metadata.scope??''}`],2,3)}</row>`,`<row r="3" ht="12" customHeight="1"/>`,`<row r="4" ht="28" customHeight="1">${cells(type.headers,4,2)}</row>`];
    const pictures=[], imageCache=new Map();
    for(let j=0;j<rows.length;j++){
      checkCompany();
      const row=rows[j],r=j+5;
      const longest=Math.max(...row.values.map((v,c)=>String(v??'').split('\n').reduce((sum,line)=>sum+Math.max(1,Math.ceil([...line].reduce((n,ch)=>n+(ch.charCodeAt(0)>255?2:1),0)/(type.widths[c]*.94))),0)));
      const height=Math.min(409,Math.max(kind==='catalog'?160:kind==='packaging'?115:96,longest*13+14));
      sheetRows.push(`<row r="${r}" ht="${height}" customHeight="1">${cells(row.values,r,j%2?5:4)}</row>`);
      if(row.asset){let png=imageCache.get(row.asset.id);if(!png){png=await pngAsset(row.asset);checkCompany();imageCache.set(row.asset.id,png);}pictures.push({row:r-1,rowHeight:height*96/72,asset:row.asset,...png});}
      progress(Math.round(((j+1)/rows.length)*85));
    }
    const imageCount=pictures.length,logoAsset={url:brand.logo,name:brand.name+' Logo'};
    const brandLogo=await pngAsset(logoAsset);checkCompany();
    pictures.push({row:0,col:type.headers.length-1,rowHeight:40*96/72,brand:true,asset:logoAsset,...brandLogo});
    const count=pictures.length;
    const anchors=pictures.map((p,j)=>{const maxH=p.brand?32:Math.max(60,p.rowHeight-20);const scale=Math.min((p.brand?Math.min(146,type.widths[type.widths.length-1]*7-20):146)/p.width,maxH/p.height);const cy=Math.round(p.height*scale*9525),cx=Math.round(p.width*scale*9525);return `<xdr:oneCellAnchor><xdr:from><xdr:col>${p.col||0}</xdr:col><xdr:colOff>95250</xdr:colOff><xdr:row>${p.row}</xdr:row><xdr:rowOff>95250</xdr:rowOff></xdr:from><xdr:ext cx="${cx}" cy="${cy}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${j+1}" name="${xml(p.asset.name||'产品图片')}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${j+1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`;}).join('');
    zip.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${count?'<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>':''}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
    zip.file('_rels/.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
    zip.file('docProps/core.xml',`<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(type.name)}</dc:title><dc:creator>${xml(brand.name)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${generatedAt}</dcterms:created></cp:coreProperties>`);
    zip.file('xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(type.name)}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">'${xml(type.name)}'!$1:$4</definedName><definedName name="_xlnm.Print_Area" localSheetId="0">'${xml(type.name)}'!$A$1:$${last}$${rows.length+4}</definedName></definedNames></workbook>`);
    zip.file('xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
    zip.file('xl/styles.xml',`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="${NS}"><fonts count="4"><font><sz val="10"/><name val="Microsoft YaHei"/><color rgb="FF303030"/></font><font><b/><sz val="19"/><name val="Microsoft YaHei"/><color rgb="FF181818"/></font><font><b/><sz val="10"/><name val="Microsoft YaHei"/><color rgb="FFFFFFFF"/></font><font><sz val="9"/><name val="Microsoft YaHei"/><color rgb="FF707070"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF181818"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF5F5F5"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFE5E5E5"/></left><right style="thin"><color rgb="FFE5E5E5"/></right><top style="thin"><color rgb="FFE5E5E5"/></top><bottom style="thin"><color rgb="FFE5E5E5"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1" indent="1"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1" indent="1"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1" indent="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
    zip.file('xl/worksheets/sheet1.xml',`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${last}${rows.length+4}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${type.widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${sheetRows.join('')}</sheetData><autoFilter ref="A4:${last}${rows.length+4}"/><mergeCells count="2"><mergeCell ref="A1:${col(type.headers.length-2)}1"/><mergeCell ref="A2:${last}2"/></mergeCells><pageMargins left="0.25" right="0.25" top="0.45" bottom="0.45" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;C ${xml(brand.name)} · &amp;P / &amp;N</oddFooter></headerFooter>${count?'<drawing r:id="rId1"/>':''}</worksheet>`);
    if(count){zip.file('xl/worksheets/_rels/sheet1.xml.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`);zip.file('xl/drawings/drawing1.xml',`<?xml version="1.0" encoding="UTF-8"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors}</xdr:wsDr>`);zip.file('xl/drawings/_rels/drawing1.xml.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${pictures.map((p,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${i+1}.png"/>`).join('')}</Relationships>`);pictures.forEach((p,i)=>zip.file(`xl/media/image${i+1}.png`,p.data,{base64:true}));}
    checkCompany();progress(92);const blob=await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',compression:'DEFLATE'});checkCompany();progress(100);return {blob,imageCount};
  }
  function allowedTemplates(invite=null) { return excelTemplates().filter(t=>t.status==='published'&&(!invite||fixed(t)&&(!(invite.templateIds||[]).length||invite.templateIds.includes(t.id)))); }
  function uploadedTemplatesPanel() {
    if(!internalExport())return '';
    const custom=excelTemplates().filter(t=>!fixed(t)),admin=L.can('templates');
    return `<section class="ex-uploaded-templates" aria-label="已上传公司模板"><div class="ex-uploaded-heading"><h3>已上传公司模板 <span class="muted">${custom.length}</span></h3>${admin?'<a class="btn small" href="#/templates">管理模板</a>':''}</div><p class="ex-caption">原稿和字段配置保存在当前网站的本浏览器中。公司 Excel 模板暂未支持按原版式生成 Excel 或 PDF，请先使用固定模板。</p>${custom.length?`<div class="ex-uploaded-list">${custom.map(t=>`<article class="ex-uploaded-item"><div class="ex-uploaded-copy"><div class="ex-uploaded-meta"><strong>${esc(t.name)}</strong><span class="badge">${t.status==='published'?'配置已发布':'草稿'}</span></div><small>原文件：${esc(t.fileName||'未记录文件名')}</small><span class="ex-fixed-note">按原版式生成：尚未支持</span></div>${admin?`<button type="button" class="btn small" data-custom-configure="${esc(t.id)}">配置模板</button>`:''}</article>`).join('')}</div>`:'<p class="ex-uploaded-empty">当前网站的本浏览器中没有已保存的公司模板。在本地预览地址上传的模板不会自动出现在这里。</p>'}</section>`;
  }
  function bindUploadedTemplates(container) {
    container.querySelectorAll('[data-custom-configure]').forEach(button=>button.onclick=()=>{
      if(!L.can('templates'))return L.toast('仅管理员可以配置模板');
      const template=excelTemplates().find(t=>t.id===button.dataset.customConfigure&&!fixed(t));
      if(!template)return L.toast('模板已变更，请刷新后重试');
      configureTemplate(template);
    });
  }
  function allSelection(invite) { return L.liveProducts(invite).flatMap(p=>(p.variants||[]).map(v=>({productId:p.id,skuId:v.id}))); }
  function jobPermission(job) {
    if(!job)throw new Error('导出记录已不存在，请重新导出。');
    assertCompany(job.companyId||'uniqmag');
    const current=requireExport(job.inviteId?{id:job.inviteId,code:job.inviteCode}:null);
    if(!internalExport()&&(!job.inviteId||job.inviteId!==current.id||job.inviteCode!==current.code))throw new Error('此导出记录不属于当前邀请。');
    const check=checkScope(job.selection,excelTemplates().find(t=>t.id===job.templateId),current,job.language);
    if(job.templateVersion!=null&&String(job.templateVersion)!==String(check.template.version))throw new Error('模板版本已更新，请重新导出。');
    for(const id of job.assetIds||[]){const a=L.state.assets.find(x=>x.id===id);if(!a||a.status!=='published')throw new Error('文件包含的部分素材已归档或撤回，请重新导出最新资料。');}
    if(current&&(job.assetIds||[]).some(id=>!(job.assetRefs||[]).some(ref=>ref.id===id)))throw new Error('此记录缺少素材授权快照，请重新导出。');
    for(const ref of job.assetRefs||[]){const pair=check.rows.find(r=>r.p.id===ref.productId&&r.v.id===ref.skuId),a=L.state.assets.find(x=>x.id===ref.id);if(!pair||!a||String(a.version)!==String(ref.version)||assetFor(a.url,pair.p,pair.v,check.invite)?.id!==a.id)throw new Error('素材版本或适用范围已调整，请重新导出最新资料。');}
    return check;
  }
  async function downloadJob(job) {
    try{jobPermission(job);if(!job.fileData)throw new Error('本地文件未保留，请重新生成。');const response=await fetch(job.fileData);const blob=await response.blob();const check=jobPermission(job);downloadExport(blob,job.filename,check.invite);job.lastDownloadedAt=now();L.log('下载导出文件',job.filename);jobPermission(job);await L.save();jobPermission(job);L.toast('导出文件已下载');}catch(e){L.toast(safeError(e));}
  }
  L.openExport = (selection, invite=null, preferredId=null, preferredFormat='pdf', preferredLanguage=window.LibraryPreferences?.language) => {
    let current;try{current=requireExport(invite);}catch(error){L.toast(safeError(error));return;}
    const brand={...company()};
    selection=Array.from(new Map(selection.map(s=>[`${s.productId}:${s.skuId}`,{productId:s.productId,skuId:s.skuId}])).values());
    if(!selection.length){L.toast('请先选择需要导出的产品配色');return;}
    const templates=allowedTemplates(current), available=templates.filter(fixed);
    if(!available.length){L.toast('当前没有可使用的固定导出模板，请联系管理员。');return;}
    let chosen=available.find(t=>t.id===preferredId)||available[0],step=1,images=true,busy=false,format=preferredFormat==='xlsx'?'xlsx':'pdf',language=fileLanguage(preferredLanguage);
    const d=L.modal('导出产品资料','',{wide:true}),body=d.querySelector('.modal-body');d.classList.add('ex-export-dialog');
    const paint=()=>{
      let scope;try{assertCompany(brand.id);scope=checkScope(selection,chosen,current,language);current=scope.invite;}catch(e){body.innerHTML=`<div class="ex-error">${esc(safeError(e))}</div>`;return;}
      const rowData=dataRows(scope.rows,chosen.kind,current,images,language);
      const steps=['选择模板','核对范围','预览与下载'];
      body.innerHTML=`<ol class="ex-stepper">${steps.map((s,i)=>`<li class="${step===i+1?'active':''}"><span class="ex-step-number">${i+1}</span><span class="ex-step-label">${s}</span></li>`).join('')}</ol>${step===1?`<fieldset class="ex-format-picker"><legend>文件格式</legend><label class="${format==='pdf'?'active':''}"><input type="radio" name="ex-format" value="pdf" ${format==='pdf'?'checked':''}><span><b>PDF 文档</b><small>适合发给客户 · 固定版式 · 直接查看</small></span></label><label class="${format==='xlsx'?'active':''}"><input type="radio" name="ex-format" value="xlsx" ${format==='xlsx'?'checked':''}><span><b>Excel 表格</b><small>保留原功能 · 适合继续编辑和整理</small></span></label></fieldset><fieldset class="ex-language-picker"><legend>文件语言</legend><div class="ex-language-options"><label class="${language==='zh-CN'?'active':''}"><input type="radio" name="ex-language" value="zh-CN" ${language==='zh-CN'?'checked':''}><span data-no-translate>中文</span></label><label class="${language==='en'?'active':''}"><input type="radio" name="ex-language" value="en" ${language==='en'?'checked':''}><span data-no-translate>English</span></label></div><p class="ex-caption">英文版会转换标准字段；未提供英文的自定义内容保留原文。</p></fieldset><div class="ex-choices">${available.map(t=>`<button type="button" class="ex-choice ${chosen.id===t.id?'active':''}" aria-pressed="${chosen.id===t.id}" data-choice="${esc(t.id)}"><span class="ex-choice-content"><span class="badge purple">固定模板 · ${esc(t.version||'v1.0')}</span><b>${esc(t.name)}</b><small>${esc(TYPES[t.kind].subtitle)}</small></span></button>`).join('')}</div>${uploadedTemplatesPanel()}<div class="ex-permission-note">仅导出当前获授权的已发布资料。表格内图片与原素材下载分别授权，未填写的 SKU 与参数保持为空。</div>`:step===2?`<div class="ex-selection-tags"><span>${new Set(scope.rows.map(r=>r.p.id)).size} 个产品系列</span><span>${scope.rows.length} 个配色</span><span>${esc(chosen.name)}</span><span>${format==='pdf'?'PDF':'Excel'}</span><span data-no-translate>${languageLabel(language)}</span></div><div class="ex-preview-scroll" data-no-translate lang="${language}"><table class="ex-preview-table"><thead><tr>${['品牌','产品型号','SKU','配色','产品类别'].map(label=>`<th>${esc(fileText(label,language))}</th>`).join('')}</tr></thead><tbody>${scope.rows.map(({p,v})=>{const display=translatedPair(p,v,language);return `<tr><td>${esc(productBrandName(p))}</td><td>${esc(p.name)}</td><td>${v.sku?esc(v.sku):`<span class="muted">${english(language)?'Not provided · exported as blank':'未填写 · 导出留空'}</span>`}</td><td>${esc(display.v.colorLabel||display.v.color||'')}</td><td>${esc(display.p.categoryLabel||display.p.category||'')}</td></tr>`;}).join('')}</tbody></table></div><p class="ex-caption">包装资料按当前配色匹配，专属某配色的包装不会复制给其他配色。需要调整产品时可关闭窗口，在列表重新选择。</p>`:`<div class="ex-export-options"><label><input type="checkbox" id="ex-images" ${images?'checked':''}>嵌入产品与包装图片</label><span class="muted">${rowData.filter(r=>r.asset).length} 张图片 / ${rowData.length} 行资料</span><span class="ex-file-language">文件语言：<b data-no-translate>${languageLabel(language)}</b></span></div>${tablePreview(rowData,chosen.kind,8,language)}<p class="ex-caption">文件格式：.${format} · ${format==='pdf'?'下方为内容预览；PDF 使用横向 A4、品牌页眉和连续页码，长内容自动分页。':'Excel 保留可编辑表格。'}${rowData.some(r=>r.asset)?'产品与包装图片将嵌入文件，可离线查看。':'本次不嵌入图片，仅导出文字资料。'}文件包含版本与导出时间，不包含价格、采购或订单信息。</p>`}<div class="ex-modal-footer"><span class="ex-select-count">已选 <strong>${scope.rows.length}</strong> 个配色</span><div class="row-actions">${step>1?'<button class="btn" id="ex-back">上一步</button>':''}<button class="btn primary" id="ex-next">${step===3?`生成并下载 ${format==='pdf'?'PDF':'Excel'}`:step===2?'预览表格':'核对导出范围'}</button></div></div>`;
      bindUploadedTemplates(body);
      body.querySelectorAll('[name="ex-language"]').forEach(input=>input.onchange=()=>{language=fileLanguage(input.value);paint();});
      body.querySelectorAll('[name="ex-format"]').forEach(input=>input.onchange=()=>{format=input.value==='xlsx'?'xlsx':'pdf';paint();});
      body.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{chosen=available.find(t=>t.id===b.dataset.choice);paint();});
      body.querySelector('#ex-back')?.addEventListener('click',()=>{step--;paint();});
      body.querySelector('#ex-images')?.addEventListener('change',e=>{images=e.target.checked;paint();});
      body.querySelector('#ex-next').onclick=()=>{if(step<3){step++;paint();}else generate();};
    };
    const generate=async()=>{
      if(busy)return;busy=true;
      const type=documentType(chosen.kind,language);
      const job={id:L.uid('export'),name:type.name,language,status:'generating',createdAt:now(),companyId:brand.id,format,filename:`${brand.name}_${type.name}_${new Date().toISOString().slice(0,10)}_${english(language)?'EN':'ZH'}.${format}`,selectionCount:selection.length,templateId:chosen.id,templateVersion:chosen.version,selection:structuredClone(selection),inviteId:current?.id||null,inviteCode:current?.code||null,assetIds:[]};
      try{
        assertCompany(brand.id);const check=checkScope(selection,chosen,current,language),rows=dataRows(check.rows,chosen.kind,check.invite,images,language);
        job.assetIds=[...new Set(rows.filter(r=>r.asset).map(r=>r.asset.id))];job.assetRefs=rows.filter(r=>r.asset).map(r=>({id:r.asset.id,version:r.asset.version,productId:r.p.id,skuId:r.v.id}));jobPermission(job);activeJobs.add(job.id);L.state.jobs.unshift(job);await L.save();jobPermission(job);
        body.innerHTML=`<div class="ex-progress"><div class="ex-spinner"></div><h3>正在整理产品资料</h3><p>${format==='pdf'?'正在准备中文字体、图片与 PDF 分页，首次生成需要加载字体。':'嵌入图片并生成可离线打开的 Excel 文件，请稍候。'}</p><div class="ex-job-progress"><span style="width:0%"></span></div></div>`;
        const progress=n=>{const bar=body.querySelector('.ex-job-progress span');if(bar)bar.style.width=`${n}%`;};
        const result=format==='pdf'?{blob:await L.pdfExport.build({company:brand,language,title:type.name,subtitle:type.subtitle,meta:[{label:fileText('模板版本',language),value:chosen.version||'v1.0'},{label:fileText('导出时间',language),value:new Date().toLocaleString(english(language)?'en-GB':'zh-CN')},{label:fileText('资料范围',language),value:scopeText(new Set(check.rows.map(r=>r.p.id)).size,selection.length,language)},{label:fileText('用途',language),value:check.invite?.company||fileText('产品资料',language)}],headers:type.headers,widths:type.widths,rows:rows.map(row=>({values:row.values,image:row.asset?.url})),notes:[english(language)?'This file is a snapshot of published product information at export. Pending and missing fields are retained as provided.':'此文件为导出时的已发布资料快照；待确认与缺失字段按原资料保留。']},{validate:()=>jobPermission(job),progress}),imageCount:rows.filter(row=>row.asset).length}:await buildXlsx(rows,chosen.kind,{company:brand,language,invite:check.invite,revalidate:()=>jobPermission(job),version:chosen.version,scope:check.invite?.company||fileText('内部资料',language)},progress);
        jobPermission(job);const fileData=await L.readFile(new File([result.blob],job.filename,{type:result.blob.type}));jobPermission(job);job.fileData=fileData;job.status='completed';job.completedAt=now();job.imageCount=result.imageCount;job.size=result.blob.size;job.rowCount=rows.length;L.log('生成产品资料',job.filename);jobPermission(job);await L.save();const ready=jobPermission(job);downloadExport(result.blob,job.filename,ready.invite);
        body.innerHTML=`<div class="ex-progress"><div class="ex-success-mark">✓</div><h3>${format==='pdf'?'PDF':'Excel'} 已生成</h3><p data-no-translate>${esc(job.filename)}</p><div class="ex-download-summary"><span data-no-translate>${languageLabel(job.language)}</span><span>${job.selectionCount} 个配色</span><span>${result.imageCount} 张图片</span><span>${esc(L.size(job.size))}</span></div><p>已开始下载。文件也保存在本浏览器的导出记录中。<br>再次下载时会重新检查当前权限、产品发布状态与素材版本。</p><div class="row-actions" style="justify-content:center"><button class="btn" id="ex-again">再次下载</button><button class="btn" id="ex-history">查看导出记录</button><button class="btn primary" id="ex-done">完成</button></div></div>`;
        body.querySelector('#ex-again').onclick=()=>downloadJob(job);body.querySelector('#ex-history').onclick=()=>{L.closeModal();L.go('exports?tab=history');};body.querySelector('#ex-done').onclick=()=>{L.closeModal();L.render();};
      }catch(e){job.status='failed';job.error=safeError(e);delete job.fileData;try{assertCompany(brand.id);requireExport(current);await L.save();}catch{}body.innerHTML=`<div class="ex-error">${esc(safeError(e))}</div><p class="ex-caption">没有可下载的文件生成。修正问题后可重试。</p><button class="btn" id="ex-retry">返回预览</button>`;body.querySelector('#ex-retry').onclick=()=>{busy=false;paint();};}
      activeJobs.delete(job.id);busy=false;
    };
    paint();
  };
  async function inspectTemplate(file) {
    if(!/\.xlsx$/i.test(file.name))throw new Error('请上传 .xlsx 格式文件，不支持 .xls 或含宏的 .xlsm。');
    if(file.size>8*1024*1024)throw new Error('模板不能超过 8 MiB，请先压缩图片或精简工作表。');
    const zip=await JSZip.loadAsync(await file.arrayBuffer()), names=Object.keys(zip.files),total=names.reduce((n,p)=>n+(zip.files[p]._data?.uncompressedSize||0),0);
    if(names.length>1200||total>60*1024*1024)throw new Error('模板内部文件过多或解压体积过大，请精简后上传。');
    if(!zip.file('xl/workbook.xml')||!zip.file('[Content_Types].xml'))throw new Error('文件不是有效的 Excel 工作簿。');
    if(names.some(n=>/vbaProject|externalLinks|connections\.xml|queryTables|embeddings\//i.test(n)))throw new Error('模板包含宏、外部数据链接或嵌入对象。请移除后重新上传。');
    const book=parseXML(await zip.file('xl/workbook.xml').async('string')),sheetNodes=nodes(book,'sheet');
    if(!sheetNodes.length)throw new Error('模板没有可读取的工作表。');
    const hidden=sheetNodes.filter(n=>['hidden','veryHidden'].includes(n.getAttribute('state'))).length;
    const sheetFiles=names.filter(n=>/^xl\/worksheets\/[^/]+\.xml$/.test(n)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
    if(!sheetFiles.length)throw new Error('模板没有标准工作表文件。');
    const shared=zip.file('xl/sharedStrings.xml')?nodes(parseXML(await zip.file('xl/sharedStrings.xml').async('string')),'si').map(n=>nodeText(n)):[];
    const relationships=zip.file('xl/_rels/workbook.xml.rels')?parseXML(await zip.file('xl/_rels/workbook.xml.rels').async('string')):null;
    const firstRel=relationships&&nodes(relationships,'Relationship').find(r=>r.getAttribute('Id')===sheetNodes[0].getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id'));
    const relTarget=firstRel?.getAttribute('Target'),actualSheet=relTarget?(relTarget.startsWith('/')?relTarget.slice(1):'xl/'+relTarget.replace(/^\.\//,'')):sheetFiles[0];
    if(!zip.file(actualSheet))throw new Error('首张工作表引用无效，无法预览。');
    const sheet=parseXML(await zip.file(actualSheet).async('string'));
    const rows=nodes(sheet,'row'),preview=Array.from({length:Math.min(14,Math.max(6,...rows.slice(0,14).map(r=>Number(r.getAttribute('r'))||1)))},()=>Array(8).fill(''));
    let formulas=0,filled=0;
    for(const cell of nodes(sheet,'c')){filled++;const ref=cell.getAttribute('r')||'',m=ref.match(/^([A-Z]+)(\d+)$/);if(nodes(cell,'f').length)formulas++;if(!m)continue;const c=[...m[1]].reduce((n,v)=>n*26+v.charCodeAt(0)-64,0)-1,r=+m[2]-1;let value=cell.getAttribute('t')==='s'?shared[+nodeText(nodes(cell,'v')[0])]:cell.getAttribute('t')==='inlineStr'?nodeText(nodes(cell,'is')[0]):nodeText(nodes(cell,'v')[0]);if(preview[r]&&c<8)preview[r][c]=String(value??'').slice(0,300);}
    const warnings=[];
    if(hidden)warnings.push(`${hidden} 张隐藏工作表，需要在服务端移除或检查。`);
    if(sheetNodes.length>1)warnings.push(`共有 ${sheetNodes.length} 张工作表，当前预览首张工作表。`);
    if(formulas)warnings.push(`首张表含 ${formulas} 个公式；此预览不执行公式。`);
    if(names.some(n=>/comments|person|pivotTables/i.test(n)))warnings.push('含批注、人员信息或数据透视表，需要检查清理。');
    if(names.some(n=>/^xl\/drawings\//.test(n)))warnings.push('检测到图片或绘图。原稿保留，但此处仅提供单元格内容预览。');
    warnings.push('原稿、字段映射与重复区会保存在当前浏览器。复杂排版和图片槽位的保真生成待服务端接入，尚不可用于生成表格。');
    return {sheetName:sheetNodes[0].getAttribute('name')||'Sheet1',sheetCount:sheetNodes.length,preview,warnings,filled,formulas,hidden,merged:nodes(sheet,'mergeCell').length};
  }
  function sampleSheet(preview) {
    return `<div class="ex-upload-preview"><table><thead><tr><th></th>${Array.from({length:8},(_,i)=>`<th>${col(i)}</th>`).join('')}</tr></thead><tbody>${preview.map((r,i)=>`<tr><th>${i+1}</th>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  const savingTemplates=new Set();
  function requireTemplateAdmin() {
    requireInternalExport();
    if(!L.can('templates'))throw new Error('仅管理员可以上传和配置模板。');
  }
  async function persistTemplate(record,{create=false,action='更新模板配置'}={}) {
    requireTemplateAdmin();
    const companyId=company().id,state=L.state;
    if(savingTemplates.has(record.id))throw new Error('模板正在保存，请稍候。');
    const index=L.state.templates.findIndex(t=>t.id===record.id),previous=index<0?null:L.state.templates[index];
    if(create&&previous)throw new Error('模板已保存，请勿重复提交。');
    if(!create&&!previous)throw new Error('模板记录已变更，请重新打开后再保存。');
    savingTemplates.add(record.id);
    const next=structuredClone(record);
    if(create)L.state.templates.push(next);else L.state.templates.splice(index,1,next);
    L.log(action,next.name);const log=L.state.logs[0];
    try{await L.save();assertCompany(companyId);return next;}
    catch(error){
      const current=state.templates.findIndex(t=>t.id===next.id);
      if(current>=0&&(state.templates[current]===next||JSON.stringify(state.templates[current])===JSON.stringify(next))){if(create)state.templates.splice(current,1);else state.templates.splice(current,1,previous);}
      state.logs=state.logs.filter(entry=>entry.id!==log.id);
      throw error;
    }finally{savingTemplates.delete(record.id);}
  }
  async function uploadTemplate() {
    if(!L.can('templates'))return L.toast('仅管理员可以上传和配置模板');
    const companyId=company().id;
    const input=document.createElement('input');input.type='file';input.accept='.xlsx';
    input.onchange=async()=>{
      const file=input.files?.[0];if(!file)return;
      try{assertCompany(companyId);requireTemplateAdmin();}catch(error){L.toast(safeError(error));return;}
      const d=L.modal('正在读取 Excel 模板','<div class="ex-progress"><div class="ex-spinner"></div><p>正在检查并保存模板原稿，完成后可继续配置。</p></div>',{wide:true});
      try{
        const inspection=await inspectTemplate(file);assertCompany(companyId);requireTemplateAdmin();
        const data=await L.readFile(file);assertCompany(companyId);requireTemplateAdmin();
        const template=await persistTemplate({id:L.uid('tpl'),name:file.name.replace(/\.xlsx$/i,''),kind:'custom',status:'draft',version:'v1.0',description:'公司自定义版式',language:'zh-CN',fileName:file.name,fileData:data,fileSize:file.size,inspection,createdAt:now(),updatedAt:now(),mapping:{sheetName:inspection.sheetName,startRow:5,endRow:5,image:'A',brand:'B',name:'C',sku:'D',color:'E',category:'F',description:'G',specs:'H',packaging:'I'}},{create:true,action:'上传模板原稿'});
        if(!L.can('templates'))return;
        const continueConfig=d.isConnected;
        L.toast('模板原稿已保存为草稿，关闭配置窗口也会保留');
        if(continueConfig){L.closeModal();await L.render();if(L.can('templates'))configureTemplate(template);}
        else if(['templates','exports'].includes(L.route)&&!document.querySelector('dialog[open]'))L.render();
      }catch(error){
        if(d.isConnected)d.querySelector('.modal-body').innerHTML=`<div class="ex-error">${esc(safeError(error))}</div><p class="ex-caption">上传未保存。支持 .xlsx，最大 8 MiB。含宏、外部链接或嵌入对象的文件不可上传。</p>`;
        else L.toast(safeError(error));
      }
    };
    input.click();
  }
  function configureTemplate(original) {
    if(!L.can('templates'))return L.toast('仅管理员可以配置模板');
    const companyId=company().id;
    const t=structuredClone(original),m=t.mapping||{},inspection=t.inspection||{preview:[],warnings:[]};
    const d=L.modal('配置公司 Excel 模板','',{wide:true}),body=d.querySelector('.modal-body');
    body.innerHTML=`<div class="ex-file-card"><div class="ex-file-icon">XLSX</div><div><b>${esc(t.fileName)}</b><small>${esc(L.size(t.fileSize||0))} · ${inspection.sheetCount||1} 张工作表 · ${inspection.merged||0} 组合并单元格</small></div><button type="button" class="btn small" id="ex-original" style="margin-left:auto">下载原稿</button></div><form id="ex-template-form"><div class="form-grid"><label class="field">模板名称<input name="name" required maxlength="60" value="${esc(t.name)}"></label><label class="field">版本号<input name="version" required maxlength="20" value="${esc(t.version||'v1.0')}"></label><label class="field full">用途说明<input name="description" maxlength="160" value="${esc(t.description)}"></label></div><p class="ex-caption">原稿已保存到当前网站的本浏览器，关闭此窗口也会保留。调整字段后请保存配置。</p><h3 class="section-title">原稿内容预览</h3><p class="ex-caption">前 14 行、A–H 列的文字内容。图片、字体和合并排版以原稿为准。</p>${sampleSheet(inspection.preview||[])}<h3 class="section-title">字段绑定与重复区</h3><div class="form-grid"><label class="field">工作表<input name="sheetName" required value="${esc(m.sheetName||inspection.sheetName)}"></label><label class="field">模板语言<select name="language"><option value="zh-CN" ${t.language==='zh-CN'?'selected':''}>中文</option><option value="en" ${t.language==='en'?'selected':''}>English</option><option value="bilingual" ${t.language==='bilingual'?'selected':''}>中英双语</option></select></label><label class="field">每个产品区块起始行<input name="startRow" type="number" min="1" max="10000" required value="${m.startRow||5}"></label><label class="field">每个产品区块结束行<input name="endRow" type="number" min="1" max="10000" required value="${m.endRow||5}"></label></div><p class="ex-caption">系统将按配色重复该区块。填写列字母（例如 A、B、AA），留空表示不使用该字段。</p><div class="ex-mapping-grid">${Object.entries(FIELD_NAMES).map(([key,name])=>`<label class="field">${esc(name)}${key==='image'?'槽位列':''}<input name="map_${key}" pattern="[a-zA-Z]{0,3}" maxlength="3" placeholder="例如 ${key==='image'?'A':'B'}" value="${esc(m[key]||'')}"></label>`).join('')}</div><div class="notice" style="margin-top:20px"><b>兼容性检查</b><ul class="ex-warning-list">${inspection.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></div><div class="ex-modal-footer"><span class="ex-local-tag">模板生成能力：待服务端接入</span><div class="row-actions"><button type="button" class="btn" id="ex-mapping-preview">示例预览</button><button type="submit" class="btn primary">保存${t.status==='published'?'配置':'草稿'}</button></div></div></form>`;
    body.querySelector('#ex-original').onclick=async()=>{try{assertCompany(companyId);requireInternalExport();if(!L.can('templates'))throw new Error('仅管理员可以下载模板原稿。');const r=await fetch(t.fileData),blob=await r.blob();assertCompany(companyId);requireInternalExport();if(!L.can('templates'))throw new Error('仅管理员可以下载模板原稿。');L.download(blob,t.fileName);}catch(e){failure(body,e);}};
    const read=()=>{const form=body.querySelector('form');if(!form.reportValidity())return null;const f=new FormData(form),mapping={sheetName:String(f.get('sheetName')).trim(),startRow:Number(f.get('startRow')),endRow:Number(f.get('endRow'))};if(mapping.endRow<mapping.startRow)throw new Error('重复区结束行不能小于起始行。');Object.keys(FIELD_NAMES).forEach(k=>mapping[k]=String(f.get(`map_${k}`)||'').toUpperCase().trim());const cols=Object.keys(FIELD_NAMES).map(k=>mapping[k]).filter(Boolean);if(new Set(cols).size!==cols.length)throw new Error('每个字段应绑定不同的列，图片槽位也需要独立列。');if(!mapping.name&&!mapping.sku)throw new Error('请至少绑定产品型号或 SKU。');return {...t,name:String(f.get('name')).trim(),version:String(f.get('version')).trim(),description:String(f.get('description')).trim(),language:String(f.get('language')),mapping,updatedAt:now()};};
    body.querySelector('#ex-mapping-preview').onclick=()=>{try{const next=read();if(!next)return;const {p,v}=resolveSelection(allSelection().slice(0,1),null)[0]||{};if(!p)throw new Error('请先发布一个产品，才能展示示例。');const values={image:'[获准下载的产品图片]',brand:productBrandName(p),name:p.name,sku:v.sku??'',color:v.colorLabel||v.color||'',category:p.categoryLabel||p.category||'',description:p.description||'',specs:p.specs?.map(s=>`${s.label}：${s.value??''}`).join('\n')||'',packaging:p.packaging?.filter(a=>!a.appliesTo||a.appliesTo===v.id||a.appliesTo===v.sku).map(a=>`${a.title}\n${a.text}`).join('\n\n')||''};let panel=body.querySelector('#ex-binding-sample');if(!panel){panel=document.createElement('div');panel.id='ex-binding-sample';body.querySelector('.ex-modal-footer').before(panel);}panel.innerHTML=`<h3 class="section-title">${esc(p.name)} 字段绑定示例</h3><p class="ex-caption">这是内容与槽位的核对，不代表原稿排版已经生成。</p><div class="ex-preview-scroll"><table class="ex-preview-table"><thead><tr><th>原稿位置</th><th>绑定字段</th><th>示例内容</th></tr></thead><tbody>${Object.keys(FIELD_NAMES).filter(k=>next.mapping[k]).map(k=>`<tr><td>${esc(next.mapping[k])}${next.mapping.startRow}</td><td>${esc(FIELD_NAMES[k])}</td><td>${esc(values[k])}</td></tr>`).join('')}</tbody></table></div>`;panel.scrollIntoView({block:'nearest',behavior:'smooth'});}catch(e){failure(body,e);}};
    let saving=false;
    body.querySelector('form').onsubmit=async e=>{
      e.preventDefault();if(saving)return;
      const button=body.querySelector('button[type="submit"]'),label=button.textContent;
      try{
        assertCompany(companyId);requireTemplateAdmin();const next=read();if(!next)return;
        saving=true;button.disabled=true;button.textContent='正在保存…';
        await persistTemplate(next);
        if(!L.can('templates'))return;
        if(d.isConnected)L.closeModal();
        L.toast('模板配置已保存，按原版式生成尚未支持');L.render();
      }catch(error){if(d.isConnected)failure(body,error);else L.toast(safeError(error));}
      finally{saving=false;if(button.isConnected){button.disabled=false;button.textContent=label;}}
    };
  }
  function previewTemplate(t) {
    try{requireInternalExport();}catch(error){L.toast(safeError(error));return;}
    if(!fixed(t)){const d=L.modal(t.name,`<div class="notice">上传模板配置已保存。保真生成待服务端接入，此处展示原稿文字内容。</div>${sampleSheet(t.inspection?.preview||[])}`,{wide:true});return;}
    const selection=allSelection().slice(0,3),rows=resolveSelection(selection,null),d=L.modal(t.name,`${tablePreview(dataRows(rows,t.kind,null,true),t.kind)}<p class="ex-caption">固定模板示例 · PDF 自动分页与页码 · Excel 冻结表头与筛选 · 图片嵌入。</p>`,{wide:true});
  }
  function renderTemplates(el, params=new URLSearchParams()) {
    if(!L.can('templates')){el.innerHTML='<div class="empty-state">当前身份没有模板管理权限。</div>';return;}
    const printTab=params.get('tab')==='print',quotationTab=params.get('tab')==='quotation';
    const admin=L.can('templates'),templates=excelTemplates(),defaultTemplates=templates.filter(fixed),custom=templates.filter(t=>!fixed(t));
    const tabs=`<div class="tabs" role="tablist" aria-label="模板类型"><button type="button" role="tab" id="ex-template-tab-excel" aria-controls="ex-template-content" aria-selected="${!printTab&&!quotationTab}" class="${printTab||quotationTab?'':'active'}">资料导出模板</button><button type="button" role="tab" id="ex-template-tab-print" aria-controls="ex-template-content" aria-selected="${printTab}" class="${printTab?'active':''}">打印 / PDF 模板</button><button type="button" role="tab" id="ex-template-tab-quotation" aria-controls="ex-template-content" aria-selected="${quotationTab}" class="${quotationTab?'active':''}">报价单模板</button></div>`;
    const banner=L.pageBanner({eyebrow:'EXPORT TEMPLATES',title:'导出模板',description:quotationTab?'上传和管理报价单版式，生成 PDF 时自动填入客户、产品与报价。':printTab?'管理产品打印与 PDF 的版式，下载样板后可修改上传。':'统一客户资料的版式与字段标准',actions:admin&&!printTab&&!quotationTab?'<button class="btn primary" id="ex-upload-template">＋ 上传 Excel 模板</button>':'',aside:`<div class="workspace-banner-stats"><div><strong>${defaultTemplates.length}</strong><span>固定模板</span></div><div><strong>${custom.length}</strong><span>公司模板</span></div></div>`});
    el.innerHTML=banner+tabs+`<div id="ex-template-content" role="tabpanel" aria-labelledby="${quotationTab?'ex-template-tab-quotation':printTab?'ex-template-tab-print':'ex-template-tab-excel'}"></div>`;
    el.querySelector('#ex-template-tab-excel').onclick=()=>L.go('templates');
    el.querySelector('#ex-template-tab-print').onclick=()=>L.go('templates?tab=print');
    el.querySelector('#ex-template-tab-quotation').onclick=()=>L.go('templates?tab=quotation');
    if(quotationTab){
      if(L.quotationTemplates)L.quotationTemplates.renderManager(el.querySelector('#ex-template-content'));
      else el.querySelector('#ex-template-content').innerHTML='<div class="empty-state">报价模板组件尚未加载，请刷新后重试。</div>';
      return;
    }
    if(printTab){
      L.printTemplates.renderManager(el.querySelector('#ex-template-content'));
      return;
    }
    const card=t=>`<article class="ex-template-card">${art(t.kind)}<div class="ex-template-copy"><div class="ex-template-meta"><span class="badge ${t.status==='published'?'green':'amber'}">${t.status==='published'?(fixed(t)?'可用于导出':'配置已发布'):'草稿'}</span><span class="ex-fixed-note">${esc(t.version||'v1.0')}</span></div><h3>${esc(t.name)}</h3><p>${esc(fixed(t)?TYPES[t.kind].subtitle:t.description||'管理员上传的公司版式')}${!fixed(t)?`<br><span class="ex-fixed-note">原文件：${esc(t.fileName||'未记录文件名')}</span><br><span class="ex-fixed-note">按原版式生成：尚未支持</span>`:''}</p><div class="row-actions"><button class="btn small" data-preview="${esc(t.id)}">查看表样</button>${fixed(t)?`<button class="btn small primary" data-export="${esc(t.id)}" ${!L.can('export')?'disabled':''}>使用模板</button>`:admin?`<button class="btn small" data-configure="${esc(t.id)}">配置</button><button class="btn small" data-toggle="${esc(t.id)}">${t.status==='published'?'撤回草稿':'发布配置'}</button>`:''}</div></div></article>`;
    el.querySelector('#ex-template-content').innerHTML=`<div class="ex-toolbar"><h2 class="section-title" style="margin:0">固定模板 <span class="muted">${defaultTemplates.length}</span></h2>${admin?'':'<span class="muted">模板由管理员维护</span>'}</div><div class="ex-template-grid">${defaultTemplates.map(card).join('')}</div><div class="ex-toolbar"><h2 class="section-title" style="margin:0">公司模板 <span class="muted">${custom.length}</span></h2><span class="ex-fixed-note">支持上传 .xlsx · 最大 8 MiB</span></div>${custom.length?`<div class="ex-template-grid">${custom.map(card).join('')}</div>`:`<div class="empty-state panel"><h3>上传你的公司版式</h3><p>保存原稿，绑定产品字段、图片区与重复区域。<br>上传模板保真生成待服务端接入；固定模板现在即可下载。</p>${admin?'<button class="btn" id="ex-upload-empty">上传第一个模板</button>':''}</div>`}<div class="ex-permission-note">管理员可维护模板；客户获准后可使用固定模板导出授权资料，不能访问公司模板原稿。缺失数据保持留空。</div>`;
    el.querySelector('#ex-upload-template')?.addEventListener('click',uploadTemplate);el.querySelector('#ex-upload-empty')?.addEventListener('click',uploadTemplate);
    el.querySelectorAll('[data-preview]').forEach(b=>b.onclick=()=>previewTemplate(templates.find(t=>t.id===b.dataset.preview)));
    el.querySelectorAll('[data-export]').forEach(b=>b.onclick=()=>L.openExport(L.selection?.size?[...L.selection.values()]:allSelection(),null,b.dataset.export));
    el.querySelectorAll('[data-configure]').forEach(b=>b.onclick=()=>configureTemplate(templates.find(t=>t.id===b.dataset.configure)));
    el.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=()=>{const t=templates.find(t=>t.id===b.dataset.toggle),publish=t.status!=='published';L.confirm(publish?'发布模板配置':'撤回为草稿',publish?'发布后管理员可查看已定版配置。此模板仍不可生成表格，直到服务端模板引擎接入。':'撤回后此配置将恢复为草稿。',async()=>{if(!L.can('templates'))return;try{await persistTemplate({...t,status:publish?'published':'draft',updatedAt:now()},{action:publish?'发布模板配置':'撤回模板配置'});if(!L.can('templates'))return;L.toast(publish?'配置已发布，生成能力待接入':'已撤回草稿');L.render();}catch(e){L.toast(safeError(e));}});});
  }
  async function renderExports(el, params=new URLSearchParams()) {
    let current;try{current=requireExport();}catch(error){el.innerHTML='<div class="empty-state">'+esc(safeError(error))+'</div>';return;}
    const interrupted=visibleJobs(current).filter(j=>j.status==='generating'&&!activeJobs.has(j.id));
    if(interrupted.length){interrupted.forEach(j=>{j.status='failed';j.error='上次生成被页面刷新或浏览器关闭中断，请重新导出。';});try{await L.save();}catch(e){L.toast(safeError(e));}}
    const selection=new Map(),initial=L.selection?.size?[...L.selection.values()]:[],all=allSelection(current),allowed=new Set(all.map(s=>`${s.productId}:${s.skuId}`));initial.filter(s=>allowed.has(`${s.productId}:${s.skuId}`)).forEach(s=>selection.set(`${s.productId}:${s.skuId}`,s));
    const tab=params.get('tab')==='history'?'history':'new';
    let query='';
    const syncSelection=()=>{L.selection.clear();selection.forEach(s=>L.selection.set(s.skuId,{productId:s.productId,skuId:s.skuId}));const count=document.querySelector('#customer-selection b');if(count)count.textContent=L.selection.size||'';};
    const changeTab=next=>{syncSelection();L.go(next==='history'?'exports?tab=history':'exports');};
    const paint=()=>{
      let jobs;try{current=requireExport(current);jobs=visibleJobs(current);}catch(error){el.innerHTML='<div class="empty-state">'+esc(safeError(error))+'</div>';return;}
      const completed=jobs.filter(j=>j.status==='completed').length;
      el.innerHTML=L.pageBanner({eyebrow:'EXPORT CENTER',title:tab==='history'?'导出记录':'导出表格',description:tab==='history'?'查看已生成的产品资料，按需重新下载。':'选择产品，生成 PDF 文档或 Excel 表格',aside:`<div class="workspace-banner-stats"><div><strong>${all.length}</strong><span>颜色 / SKU</span></div><div><strong>${completed}</strong><span>已完成</span></div></div>`})+`<div class="tabs"><button class="${tab==='new'?'active':''}" id="ex-tab-new">新建导出</button><button class="${tab==='history'?'active':''}" id="ex-tab-history">导出记录 <span class="muted">${jobs.length}</span></button></div><div id="ex-tab-content"></div>`;
      el.querySelector('#ex-tab-new').onclick=()=>changeTab('new');el.querySelector('#ex-tab-history').onclick=()=>changeTab('history');
      const content=el.querySelector('#ex-tab-content');
      if(tab==='new'){
        content.innerHTML=`<div class="ex-toolbar"><input type="search" class="search-input" id="ex-search" placeholder="搜索品牌、型号、SKU 或配色" value="${esc(query)}" aria-label="搜索导出产品"><div class="row-actions"><span class="ex-select-count" id="ex-count"></span><button class="btn small" id="ex-select-all">选择全部</button><button class="btn small" id="ex-clear">清空</button><button class="btn primary" id="ex-start" ${!L.can('export')?'disabled':''}>选择模板并导出</button></div></div><div id="ex-picker"></div><p class="ex-caption">这里只显示当前获授权的已发布产品；未填写的 SKU 将在文件中留空。</p>${uploadedTemplatesPanel()}`;
        bindUploadedTemplates(content);
        const picker=()=>{try{current=requireExport(current);}catch(error){content.innerHTML='<div class="empty-state">'+esc(safeError(error))+'</div>';return;}const rows=resolveSelection(all,current).filter(({p,v})=>`${productBrandName(p)} ${p.name} ${v.sku||''} ${v.color||''} ${v.colorLabel||''}`.toLowerCase().includes(query.toLowerCase()));content.querySelector('#ex-count').innerHTML=`已选 <strong>${selection.size}</strong> 个配色`;content.querySelector('#ex-picker').innerHTML=rows.length?`<div class="table-wrap panel"><table class="ex-picker-table"><thead><tr><th style="width:40px"></th><th>产品</th><th>品牌</th><th>SKU</th><th>配色</th><th>类别</th><th>状态</th></tr></thead><tbody>${rows.map(({p,v})=>`<tr><td><input type="checkbox" aria-label="选择 ${esc(p.name)} ${esc(v.colorLabel||v.color||'')}" data-p="${esc(p.id)}" data-v="${esc(v.id)}" ${selection.has(`${p.id}:${v.id}`)?'checked':''}></td><td><div class="ex-product-cell">${L.image(v.images?.[0],p.name,'ex-product-thumb')}<div><b>${esc(p.name)}</b><small>${esc(p.type||'')}</small></div></div></td><td>${esc(productBrandName(p))}</td><td>${v.sku?esc(v.sku):'<span class="muted">未填写</span>'}</td><td>${esc(v.colorLabel||v.color||'')}</td><td>${esc(p.categoryLabel||p.category||'')}</td><td><span class="badge green">已发布</span></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state panel"><h3>没有匹配的产品</h3><p>试试其他型号、SKU 或颜色。</p></div>';content.querySelectorAll('[data-p]').forEach(c=>c.onchange=()=>{const key=`${c.dataset.p}:${c.dataset.v}`;if(c.checked)selection.set(key,{productId:c.dataset.p,skuId:c.dataset.v});else selection.delete(key);syncSelection();content.querySelector('#ex-count').innerHTML=`已选 <strong>${selection.size}</strong> 个配色`;});};
        content.querySelector('#ex-search').oninput=e=>{query=e.target.value;picker();};content.querySelector('#ex-select-all').onclick=()=>{all.forEach(s=>selection.set(`${s.productId}:${s.skuId}`,s));syncSelection();picker();};content.querySelector('#ex-clear').onclick=()=>{selection.clear();syncSelection();picker();};content.querySelector('#ex-start').onclick=()=>L.openExport([...selection.values()],current);picker();
      }else{
        content.innerHTML=`<div class="ex-toolbar"><span class="muted">${completed} 份已完成 · 保存在当前浏览器</span><span class="ex-fixed-note">重新下载前会复核当前授权</span></div>${jobs.length?`<div class="table-wrap panel"><table><thead><tr><th>导出文件</th><th>范围</th><th>生成时间</th><th>状态</th><th>操作</th></tr></thead><tbody>${jobs.map(j=>`<tr><td><b data-no-translate>${esc(j.name)}</b><br><small class="muted">${j.format==='pdf'?'PDF':'Excel'} · <span data-no-translate>${languageLabel(j.language)}</span> · ${esc(j.templateVersion||'')} · ${j.size?esc(L.size(j.size)):'未生成文件'}</small></td><td>${j.selectionCount||0} 个配色<br><small class="muted">${j.imageCount??0} 张图片</small></td><td>${esc(L.date(j.createdAt))}</td><td><span class="badge ${j.status==='completed'?'green':j.status==='failed'?'amber':'purple'}">${j.status==='completed'?'已完成':j.status==='failed'?'失败':'生成中'}</span></td><td><div class="ex-job-actions"><button class="btn small" data-job="${esc(j.id)}">详情</button>${j.status==='completed'?`<button class="btn small" data-redownload="${esc(j.id)}">再次下载</button>`:j.status==='failed'?`<button class="btn small" data-retry="${esc(j.id)}">重新导出</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state panel"><h3>还没有导出记录</h3><p>选择产品和模板，生成第一份产品资料。</p><button class="btn" id="ex-first-export">新建导出</button></div>'}`;
        content.querySelector('#ex-first-export')?.addEventListener('click',()=>changeTab('new'));content.querySelectorAll('[data-redownload]').forEach(b=>b.onclick=()=>downloadJob(jobs.find(j=>j.id===b.dataset.redownload)));content.querySelectorAll('[data-retry]').forEach(b=>b.onclick=()=>{try{const j=jobs.find(j=>j.id===b.dataset.retry),check=jobPermission(j);L.openExport(j.selection,check.invite,j.templateId,j.format||'xlsx',fileLanguage(j.language));}catch(error){L.toast(safeError(error));}});content.querySelectorAll('[data-job]').forEach(b=>b.onclick=()=>{const j=jobs.find(j=>j.id===b.dataset.job);try{if(!visibleJobs(current).some(item=>item.id===j?.id))throw new Error('此导出记录不属于当前邀请。');}catch(error){L.toast(safeError(error));return;}let permission='当前可重新下载';try{jobPermission(j);}catch(e){permission=safeError(e);}L.modal('导出记录',`<dl class="ex-job-detail"><div><dt>文件名</dt><dd data-no-translate>${esc(j.filename)}</dd></div><div><dt>文件语言</dt><dd data-no-translate>${languageLabel(j.language)}</dd></div><div><dt>模板版本</dt><dd>${esc(j.templateVersion||'')}</dd></div><div><dt>生成时间</dt><dd>${esc(L.date(j.createdAt))}</dd></div><div><dt>资料范围</dt><dd>${j.selectionCount} 个配色 / ${j.rowCount||0} 行 / ${j.imageCount||0} 张图片</dd></div></dl><div class="notice" style="margin-top:20px">${esc(j.status==='failed'?j.error:permission)}</div><p class="ex-caption">文件是生成时的资料快照。若需最新内容，请重新导出。</p>`);});
      }
    };paint();
  }
  L.register('templates',{title:'导出模板',subtitle:'统一客户资料的版式与字段标准',banner:true,render:renderTemplates});
  L.register('exports',{title:'导出表格',subtitle:'选择产品，生成 PDF 文档或 Excel 表格',banner:true,render:renderExports});
  L.exportTools={buildXlsx,dataRows,checkScope,inspectTemplate,jobPermission,downloadJob,visibleJobs};
})();
