/* UNIQMAG quotation importer. Local parsing only; no formula evaluation or network requests. */
(function () {
  'use strict';
  const all = (node, name) => Array.from(node.getElementsByTagNameNS('*', name));
  const first = (node, name) => all(node, name)[0];
  const text = (node, name) => first(node, name)?.textContent ?? '';
  const tidy = value => String(value ?? '').replace(/\r/g, '').trim();
  const keyOf = value => tidy(value).toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]+/g, '');
  const brandKey = value => tidy(value).toLowerCase();
  const slug = value => tidy(value).toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]+/g, '-').replace(/^-|-$/g, '');
  const blank = value => !tidy(value) || /^[_\s-]+$/.test(tidy(value));
  const nullable = value => blank(value) ? null : tidy(value);
  const typed = value => blank(value) ? null : /^-?\d+(?:\.\d+)?$/.test(tidy(value)) ? Number(value) : tidy(value);
  const pending = value => /_{2,}|confirm|unspecified|not stated|in process|3500\s*mm|requires|needs/i.test(value);
  function resolve(base, target) {
    const parts = target.startsWith('/') ? [] : base.split('/').slice(0, -1);
    target.split('/').forEach(part => { if (part === '..') parts.pop(); else if (part && part !== '.') parts.push(part); });
    return parts.join('/');
  }
  function relpath(part) { const a = part.split('/'); const name = a.pop(); return a.join('/') + '/_rels/' + name + '.rels'; }
  function colNo(value) { let n = 0; for (const c of value) n = n * 26 + c.charCodeAt(0) - 64; return n; }
  function colName(value) { let s = ''; for (let n = value; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; }
  function coordinate(value) { const m = value.match(/^([A-Z]+)(\d+)$/); return m ? { col: colNo(m[1]), row: Number(m[2]) } : { col: 0, row: 0 }; }
  function source(sheet, ref) { return ref; }
  function readXML(value, label) {
    if (/<!DOCTYPE|<!ENTITY/i.test(value)) throw new Error('文件包含不支持的 XML 声明：' + label);
    const doc = new DOMParser().parseFromString(value, 'application/xml');
    if (all(doc, 'parsererror').length) throw new Error('无法读取工作簿内容：' + label);
    return doc;
  }
  const colorLabels = { 'clearneon': '透明霓虹', 'kleinblue': '克莱因蓝', 'orange': '橙色', 'rose': '玫瑰红', 'grey': '灰色', 'gray': '灰色', 'white': '白色', 'red': '红色', 'black': '黑色', 'silverblack': '银黑色', 'silver': '银色', 'purple': '紫色', 'grayred': '灰红色' };
  const swatches = { 'clearneon': '#bddccc', 'kleinblue': '#204bbb', 'orange': '#ec773f', 'rose': '#d85b85', 'grey': '#8c9298', 'gray': '#8c9298', 'white': '#f0eeea', 'red': '#bf4748', 'black': '#292c30', 'silverblack': '#8b9095', 'silver': '#c2c6cc', 'purple': '#8972aa', 'grayred': '#ad7278' };
  const packTitles = { contents: '包装清单', retail: '零售包装', express: '快递包装', carton: '整箱包装', container: '装柜数量' };
  function splitPack(raw) {
    const sections = [];
    let active = null;
    for (const line of tidy(raw).split('\n')) {
      const s = line.trim();
      if (/^\*Box width/i.test(s)) { const retail = sections.find(section => section.id === 'retail'); if (retail) { retail.lines.push(s); continue; } }
      let id = /^BOX CONTENTS/i.test(s) ? 'contents' : /^RETAIL BOX/i.test(s) ? 'retail' : /^EXPRESS PACK/i.test(s) ? 'express' : /^MASTER CARTON/i.test(s) ? 'carton' : /^CONTAINER CAPACITY/i.test(s) ? 'container' : null;
      if (/^SHIPPING PACKAGING\s*$/i.test(s)) continue;
      if (id) { active = { id, lines: [s] }; sections.push(active); }
      else if (active && s) active.lines.push(s);
      else if (s) { active = { id: 'details', lines: [line] }; sections.push(active); }
    }
    return sections.map(s => ({ ...s, text: s.lines.join('\n').trim() }));
  }
  function parseSpecs(raw, old, src) {
    const oldByKey = new Map((old?.specs ?? []).map(s => [keyOf(s.key), s]));
    const result = [];
    for (const line of tidy(raw).split('\n').filter(Boolean)) {
      const parts = [line.trim()];
      for (const part of parts) {
        const at = part.indexOf(':');
        const key = at > 0 && !part.startsWith('*') ? part.slice(0, at).trim() : 'Source Note';
        const value = at > 0 && !part.startsWith('*') ? part.slice(at + 1).trim() : part.trim();
        const previous = oldByKey.get(keyOf(key));
        result.push({ label: previous?.label ?? (key === 'Source Note' ? '原表备注' : key), key, value, source: src, pending: pending(value) || key === 'Source Note' || (key === 'Color Options' && /Color Options:\s*Black\s*(?:\n|$)/i.test(raw) && old?.name === 'MX10') || (old?.name === 'TS10' && ['Video Output', 'Power Input', 'Built-in Games', 'Controller Power'].includes(key)) });
      }
    }
    return result;
  }
  function inferCategory(raw) {
    if (/keyboard/i.test(raw)) return { category: 'keyboard', categoryLabel: '磁轴键盘', type: '磁轴键盘' };
    if (/leverless/i.test(raw)) return { category: 'controller', categoryLabel: '无摇杆控制器', type: '无摇杆控制器' };
    if (/tv stick|tv remote/i.test(raw)) return { category: 'tv', categoryLabel: '游戏电视棒', type: '游戏电视棒' };
    if (/controller/i.test(raw)) return { category: 'controller', categoryLabel: '游戏手柄', type: '游戏手柄' };
    return { category: 'other', categoryLabel: '其他产品', type: '待分类产品' };
  }
  function relevantFields(product) {
    return {
      brand: nullable(product.brand),
      rawSpecs: tidy(product.rawSpecs),
      variants: product.variants.map(v => ({ color: v.color === 'Unspecified' ? null : nullable(v.color), sku: nullable(v.sku), availability: nullable(v.availability), moq: typed(v.moq), fob: typed(v.fob), msrp: typed(v.msrp), amazonCode: nullable(v.amazonCode), temuCode: nullable(v.temuCode), imageCount: v.images.length, barcode: Boolean(v.barcodeImage) })),
      packaging: product.packaging.map(p => ({ title: p.title, text: p.text, appliesTo: p.appliesTo, image: Boolean(p.image) }))
    };
  }
  async function parse(file, baseCatalog) {
    if (!window.JSZip) throw new Error('Excel 读取组件未加载，请刷新页面后重试。');
    if (!file || !/\.xlsx$/i.test(file.name)) throw new Error('请选择 .xlsx 格式的同结构产品报价表。');
    if (file.size > 150 * 1024 * 1024) throw new Error('文件超过 150 MB，请缩小图片或拆分报价表后重试。');
    const warnings = [];
    const zip = await window.JSZip.loadAsync(await file.arrayBuffer()).catch(() => { throw new Error('无法打开此 Excel 文件，请确认它未加密且格式为 .xlsx。'); });
    const xml = async part => { const entry = zip.file(part); return entry ? readXML(await entry.async('string'), part) : null; };
    const relationships = async part => {
      const doc = await xml(relpath(part));
      return new Map(doc ? all(doc, 'Relationship').filter(r => r.getAttribute('TargetMode') !== 'External').map(r => [r.getAttribute('Id'), resolve(part, r.getAttribute('Target'))]) : []);
    };
    const workbook = await xml('xl/workbook.xml');
    if (!workbook) throw new Error('此文件不是受支持的 Excel 工作簿。');
    const workbookRels = await relationships('xl/workbook.xml');
    const sharedDoc = await xml('xl/sharedStrings.xml');
    const shared = sharedDoc ? all(sharedDoc, 'si').map(si => all(si, 't').map(t => t.textContent).join('')) : [];
    const sheets = all(workbook, 'sheet');
    let table = null;
    for (const sheet of sheets) {
      const part = workbookRels.get(sheet.getAttribute('r:id') ?? sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
      if (!part) continue;
      const doc = await xml(part);
      if (!doc) continue;
      const cells = new Map();
      for (const cell of all(doc, 'c')) {
        const ref = cell.getAttribute('r');
        const type = cell.getAttribute('t');
        const v = text(cell, 'v');
        const value = type === 's' ? shared[Number(v)] ?? '' : type === 'inlineStr' ? all(cell, 't').map(t => t.textContent).join('') : v;
        cells.set(ref, { value, formula: text(cell, 'f'), ...coordinate(ref) });
      }
      const header = Array.from(cells.entries()).find(([, c]) => /Name\s*\/\s*Color\s*\/\s*Item\s*No/i.test(c.value));
      if (header) { table = { sheet: sheet.getAttribute('name'), part, doc, cells, headerRow: header[1].row }; break; }
    }
    if (!table) throw new Error('没有找到产品报价表表头。请使用含 Name / Color / Item No.、Specifications 和 Packaging Details 的原表结构。');
    if (sheets.length > 1) warnings.push('仅导入“' + table.sheet + '”工作表；其他工作表未纳入本次产品库。');
    const { sheet, part, doc, cells, headerRow } = table;
    const headers = Array.from(cells.values()).filter(c => c.row === headerRow);
    const headerCol = (re, required = false) => { const c = headers.find(c => re.test(c.value.replace(/\s+/g, ' '))); if (!c && required) throw new Error('缺少报价表字段：' + re); return c?.col; };
    const cols = { name: headerCol(/Name\s*\/\s*Color/i, true), brand: headerCol(/^(?:Brand(?: Name)?|(?:产品)?品牌)(?:\s*[/／]\s*(?:Brand(?: Name)?|(?:产品)?品牌))?$/i), specs: headerCol(/^Specifications$/i, true), image: headerCol(/^Picture$/i, true), packaging: headerCol(/^Packaging$/i, true), details: headerCol(/^Packaging Details$/i, true), barcode: headerCol(/^Bar\s*Code$/i), amazon: headerCol(/Amozon|Amazon/i), temu: headerCol(/Temu/i), moq: headerCol(/^MOQ$/i), fob: headerCol(/^FOB/i), msrp: headerCol(/^MSRP/i) };
    const merges = all(doc, 'mergeCell').map(m => { const [a, b] = m.getAttribute('ref').split(':'); return { a, start: coordinate(a), end: coordinate(b ?? a) }; });
    const cellAt = (col, row, followMerge = true) => {
      if (!col) return { value: '', formula: '', ref: '' };
      let ref = colName(col) + row;
      if (followMerge) { const merge = merges.find(m => col >= m.start.col && col <= m.end.col && row >= m.start.row && row <= m.end.row); if (merge) ref = merge.a; }
      return { value: '', formula: '', ...cells.get(ref), ref };
    };
    const imageAt = new Map();
    const appendImage = (ref, path) => { if (!path || !zip.file(path)) return; const list = imageAt.get(ref) ?? []; if (!list.includes(path)) list.push(path); imageAt.set(ref, list); };
    const drawingRels = await relationships(part);
    for (const drawing of all(doc, 'drawing')) {
      const drawingPart = drawingRels.get(drawing.getAttribute('r:id'));
      if (!drawingPart) continue;
      const drawingDoc = await xml(drawingPart); if (!drawingDoc) continue;
      const mediaRels = await relationships(drawingPart);
      const anchors = [...all(drawingDoc, 'oneCellAnchor'), ...all(drawingDoc, 'twoCellAnchor')];
      for (const anchor of anchors) {
        const from = first(anchor, 'from'); if (!from) continue;
        const ref = colName(Number(text(from, 'col')) + 1) + (Number(text(from, 'row')) + 1);
        for (const blip of all(anchor, 'blip')) appendImage(ref, mediaRels.get(blip.getAttribute('r:embed')));
      }
    }
    const cellImageDoc = await xml('xl/cellimages.xml');
    if (cellImageDoc) {
      const rels = await relationships('xl/cellimages.xml');
      const imageIds = new Map();
      for (const pic of all(cellImageDoc, 'pic')) {
        const props = first(pic, 'cNvPr'); const blip = first(pic, 'blip');
        if (props && blip) imageIds.set(props.getAttribute('name'), rels.get(blip.getAttribute('r:embed')));
      }
      for (const [ref, cell] of cells) {
        const m = (cell.formula || cell.value).match(/(?:_xlfn\.)?DISPIMG\s*\(\s*"([^"]+)"/i);
        if (m) { const path = imageIds.get(m[1]); if (path) appendImage(ref, path); else warnings.push(source(sheet, ref) + ' 的嵌入图片未找到。'); }
      }
    }
    const formulaCount = Array.from(cells.values()).filter(c => c.formula && !/DISPIMG/i.test(c.formula)).length;
    if (formulaCount) warnings.push('有 ' + formulaCount + ' 个公式单元格；只读取文件中的缓存值，不执行或重新计算公式。');
    const imageCache = new Map();
    const mediaHashes = {};
    let hashUnavailable = false;
    const loadImage = async (path, original = false) => {
      if (!path) return null;
      const cacheKey = path + ':' + original;
      if (imageCache.has(cacheKey)) return imageCache.get(cacheKey);
      const promise = (async () => {
        const bytes = await zip.file(path).async('uint8array');
        if (crypto.subtle) { const hash = await crypto.subtle.digest('SHA-256', bytes); mediaHashes[path] = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join(''); }
        else hashUnavailable = true;
        const mime = /\.jpe?g$/i.test(path) ? 'image/jpeg' : /\.webp$/i.test(path) ? 'image/webp' : /\.gif$/i.test(path) ? 'image/gif' : 'image/png';
        const blob = new Blob([bytes], { type: mime });
        if (original) return await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('图片读取失败')); reader.readAsDataURL(blob); });
        const url = URL.createObjectURL(blob);
        try {
          const img = new Image(); img.src = url; await img.decode();
          const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
          const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL('image/webp', .9);
        } catch (_) { warnings.push(path + ' 无法压缩，保留原始图片。'); return await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(blob); }); }
        finally { URL.revokeObjectURL(url); }
      })();
      imageCache.set(cacheKey, promise); return promise;
    };
    const baseProducts = baseCatalog?.products ?? [];
    const products = [];
    const groups = new Map();
    const namedRows = Array.from(cells.entries()).filter(([, c]) => c.col === cols.name && c.row > headerRow && tidy(c.value));
    const modelAt = (name,row,spec) => name.match(/^([A-Za-z]{1,12}\d+(?:[-.]\d+)?)/)?.[1] ?? (/Product Name:/i.test(spec) || /^\d+$/.test(tidy(cellAt(cols.name - 1,row).value)) ? name.split('\n')[0].trim() : null);
    const declaredBrands=new Map();
    for(const [,c] of namedRows){const model=modelAt(tidy(c.value),c.row,cellAt(cols.specs,c.row).value),brand=nullable(cellAt(cols.brand,c.row).value);if(!model||!brand)continue;const values=declaredBrands.get(keyOf(model))||new Map();values.set(brandKey(brand),brand);declaredBrands.set(keyOf(model),values);}
    for (const [ref, c] of namedRows) {
      const name = tidy(c.value);
      const specCell = cellAt(cols.specs, c.row);
      const model = modelAt(name,c.row,specCell.value);
      if (!model) { warnings.push(source(sheet, ref) + ' 无法识别为产品，已保留在预览警告中：' + name.slice(0, 80)); continue; }
      const modelKey = keyOf(model);
      const modelBrands=declaredBrands.get(modelKey);
      const explicitBrand = nullable(cellAt(cols.brand, c.row).value) ?? (modelBrands?.size===1 ? [...modelBrands.values()][0] : null);
      const sku = nullable(name.match(/Item\s*No\.?\s*:\s*([^\n]*)/i)?.[1]);
      const candidates = baseProducts.filter(p => keyOf(p.name) === modelKey || keyOf(p.id) === modelKey);
      const matchingBrand = explicitBrand ? candidates.filter(p => brandKey(p.brand) === brandKey(explicitBrand)) : candidates;
      const matchingSku = sku ? candidates.filter(p => p.variants?.some(v=>nullable(v.sku)===sku)) : [];
      const old = matchingBrand.length === 1 ? matchingBrand[0] : matchingSku.length === 1 ? matchingSku[0] : null;
      const brand = explicitBrand ?? (typeof old?.brand === 'string' ? old.brand : undefined);
      const groupKey = modelKey + ':' + brandKey(brand);
      let group = groups.get(groupKey);
      if (!group) {
        const unclaimedOld = old && !products.some(p => p.id === old.id) ? old : null;
        const usedIds = new Set([...baseProducts.map(p => p.id), ...products.map(p => p.id)]);
        let newId = slug(model), suffix = 2;
        if(usedIds.has(newId))newId=slug(model+'-'+(brand||'unspecified'));
        const idBase=newId;
        while(usedIds.has(newId))newId=idBase+'-'+suffix++;
        const product = { id: unclaimedOld?.id ?? newId, name: model, ...(brand!==undefined?{brand}:{}), ...(old ? { category: old.category, categoryLabel: old.categoryLabel, type: old.type } : inferCategory(specCell.value)), description: old?.description ?? '从报价表导入的产品资料', tags: old?.tags ?? [], specs: parseSpecs(specCell.value, old, source(sheet, specCell.ref)), rawSpecs: tidy(specCell.value), variants: [], packaging: [], issues: [] };
        if (old && tidy(old.rawSpecs) !== product.rawSpecs) { product.description = product.specs.find(s => s.key === 'Product Name')?.value ?? '从报价表导入的产品资料'; product.tags = product.specs.filter(s => ['Connection', 'Polling Rate', 'Sensor'].includes(s.key)).map(s => s.value).filter(Boolean).slice(0, 3); }
        group = { product, old:unclaimedOld, rows: [], media: new Set(), specRef: specCell.ref }; groups.set(groupKey, group); products.push(product);
        if(candidates.length>1&&!unclaimedOld)warnings.push(model+' 匹配到多个已有产品，已按品牌新增独立草稿，请核对后发布。');
        if (!old) warnings.push('发现新产品 ' + model + '，已纳入导入结果，请检查分类和中文标签。');
      }
      group.rows.push(c.row);
      if (tidy(specCell.value) !== group.product.rawSpecs) {
        warnings.push(model + ' 的不同版本存在不同规格，已在产品疑点中保留，请核对。');
        group.product.issues.push({ id: slug(model) + '-spec-' + c.row, field: '版本规格', message: name + '\n' + specCell.value, source: source(sheet, specCell.ref), severity: 'warning' });
      }
      let color = name.replace(/Item\s*No\.?\s*:[^\n]*/gi, '').slice(model.length).replace(/^\s*Color\s*:\s*/i, '').trim();
      color = nullable(color.replace(/\n+/g, ' '));
      const oldVariant = group.old?.variants.find(v => sku != null ? v.sku === sku : keyOf(v.color === 'Unspecified' ? null : v.color) === keyOf(color));
      const moqCell = cellAt(cols.moq, c.row);
      const availability = /sold\s*out/i.test(moqCell.value) ? tidy(moqCell.value) : null;
      const nameMerge = merges.find(m => m.start.col === cols.name && m.start.row === c.row);
      const endRow = nameMerge?.end.row ?? c.row;
      const imagePaths = Array.from(imageAt.entries()).filter(([r]) => { const xy = coordinate(r); return xy.col === cols.image && xy.row >= c.row && xy.row <= endRow; }).flatMap(([, paths]) => paths);
      const barcodePaths = imageAt.get(cellAt(cols.barcode, c.row).ref) ?? [];
      let variantId=oldVariant?.id ?? slug(model + '-' + (color ?? sku ?? 'row-' + c.row));
      const usedVariantIds=new Set(products.flatMap(p=>p.variants.map(v=>v.id)));
      if(usedVariantIds.has(variantId)){const prefix=slug(variantId+'-'+(brand||'unspecified'));variantId=prefix;let suffix=2;while(usedVariantIds.has(variantId))variantId=prefix+'-'+suffix++;}
      const variant = { id: variantId, color, colorLabel: oldVariant?.colorLabel ?? (color == null ? '颜色待确认' : colorLabels[keyOf(color)] ?? color), swatch: oldVariant?.swatch ?? swatches[keyOf(color)] ?? '#a7adb3', sku, images: [], barcodeImage: null, availability, moq: availability ? null : typed(moqCell.value), fob: typed(cellAt(cols.fob, c.row).value), msrp: typed(cellAt(cols.msrp, c.row).value), amazonCode: nullable(cellAt(cols.amazon, c.row).value), temuCode: nullable(cellAt(cols.temu, c.row).value), sourceRow: c.row };
      for (const path of new Set(imagePaths)) { variant.images.push(await loadImage(path)); group.media.add(path); }
      if (barcodePaths[0]) { variant.barcodeImage = await loadImage(barcodePaths[0], true); group.media.add(barcodePaths[0]); }
      if (!variant.images.length) warnings.push(model + ' ' + (color ?? '') + ' 未找到产品图片。');
      group.product.variants.push(variant);
    }
    if (!products.length) throw new Error('未识别到产品条目，原产品库没有被修改。');
    const sortedGroups = Array.from(groups.values()).sort((a, b) => a.rows[0] - b.rows[0]);
    for (let index = 0; index < sortedGroups.length; index++) {
      const group = sortedGroups[index]; const p = group.product;
      const firstRow = group.rows[0]; const lastRow = sortedGroups[index + 1]?.rows[0] - 1 || Math.max(...group.rows) + 2;
      const detailCells = Array.from(new Map(group.rows.map(r => { const cell = cellAt(cols.details, r); return [cell.ref, cell]; })).values());
      p.packagingRaw = detailCells.map(c => tidy(c.value)).filter(Boolean).join('\n\n');
      const packImages = Array.from(imageAt.entries()).filter(([r]) => { const xy = coordinate(r); return xy.col === cols.packaging && xy.row >= firstRow && xy.row <= lastRow; }).map(([ref, paths]) => ({ ref, paths, title: tidy(cellAt(cols.packaging, coordinate(ref).row).value) }));
      for (const detailCell of detailCells) for (const section of splitPack(detailCell.value)) {
        const candidate = packImages.find(i => section.id === 'retail' ? /RETAIL BOX/i.test(i.title) : section.id === 'express' ? /Express pack/i.test(i.title) : section.id === 'carton' ? /Master carton/i.test(i.title) : false);
        const path = candidate?.paths[0];
        const oldPack = group.old?.packaging.find(i => i.key === section.id || i.title === packTitles[section.id]);
        const appliesTo = section.text.match(/\(([A-Z0-9]+-[A-Z0-9]+)\s+only\)/i)?.[1]?.replace('-', '') ?? null;
        p.packaging.push({ key: section.id, title: oldPack?.title ?? packTitles[section.id] ?? '包装详情', text: section.text, image: path ? await loadImage(path) : null, appliesTo, source: source(sheet, detailCell.ref), pending: pending(section.text) });
        if (path) group.media.add(path);
      }
      // Preserve any packaging picture even if its text heading is missing or unfamiliar.
      for (const picture of packImages) for (const path of picture.paths) if (!group.media.has(path)) {
        p.packaging.push({ key: 'image-' + picture.ref, title: picture.title || '包装图片', text: '', image: await loadImage(path), appliesTo: null, source: source(sheet, picture.ref), pending: false }); group.media.add(path);
      }
      const issue = (id, field, message, ref) => p.issues.push({ id: p.id + '-' + id, field, message, source: source(sheet, ref), severity: 'warning' });
      if (/3500\s*mm/i.test(p.rawSpecs)) issue('rt-range', 'RT 调节范围', '原表上限为 3500 mm，单位或小数点需要确认；未自行改写。', group.specRef);
      if (p.variants.some(v => !v.sku)) issue('sku', '货号', '部分颜色版本未提供货号，系统标识不作为 SKU。', colName(cols.name) + firstRow);
      if (p.variants.some(v => !v.color)) issue('color', '颜色', '原表未填写颜色。', colName(cols.name) + firstRow);
      if (/Color Options:\s*Black\s*(?:\n|$)/i.test(p.rawSpecs) && p.variants.some(v => v.color && keyOf(v.color) !== 'black')) issue('color-conflict', '颜色选项', '规格写为 Black，与颜色版本列表不一致，需确认。', group.specRef);
      if (p.variants.some(v => v.availability)) issue('availability', '表中销售状态', 'Sold out 来自报价表原始标记，不能据此判断当前库存。', colName(cols.moq) + p.variants.find(v => v.availability).sourceRow);
      for (const s of p.specs.filter(s => s.pending && !/3500\s*mm/i.test(s.value))) issue('spec-' + slug(s.key), s.label, s.value, group.specRef);
      for (const pack of p.packaging.filter(x => x.pending)) issue('pack-' + pack.key, pack.title, '原表含空缺、待确认信息或未注明单位，详见包装原文。', detailCells[0].ref);
      p.sourceMedia = Array.from(group.media);
    }
    const removed = baseProducts.filter(old => !products.some(p => p.id === old.id));
    if (removed.length) warnings.push('本次导入将移除原产品库中未出现在表格内的系列：' + removed.map(p => p.name).join('、') + '。确认导入前请核对。');
    for (const group of groups.values()) if (group.old) {
      const missing = group.old.variants.filter(v => !group.product.variants.some(n => n.id === v.id || (n.sku && n.sku === v.sku)));
      if (missing.length) warnings.push(group.product.name + ' 将移除 ' + missing.length + ' 个未出现在新表格中的版本。');
    }
    if (hashUnavailable) warnings.push('当前浏览环境不支持图片指纹比对，图片已重新读取，请在预览中检查。');
    let changed = 0, added = 0;
    for (const group of groups.values()) {
      if (!group.old) { added++; continue; }
      const a = relevantFields(group.old); const b = relevantFields(group.product);
      const oldHashes = baseCatalog?.source?.mediaHashes;
      const changedImages = oldHashes ? Array.from(group.media).some(path => mediaHashes[path] !== oldHashes[path]) : false;
      if (JSON.stringify(a) !== JSON.stringify(b) || changedImages) changed++;
    }
    const catalog = { schemaVersion: 1, source: { filename: file.name, sheet, importedAt: new Date().toISOString(), mediaHashes }, products };
    return { catalog, summary: { products: products.length, variants: products.reduce((n, p) => n + p.variants.length, 0), added, changed, removed: removed.length }, warnings: Array.from(new Set(warnings)) };
  }
  window.ProductImporter = Object.freeze({ parse, supportedFormat: '支持此产品报价表的同结构 .xlsx 文件；图片和数据仅在当前浏览器本地处理。' });
})();
