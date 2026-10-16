/* Product branding is separate from the company that provides the library. */
(() => {
  'use strict';
  const L = window.Library;
  const brands = Object.freeze([
    Object.freeze({id:'uniqmag',name:'UNIQMAG',logo:'assets/logo.png'}),
    Object.freeze({id:'unico',name:'UNICO',logo:'assets/unico-logo.png'}),
    Object.freeze({id:'neocade',name:'NEOCADE',logo:'assets/unico/original/image107.jpg'}),
    Object.freeze({id:'blazepro',name:'BLAZEPRO',logo:'assets/unico/original/image90.png'})
  ]);
  const normalize = value => String(value ?? '').trim();
  const known = value => brands.find(brand => brand.name === normalize(value).replace(/\s+/g,'').toUpperCase());
  const companyId = () => L.companyId?.() || L.company?.().id || 'uniqmag';
  function productBrand(product) {
    if (!product || typeof product !== 'object') return null;
    // An explicitly blank brand stays blank, including after editing legacy products.
    if (Object.prototype.hasOwnProperty.call(product,'brand')) {
      const name = normalize(product.brand);
      return name ? known(name) || {id:'custom:'+name.toLowerCase(),name,logo:''} : null;
    }
    const tagged = (product.tags || []).map(known).find(Boolean);
    if (tagged) return tagged;
    // Only old UNIQMAG records predate the brand field. Never infer UNICO by company.
    return companyId() === 'uniqmag' ? brands[0] : null;
  }
  L.productBrand = productBrand;
  L.brandKey = product => productBrand(product)?.id || 'unassigned';
  L.availableBrands = () => brands.filter(brand => companyId() === 'unico' ? brand.id !== 'uniqmag' : brand.id === 'uniqmag');
  L.productBrands = products => {
    const found = new Map();
    for (const product of products || []) {
      const brand = productBrand(product) || {id:'unassigned',name:'未指定',logo:''};
      if (!found.has(brand.id)) found.set(brand.id,brand);
    }
    const order = new Map(brands.map((brand,index) => [brand.id,index]));
    return [...found.values()].sort((a,b) => (order.get(a.id) ?? (a.id === 'unassigned' ? 100 : 10)) - (order.get(b.id) ?? (b.id === 'unassigned' ? 100 : 10)) || a.name.localeCompare(b.name));
  };
  L.brandMark = (product,{className='',label=false}={}) => {
    const brand = productBrand(product);
    if (!brand) return '';
    const kind = brands.some(item => item.id === brand.id) ? brand.id : 'custom';
    return `<span class="product-brand-mark product-brand-${kind}${className?' '+L.esc(className):''}" data-product-brand="${L.esc(brand.id)}">${brand.logo?`<img src="${L.esc(brand.logo)}" alt="${L.esc(brand.name)}" decoding="async">`:''}${label||!brand.logo?`<span class="product-brand-name">${L.esc(brand.name)}</span>`:''}</span>`;
  };
})();
