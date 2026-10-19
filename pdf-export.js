(() => {
  'use strict';
  const L=window.Library;
  const root=new URL('.',document.currentScript?.src||location.href);
  const fontNames=['NotoSansSC-Regular.otf','NotoSansSC-Bold.otf'];
  let enginePromise=null,fontPromise=null;
  const clean=value=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
  const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
  function loadEngine(){
    if(window.pdfMake)return Promise.resolve(window.pdfMake);
    if(!enginePromise)enginePromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=new URL('vendor/pdfmake-0.2.20.min.js',root).href;
      const timer=setTimeout(()=>{script.remove();reject(new Error('PDF 组件加载超时，请检查网络后重试。'));},45000);
      script.onload=()=>{clearTimeout(timer);window.pdfMake?resolve(window.pdfMake):reject(new Error('PDF 组件未能启动。'));};
      script.onerror=()=>{clearTimeout(timer);script.remove();reject(new Error('PDF 组件加载失败，请检查网络后重试。'));};
      document.head.append(script);
    }).catch(error=>{enginePromise=null;throw error;});
    return enginePromise;
  }
  function base64(bytes){let out='';for(let i=0;i<bytes.length;i+=0x8000)out+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(out);}
  function loadFonts(){
    if(!fontPromise)fontPromise=Promise.all(fontNames.map(async name=>{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
      try{const response=await fetch(new URL('vendor/pdf-fonts/'+name,root),{signal:controller.signal,credentials:'same-origin'});if(!response.ok)throw new Error('字体文件未就绪');const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length<10000)throw new Error('字体文件不完整');return [name,base64(bytes)];}
      catch{throw new Error('PDF 中文字体加载失败，请检查网络后重试。');}finally{clearTimeout(timer);}
    })).then(Object.fromEntries).catch(error=>{fontPromise=null;throw error;});
    return fontPromise;
  }
  function safeImage(url){
    if(!url)return '';
    const value=String(url);
    if(/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value)&&value.length<=24*1024*1024)return value;
    let resolved;try{resolved=new URL(value,root);}catch{throw new Error('PDF 图片地址无效。');}
    const assets=new URL('assets/',root);
    if(resolved.origin!==assets.origin||!resolved.pathname.startsWith(assets.pathname)||resolved.username||resolved.password||!/^https?:$/.test(resolved.protocol))throw new Error('PDF 仅支持本站素材与已上传图片，请先把图片保存到素材库。');
    return resolved.href;
  }
  // These are print-sized thumbnails; original assets stay unchanged. Logos keep a separate high-resolution path.
  function imageData(url,maxEdge=360){
    const safe=safeImage(url);if(!safe)return Promise.resolve(null);
    return new Promise((resolve,reject)=>{
      const image=new Image();image.crossOrigin='anonymous';
      const timer=setTimeout(()=>{image.onload=image.onerror=null;image.src='';reject(new Error('PDF 图片读取超时，请稍后重试。'));},25000);
      image.onerror=()=>{clearTimeout(timer);reject(new Error('PDF 图片读取失败，请检查素材是否仍然可用。'));};
      image.onload=()=>{clearTimeout(timer);try{
        if(!image.naturalWidth||!image.naturalHeight)throw new Error('图片尺寸无效');
        const scale=Math.min(1,maxEdge/Math.max(image.naturalWidth,image.naturalHeight));
        const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
        const context=canvas.getContext('2d');if(!context)throw new Error('浏览器未提供图片画布');context.drawImage(image,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL('image/png'));
      }catch{reject(new Error('PDF 图片无法转换，请重新上传 PNG、JPEG 或 WebP 图片。'));}};
      image.src=safe;
    });
  }
  function layoutSettings(value){
    if(value===undefined)return null;
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['orientation','fontSize','margin','footerText'].includes(key)))throw new Error('PDF 模板版式设置不正确。');
    if(!['portrait','landscape'].includes(value.orientation))throw new Error('PDF 模板纸张方向须为纵向或横向。');
    if(typeof value.fontSize!=='number'||!Number.isFinite(value.fontSize)||value.fontSize<8||value.fontSize>12)throw new Error('PDF 模板字号须为 8 至 12。');
    if(!Number.isInteger(value.margin)||value.margin<12||value.margin>25)throw new Error('PDF 模板页边距须为 12 至 25 毫米的整数。');
    if(typeof value.footerText!=='string'||[...value.footerText].length>120||/[\u0000-\u001f\u007f]/.test(value.footerText))throw new Error('PDF 模板页脚须为不超过 120 个字符的单行文字。');
    return {orientation:value.orientation,fontSize:value.fontSize,margin:value.margin,footerText:value.footerText};
  }
  function imageColumn(value,count){
    if(value===undefined)return 0;
    if(!Number.isInteger(value)||value<0||value>=count)throw new Error('PDF 图片列位置无效。');
    return value;
  }
  function definition(spec,pictures,logo){
    const count=spec.headers.length,layout=layoutSettings(spec.layout),photoColumn=imageColumn(spec.imageColumn,count),landscape=layout?layout.orientation==='landscape':count>6;
    const pageWidth=landscape?841.89:595.28,sideMargin=layout?layout.margin*72/25.4:32,available=pageWidth-sideMargin*2-count*12;
    const raw=Array.isArray(spec.widths)&&spec.widths.length===count?spec.widths:Array(count).fill(1);
    const weights=raw.map(v=>typeof v==='number'&&Number.isFinite(v)&&v>0?v:1),sum=weights.reduce((a,b)=>a+b,0);
    const fontSize=layout?layout.fontSize:landscape?8:9;
    // A custom layout keeps at least one CJK glyph in every column, even after reordering.
    const minWidth=layout?fontSize+2:0,widths=weights.map(v=>minWidth+(available-minWidth*count)*v/sum);
    const body=[spec.headers.map(text=>({text:clean(text),bold:true,color:'#ffffff',fillColor:'#202020',margin:[0,4,0,4]}))];
    spec.rows.forEach((row,index)=>body.push(row.values.map((value,column)=>{
      const text={text:clean(value),margin:[0,2,0,2]};
      if(column===photoColumn&&pictures[index])return {stack:[{image:pictures[index],fit:[Math.max(layout||spec.imageColumn!==undefined?1:20,widths[photoColumn]-2),76],margin:[0,3,0,5]},text]};
      return text;
    })));
    const title=clean(spec.title||'产品资料'),name=clean(spec.company.name);
    const content=[{text:title,fontSize:landscape?18:21,bold:true,margin:[0,0,0,landscape?3:5]}];
    if(spec.subtitle)content.push({text:clean(spec.subtitle),color:'#666666',fontSize:landscape?9:10,margin:[0,0,0,landscape?6:12]});
    if(spec.meta?.length)content.push({table:{widths:['*','*'],body:Array.from({length:Math.ceil(spec.meta.length/2)},(_,r)=>[0,1].map(c=>{const item=spec.meta[r*2+c];return {text:item?[{text:clean(item.label)+'：',color:'#666666'},clean(item.value)]:'',margin:[0,0,0,landscape?3:5]};}))},layout:'noBorders',fontSize:layout?fontSize:landscape?8.5:fontSize,margin:[0,0,0,landscape?8:12]});
    content.push({table:{headerRows:1,keepWithHeaderRows:0,dontBreakRows:false,widths,body},layout:{hLineWidth:i=>i===1?0:.5,vLineWidth:()=>0,hLineColor:()=>'#dddddd',paddingLeft:()=>6,paddingRight:()=>6,paddingTop:()=>landscape?4:5,paddingBottom:()=>landscape?4:5,fillColor:i=>i>0&&i%2===0?'#f5f5f5':null}});
    if(spec.totals?.length)content.push({table:{widths:['*',120],body:spec.totals.map(item=>[{text:clean(item.label),alignment:'right',bold:true},{text:clean(item.value),alignment:'right',bold:true}])},layout:'noBorders',margin:[0,14,0,8],fontSize:layout?Math.max(fontSize,11):11});
    if(spec.notes?.length)content.push({text:'备注 / Notes',bold:true,fontSize:layout?Math.max(fontSize,10):10,margin:[0,14,0,5]},{stack:spec.notes.map(note=>({text:clean(note),margin:[0,0,0,5]})),color:'#555555',fontSize:layout?fontSize:9});
    // The requested margin is the outer safe area. Reserve extra space for the repeated logo and footer.
    const pageMargins=layout?[sideMargin,sideMargin+(landscape?46:56),sideMargin,sideMargin+48]:[32,landscape?62:78,32,landscape?32:42];
    return {pageSize:'A4',pageOrientation:landscape?'landscape':'portrait',pageMargins,defaultStyle:{font:'NotoSC',fontSize,lineHeight:landscape?1.08:1.18,color:'#202020'},info:{title,author:name,creator:name+' Product Library',subject:clean(spec.subtitle||title)},compress:true,
      header:()=>({margin:[sideMargin,layout?sideMargin:landscape?16:22,sideMargin,0],stack:[{columns:[logo?{image:logo,fit:landscape?[118,26]:[132,34],width:150}:{text:name,bold:true,fontSize:19,width:150},{text:title,alignment:'right',color:'#777777',fontSize:9,margin:[8,9,0,0]}]},{canvas:[{type:'line',x1:0,y1:8,x2:pageWidth-sideMargin*2,y2:8,lineWidth:.7,lineColor:'#303030'}]}]}),
      footer:(page,total)=>({columns:layout?[{text:layout.footerText,width:'*',color:'#777777'},{text:`${page} / ${total}`,width:50,alignment:'right',color:'#777777'}]:[{text:name,color:'#777777'},{text:`${page} / ${total}`,alignment:'right',color:'#777777'}],fontSize:8,margin:[sideMargin,layout?8:15,sideMargin,0]}),content};
  }
  async function build(spec,{validate,progress=()=>{}}={}){
    if(typeof validate!=='function')throw new Error('PDF 导出缺少权限校验。');
    await validate();
    if(!spec?.company?.id||!Array.isArray(spec.headers)||spec.headers.length<1||spec.headers.length>12||!Array.isArray(spec.rows)||!spec.rows.length||spec.rows.length>2000)throw new Error('PDF 资料范围不完整或超过 2000 行，请分批导出。');
    if(spec.rows.some(row=>!Array.isArray(row.values)||row.values.length!==spec.headers.length))throw new Error('PDF 表格列数不一致。');
    layoutSettings(spec.layout);imageColumn(spec.imageColumn,spec.headers.length);
    // Snapshot content before asynchronous work; the caller rechecks live authorization and revisions.
    const snapshot=structuredClone(spec);progress(3);await pause();await validate();
    const [engine,vfs]=await Promise.all([loadEngine(),loadFonts()]);await validate();progress(22);
    const cache=new Map(),pictures=[];
    const read=async(url,maxEdge=360)=>{if(!url)return null;const safe=safeImage(url),key=safe+'|'+maxEdge;if(!cache.has(key))cache.set(key,imageData(safe,maxEdge));const image=await cache.get(key);await validate();return image;};
    const logo=await read(snapshot.company.logo,1400);await validate();
    for(let i=0;i<snapshot.rows.length;i++){await validate();pictures.push(await read(snapshot.rows[i].image));progress(22+Math.round((i+1)/snapshot.rows.length*55));if(i%12===0)await pause();}
    await validate();const doc=definition(snapshot,pictures,logo);progress(82);await pause();await validate();
    const fonts={NotoSC:{normal:fontNames[0],bold:fontNames[1],italics:fontNames[0],bolditalics:fontNames[1]}};
    // getStream with local VFS throws layout/font failures synchronously, unlike 0.2's callback output helpers.
    const blob=await new Promise((resolve,reject)=>{
      let stream;const chunks=[];let settled=false;
      const timer=setTimeout(()=>finish(new Error('PDF 生成超时，请减少产品数量后重试。')),120000);
      function finish(error,result){if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(result);}
      try{stream=engine.createPdf(doc,undefined,fonts,vfs).getStream();stream.on('data',chunk=>chunks.push(chunk));stream.on('error',error=>finish(new Error('PDF 生成失败：'+(error?.message||error))));stream.on('end',()=>finish(null,new Blob(chunks,{type:'application/pdf'})));stream.end();}catch(error){finish(new Error('PDF 生成失败：'+(error?.message||error)));}
    });
    await validate();if(blob.size<100)throw new Error('PDF 文件未能完整生成。');progress(100);return blob;
  }
  L.pdfExport={build};
})();
