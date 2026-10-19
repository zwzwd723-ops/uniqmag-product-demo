/* Document language is independent of interface preferences and never edits source records. */
(() => {
  'use strict';
  const L=window.Library;
  const words=new Map(Object.entries({
    '产品资料':'Product information','产品资料库':'Product library','产品报价单':'Product quotation','客户报价单':'Customer quotation','报价单':'Quotation','图文产品目录':'Product catalog','SKU 明细表':'SKU details','SKU 配色清单':'SKU variant list','包装参数表':'Packaging specifications','包装资料表':'Packaging information','资料快照':'Information snapshot',
    '把品牌、产品、配色与主要参数放在同一张表里。':'Brands, products, variants and key specifications in one document.','逐一列出品牌、型号与配色，方便核对产品范围。':'Brands, models and variants listed individually for review.','按品牌与配色匹配适用包装，保留原始尺寸与待确认说明。':'Packaging matched by brand and variant, preserving source dimensions and confirmation notes.',
    '把产品、配色与主要参数放在同一张表里。':'Products, variants and key specifications in one document.','逐一列出型号与配色，方便客户核对产品范围。':'Models and variants listed individually for review.','按配色匹配适用包装，保留原始尺寸与待确认说明。':'Packaging matched to each variant, preserving source dimensions and confirmation notes.',
    '产品图片':'Product image','产品型号':'Model','产品名称':'Product name','品牌':'Brand','产品 / SKU':'Product / SKU','产品及货号':'Product / SKU','产品及货号 / SKU':'Product / SKU','产品':'Product','配色':'Color','颜色':'Color','类别':'Category','产品类别':'Product category','产品类型':'Product type','产品说明':'Product description','主要参数':'Key specifications','规格参数':'Specifications',
    '包装说明':'Packaging description','包装类型':'Packaging type','包装图片':'Packaging image','包装资料':'Packaging information','包装清单':'Box contents','零售包装':'Retail packaging','快递包装':'Express packaging','运输包装':'Shipping packaging','整箱包装':'Master carton','装柜数量':'Container capacity','适用范围':'Applies to','通用':'All variants','全部配色':'All variants','当前配色':'Selected variant',
    '数量':'Quantity','采购数量':'Quantity','单价':'Unit price','报价单价':'Unit price','金额':'Amount','报价小计':'Subtotal','小计':'Subtotal','合计':'Total','报价总额':'Quotation total','客户名称':'Customer','联系人':'Contact','报价编号':'Quotation no.','报价日期':'Quotation date','有效期至':'Valid until','有效期':'Validity','报价币种':'Currency','币种':'Currency','备注':'Notes','备注 / 交易条件':'Notes / Terms',
    '模板版本':'Template version','导出时间':'Exported at','生成时间':'Generated at','资料范围':'Scope','用途':'Purpose','内部资料':'Internal use','待确认':'To be confirmed','待核实':'To be verified','未填写':'Not provided','暂无图片':'No image','资料状态':'Information status','已发布':'Published','草稿':'Draft','原表销售状态':'Source sales status','销售状态':'Sales status','已售罄':'Sold out','条码信息':'Barcode information',
    '键盘':'Keyboard','磁轴键盘':'Magnetic switch keyboard','全铝磁轴键盘':'All-aluminum magnetic switch keyboard','三模磁轴键盘':'Tri-mode magnetic switch keyboard','游戏控制器':'Game controller','游戏手柄':'Game controller','三模游戏手柄':'Tri-mode game controller','游戏电视棒':'Game TV stick','无线无摇杆控制器':'Wireless leverless controller','无摇杆控制器':'Leverless controller','其他产品':'Other products','游戏充电宝':'Gaming power bank','移动电源':'Power bank','游戏掌机':'Handheld game console','街机':'Arcade machine','街机配件':'Arcade accessories','显示器':'Monitor','游戏主机':'Game console',
    '全铝机身，搭配 PBT 键帽与碳纤维定位板。':'All-aluminum case with PBT keycaps and a carbon-fiber plate.','CNC 阳极氧化铝机身，支持 Windows 与 Mac。':'CNC anodized aluminum case, compatible with Windows and Mac.','TMR 传感器与三模连接，内置 4000 mAh 电池。':'TMR sensors, tri-mode connectivity and a built-in 4000 mAh battery.','霍尔摇杆、双背键与可拆卸面壳，支持多平台连接。':'Hall-effect joysticks, dual rear buttons and a removable faceplate, with multi-platform connectivity.','支持 720p 视频输出与 TF 卡扩展，配备两个 2.4 GHz 控制器。':'720p video output and TF card expansion, supplied with two 2.4 GHz controllers.','低矮磁轴、OLED 屏幕与三模连接，支持多套配置存储。':'Low-profile magnetic switches, an OLED display, tri-mode connectivity and multiple stored profiles.',
    '克莱因蓝':'Klein Blue','橙色':'Orange','玫红色':'Rose Red','灰色':'Gray','白色':'White','红色':'Red','黑色':'Black','银黑色':'Silver / Black','银色':'Silver','紫色':'Purple','灰红色':'Gray / Red','颜色未填写':'Color not provided','蓝色':'Blue','绿色':'Green','黄色':'Yellow','透明':'Transparent',
    '尺寸及重量':'Dimensions and weight','尺寸及重量（原表）':'Dimensions and weight (source)','轴体类型':'Switch type','RT 调节范围':'RT adjustment range','RT 调节精度':'RT adjustment precision','响应延迟':'Response latency','扫描率':'Scan rate','回报率':'Polling rate','连接方式':'Connectivity','支持系统':'Supported systems','外壳工艺':'Case finish','键帽':'Keycaps','内部消音':'Internal damping','定位板':'Plate','颜色选项':'Color options','灯光效果':'Lighting effects','IED side（原表字段）':'IED side (source field)','在线配置':'Online configuration','认证':'Certification','认证（原表声明）':'Certification (source claim)',
    '传感器':'Sensor','电池容量':'Battery capacity','续航时间':'Battery life','摇杆技术':'Joystick technology','扳机':'Triggers','方向键开关':'D-pad switches','可编程按键':'Programmable buttons','陀螺仪':'Gyroscope','握把振动马达':'Grip vibration motors','电源输入':'Power input','面壳':'Faceplate','方向键':'D-pad','芯片及存储':'Chipset and storage','视频输出及接口':'Video output and ports','扩展存储':'Expandable storage','控制器供电':'Controller power','功耗':'Power consumption','内置游戏及模拟器':'Preloaded games and emulators','原表备注':'Source notes','OLED 显示屏':'OLED display','配置存储':'Profile storage','SOCD 模式':'SOCD mode','赛事合规（原表声明）':'Tournament compliance (source claim)','赛事规则（原表声明）':'Tournament rules (source claim)','赛事锁定':'Tournament lock','固件':'Firmware',
    '原表说明':'Source description','原表包装说明':'Source packaging description','原表共用包装资料':'Shared source packaging information','附加信息（原表）':'Additional source information','游戏清单（原表 1）':'Source game list 1','游戏清单（原表 2）':'Source game list 2','游戏清单（原表 3）':'Source game list 3','内置游戏（原表）':'Preloaded games (source)',
    '电池':'Battery','操作系统':'Operating system','语言':'Languages','内存':'Memory','存储':'Storage','显示屏':'Display','扬声器':'Speaker','电源输出':'Power output','无线充电':'Wireless charging','材质':'Material','视频输入':'Video input','音频输入':'Audio input','视频输出':'Video output','音频输出':'Audio output','按键':'Buttons','摇杆':'Joystick','芯片':'Chipset','支持卡带':'Supported cartridges','容量':'Capacity',
    '全铝机身':'All-aluminum case','有线连接':'Wired connectivity','三模连接':'Tri-mode connectivity','磁轴定位板':'Magnetic switch plate','碳纤维定位板':'Carbon-fiber plate','TMR 传感器':'TMR sensors','三模':'Tri-mode','无线连接':'Wireless connectivity','包装资料待补充':'Packaging information to be added',
    '仓储信息':'Warehouse information','仓库':'Warehouse','仓储位置':'Warehouse location',
    '未提供':'Not provided','已下架':'Unpublished','待发布':'Pending publication','待发布修改':'Unpublished changes','内部草稿':'Internal draft','SKU 货号':'SKU','完整技术规格':'Full specifications','尚未录入规格。':'No specifications have been entered.','当前配色尚未录入适用包装。':'No packaging information has been entered for this variant.','待核实事项':'Items to verify','产品打印预览':'Product print preview','商务报价资料':'Business quotation',
    '整箱净重单位':'Master carton net-weight unit','零售包装尺寸':'Retail packaging dimensions','视频及电源接口':'Video and power ports','内置游戏数量':'Preloaded game count','产品重量':'Product weight','货号':'SKU',
    '原表为 0.005 mm - 3500 mm，上限待确认。已保留原值。':'The source states 0.005 mm - 3500 mm. The upper limit requires confirmation; the original value is preserved.','原表整箱净重注明 unit to confirm，单位尚待确认。':'The source marks the master carton net-weight unit as "unit to confirm". The unit remains unconfirmed.','橙色版本在 MOQ 栏标为 Sold out，已单独展示为原表销售状态，不作为当前库存数量。':'The orange variant is marked Sold out in the source MOQ column. This is shown as the source sales status, not as a current stock quantity.',
    '原表尺寸为 335 x 115 x 45 mm，并明确注明包装宽度 115 mm 待确认。':'The source dimensions are 335 x 115 x 45 mm. The packaging width of 115 mm is explicitly marked for confirmation.','部分包装重量、快递包装或整箱资料未填写，保留空缺。':'Some packaging weights, express packaging or master carton details were not provided and remain blank.','原表对 HDMI / USB 电源接口加注星号，具体接口需确认。':'The source marks HDMI / USB power ports with an asterisk. The exact ports require confirmation.','原表列出 40，包装图写 40+；数量待确认。10+ 模拟器为包装标注。':'The source lists 40 games while the packaging shows 40+; the count requires confirmation. The packaging states 10+ emulators.',
    '原表产品重量未填写。':'The source does not provide a product weight.','原表颜色未填写。':'The source does not provide a color.','4 个颜色版本的 Item No. 均未填写；页面内部编号不代表正式 SKU。':'Item No. is blank for all four color variants. Internal page identifiers are not official SKUs.','原表规格写 Color Options: Black，但版本行列出 Silver、Red、Purple、Gray Red，需确认。':'The source specifications state Color Options: Black, but the variant rows list Silver, Red, Purple and Gray Red. Confirmation is required.','原表 Certification: Needs Confirmation，认证信息待确认。':'The source states Certification: Needs Confirmation. Certification information remains unconfirmed.','原表零售包装尺寸注明 Needs Confirmation。':'The source marks retail packaging dimensions as Needs Confirmation.',
    '此文件为导出时的已发布资料快照；待确认与缺失字段按原资料保留。':'This document is a snapshot of published information at export. Pending and missing fields are preserved from the source.'
  }));
  const normalize=language=>typeof language==='string'&&/^en(?:$|[-_])/i.test(language)?'en':'zh-CN';
  const isEnglish=language=>normalize(language)==='en';
  function t(value,language){
    if(typeof value!=='string'||!isEnglish(language))return value??'';
    const trimmed=value.trim(),brand=trimmed.match(/^(UNIQMAG|UNICO)(\s*·\s*|\s+)(.+)$/),translated=words.get(trimmed)??(brand&&words.has(brand[3])?brand[1]+brand[2]+words.get(brand[3]):undefined);
    if(translated===undefined)return value;
    return value.slice(0,value.indexOf(trimmed))+translated+value.slice(value.indexOf(trimmed)+trimmed.length);
  }
  const englishField=(record,key)=>[record[key+'En'],record[key+'_en'],record.translations?.en?.[key],record.i18n?.en?.[key]].find(value=>typeof value==='string'&&value.trim());
  function field(record,key,language){return isEnglish(language)?englishField(record,key)??t(record[key],language):record[key];}
  function variant(value,language){
    const copy=structuredClone(value);
    if(!copy||!isEnglish(language))return copy;
    for(const key of ['color','colorLabel','availability','description'])if(Object.hasOwn(copy,key))copy[key]=field(value,key,language);
    if(englishField(value,'colorLabel')===undefined&&englishField(value,'color')!==undefined)copy.colorLabel=copy.color;
    if(Array.isArray(copy.specs))copy.specs=specifications(copy.specs,language);
    return copy;
  }
  function specifications(values,language){return values.map(source=>{
    if(!source||typeof source!=='object')return source;
    const copy=structuredClone(source);
    copy.label=typeof source.label==='string'&&source.label.trim()?field(source,'label',language):field(source,'key',language);
    if(Object.hasOwn(source,'value'))copy.value=field(source,'value',language);
    return copy;
  });}
  function product(value,language){
    const copy=structuredClone(value);
    if(!copy||!isEnglish(language))return copy;
    for(const key of ['name','type','categoryLabel','description'])if(Object.hasOwn(copy,key))copy[key]=field(value,key,language);
    if(Array.isArray(copy.tags))copy.tags=copy.tags.map(tag=>t(tag,language));
    if(Array.isArray(copy.specs))copy.specs=specifications(copy.specs,language);
    if(Array.isArray(copy.variants))copy.variants=copy.variants.map(item=>variant(item,language));
    if(Array.isArray(copy.packaging))copy.packaging=copy.packaging.map(source=>{const item=structuredClone(source);for(const key of ['title','text'])if(Object.hasOwn(item,key))item[key]=field(source,key,language);return item;});
    return copy;
  }
  L.documentLanguage=Object.freeze({normalize,isEnglish,t,product,variant});
})();
