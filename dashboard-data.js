/* Read-only dashboard summaries of the current browser workspace. */
(() => {
  'use strict';
  const L = window.Library;
  const list = value => Array.isArray(value) ? value.filter(Boolean) : [];
  const metric = (label, value) => ({ label, value });
  const fixedKinds = new Set(['catalog', 'sku', 'packaging']);
  const permission = { assets:'upload', downloads:'export', invites:'invites', templates:'templates', exports:'export', team:'team', activity:'activity' };
  const count = (items, match) => items.filter(match).length;
  const variants = product => list(product.variants);
  const published = products => products.filter(product => product.isLive && product.liveSnapshot).map(product => product.liveSnapshot);
  const parameter = (params, name) => typeof params?.get === 'function' ? params.get(name) : params?.[name];
  const summary = (label, metrics, segments, note='本机数据') => ({ label, metrics, segments, note });

  function invitationStatus(invite, now) {
    if (invite.status === 'revoked') return 'revoked';
    const expiry = new Date(invite.expiresAt).getTime();
    if (!Number.isFinite(expiry) || expiry <= now) return 'expired';
    return invite.status === 'paused' ? 'paused' : 'active';
  }

  function fileTypes(assets) {
    return [metric('图片', count(assets, asset => asset.type === 'image')),
      metric('视频', count(assets, asset => asset.type === 'video')),
      metric('文档 / 文件', count(assets, asset => !['image', 'video'].includes(asset.type)))];
  }

  function assetSummary(route, params, products, assets) {
    const productId = parameter(params, 'product');
    const productIds = new Set(products.map(product => product.id));
    const unlinked = asset => !list(asset.productIds).some(id => productIds.has(id));
    const folder = productId !== null && productId !== undefined;
    if (folder && productId !== 'unlinked' && !productIds.has(productId)) return null;
    const scoped = folder ? assets.filter(asset => productId === 'unlinked' ? unlinked(asset) : list(asset.productIds).includes(productId)) : assets;
    const active = scoped.filter(asset => asset.status !== 'archived');
    // These are inventory counts, not download successes or unique visitors.
    return summary(folder ? '资料夹文件类型' : '素材文件类型', folder
      ? [metric('素材文件', scoped.length), metric('可用素材', active.length), metric('已归档', scoped.length - active.length)]
      : [metric('产品资料夹', products.length), metric('可用素材', active.length), metric('待关联素材', count(assets, unlinked))],
    fileTypes(scoped), '本机数据 · 含已归档素材');
  }

  function activitySummary(logs, now) {
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfWeek.getDate() - 6);
    const recent = logs.filter(log => {
      const time = new Date(log.time).getTime();
      return Number.isFinite(time) && time >= startOfWeek.getTime() && time <= now;
    });
    const kind = log => {
      const action = String(log.action || '');
      if (/邀请|成员|角色|客户访问/.test(action)) return '邀请与成员';
      if (/导出|生成产品资料/.test(action)) return '表格导出';
      if (/下载/.test(action)) return '文件下载';
      return '资料维护及其他';
    };
    return summary('近 7 日操作类型', [metric('已保存记录', logs.length), metric('近 7 日操作', recent.length),
      metric('今日操作', count(recent, log => new Date(log.time).getTime() >= startOfToday.getTime()))],
    ['资料维护及其他','邀请与成员','文件下载','表格导出'].map(label => metric(label, count(recent, log => kind(log) === label))),
    '本机数据 · 仅统计已保存记录');
  }

  L.dashboardData = (route, params) => {
    if (!L.state || !L.isStaff?.()) return null;
    if (permission[route] && !L.can?.(permission[route])) return null;
    const products = list(L.state.products), assets = list(L.state.assets), templates = list(L.state.templates).filter(template => !['print','print-settings','quotation-template','quotation-template-settings'].includes(template.kind));
    const jobs = list(L.state.jobs), live = published(products), now = Date.now();

    if (route === 'products' || route === 'portal') {
      const names = { published:'已发布', draft:'草稿', review:'待发布', archived:'已下架' };
      return summary('工作版本状态', [metric('产品型号', products.length), metric('颜色 / SKU', products.reduce((total, product) => total + variants(product).length, 0)), metric('客户可见型号', live.length)],
        Object.entries(names).map(([status, label]) => metric(label, count(products, product => (Object.hasOwn(names, product.status) ? product.status : 'draft') === status))),
        '本机数据 · 草稿修改不影响已发布版本');
    }
    if (route === 'assets' || route === 'downloads') return assetSummary(route, params, products, assets);
    if (route === 'invites') {
      const invites = list(L.state.invites), statuses = invites.map(invite => invitationStatus(invite, now));
      const active = count(statuses, status => status === 'active'), paused = count(statuses, status => status === 'paused');
      const expired = count(statuses, status => status === 'expired'), revoked = count(statuses, status => status === 'revoked');
      return summary('邀请状态', [metric('全部邀请', invites.length), metric('当前有效', active), metric('已暂停', paused), metric('过期 / 撤销', expired + revoked)],
        [metric('有效', active), metric('已暂停', paused), metric('已过期', expired), metric('已撤销', revoked)], '本机数据 · 模拟邀请');
    }
    if (route === 'templates') {
      if (parameter(params, 'tab') === 'quotation') {
        const items=L.quotationTemplates?.list?.()||[],custom=items.filter(template=>!template.builtin);
        const current=L.quotationTemplates?.get?.(L.quotationTemplates.defaultId());
        return summary('报价模板配置',[metric('全部报价模板',items.length),metric('内置模板',1),metric('自定义模板',custom.length)],
          [metric('内置模板',1),metric('自定义模板',custom.length)],`本机数据 · 默认：${current?.name||'标准报价模板'}`);
      }
      if (parameter(params, 'tab') === 'print') {
        const custom = list(L.state.templates).filter(template => template.kind === 'print');
        const current = L.printTemplates?.get?.(L.printTemplates.defaultId());
        return summary('打印模板配置', [metric('全部打印模板', custom.length + 1), metric('内置模板', 1), metric('自定义模板', custom.length)],
          [metric('内置模板', 1), metric('自定义模板', custom.length)],
          `本机数据 · 默认：${current?.name || (L.company().name+' 产品资料')}`);
      }
      const fixed = templates.filter(template => fixedKinds.has(template.kind)), custom = templates.filter(template => !fixedKinds.has(template.kind));
      const available = count(fixed, template => template.status === 'published');
      return summary('模板配置状态', [metric('可导出固定模板', available), metric('公司模板', custom.length), metric('草稿模板', count(templates, template => template.status !== 'published'))],
        [metric('可用于导出', available), metric('公司配置已发布', count(custom, template => template.status === 'published')), metric('草稿', count(templates, template => template.status !== 'published'))],
        '本机数据 · 公司模板仅保存配置');
    }
    if (route === 'exports') {
      if (parameter(params, 'tab') === 'history') {
        const completed = count(jobs, job => job.status === 'completed'), failed = count(jobs, job => job.status === 'failed');
        const generating = count(jobs, job => job.status === 'generating');
        const segments = [metric('已完成', completed), metric('失败', failed), metric('生成中', generating)];
        const other = jobs.length - completed - failed - generating;
        if (other) segments.push(metric('其他状态', other));
        return summary('导出任务状态', [metric('导出任务', jobs.length), metric('已完成', completed), metric('失败', failed)], segments,
          '本机数据 · 已完成不代表可再次下载');
      }
      const withVariants = live.filter(product => variants(product).length > 0);
      return summary('产品可导出范围', [metric('可导出型号', withVariants.length), metric('可导出 SKU', live.reduce((total, product) => total + variants(product).length, 0)),
        metric('可导出固定模板', count(templates, template => fixedKinds.has(template.kind) && template.status === 'published'))],
      [metric('可导出型号', withVariants.length), metric('已发布无配色', live.length - withVariants.length), metric('尚未发布', products.length - live.length)],
      '本机数据 · 按已发布版本统计');
    }
    if (route === 'team') {
      const team = list(L.state.team).filter(person => ['admin','business'].includes(person.role));
      const active = team.filter(person => person.status !== 'disabled');
      return summary('内部成员构成', [metric('内部成员', team.length), metric('启用中', active.length), metric('已停用', team.length - active.length)],
        [metric('管理员', count(team, person => person.role === 'admin')), metric('业务人员', count(team, person => person.role === 'business'))], '本机数据 · 演示成员');
    }
    if (route === 'activity') return activitySummary(list(L.state.logs), now);
    return null;
  };
})();
