/* Compact, derived summaries for the shared internal page banner. */
(() => {
  'use strict';
  const L = window.Library;
  L.bannerDashboard = () => {
    const [route, query = ''] = location.hash.replace(/^#\//, '').split('?');
    const model = L.dashboardData?.(route, new URLSearchParams(query));
    if (!model) return '';
    const metrics = model.metrics || [];
    const segments = (model.segments || []).map(segment => ({...segment,value:Math.max(0,Number(segment.value)||0)}));
    const total = segments.reduce((sum, segment) => sum + segment.value, 0);
    return `<section class="banner-dashboard" aria-label="数据概览">
      <div class="banner-dashboard-heading"><h2>${L.esc(model.label)}</h2><span>本机数据</span></div>
      <dl class="banner-dashboard-metrics${metrics.length === 4 ? ' has-four-metrics' : ''}" style="--metric-count:${metrics.length}">${metrics.map(metric=>`<div><dt>${L.esc(metric.label)}</dt><dd>${L.esc(metric.value)}</dd></div>`).join('')}</dl>
      <div class="banner-dashboard-chart">
        <div class="banner-dashboard-track" aria-hidden="true">${segments.map((segment,index)=>segment.value?`<span class="banner-dashboard-segment tone-${index % 5}" style="flex-grow:${segment.value}"></span>`:'').join('')}</div>
        ${total ? '' : '<p class="banner-dashboard-empty">暂无数据</p>'}
        <ul class="banner-dashboard-legend">${segments.map((segment,index)=>`<li><i class="tone-${index % 5}" aria-hidden="true"></i><span>${L.esc(segment.label)}</span><b>${segment.value}</b></li>`).join('')}</ul>
      </div>
      ${model.note ? `<small class="banner-dashboard-note">${L.esc(model.note)}</small>` : ''}
    </section>`;
  };
})();
