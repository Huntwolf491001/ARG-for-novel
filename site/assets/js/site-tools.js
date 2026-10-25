(function () {
  var KEY = 'zz_a11y';
  var cfg = { fs: 0, hc: false, elder: false, trad: false };
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    for (var k in saved) cfg[k] = saved[k];
  } catch (e) {}

  var MAP = {
    '国': '國', '厅': '廳', '关': '關', '于': '於', '会': '會', '议': '議', '动': '動',
    '组': '組', '织': '織', '问': '問', '题': '題', '况': '況', '务': '務', '讯': '訊',
    '网': '網', '络': '絡', '系': '係', '统': '統', '术': '術', '发': '發', '经': '經',
    '济': '濟', '门': '門', '单': '單', '领': '領', '导': '導', '干': '幹', '侦': '偵',
    '查': '查', '车': '車', '辆': '輛', '驾': '駕', '驶': '駛', '户': '戶', '证': '證',
    '办': '辦', '请': '請', '时': '時', '间': '間', '点': '點', '电': '電', '话': '話',
    '邮': '郵', '编': '編', '栏': '欄', '闻': '聞', '态': '態', '开': '開', '财': '財',
    '预': '預', '费': '費', '标': '標', '准': '準', '监': '監', '检': '檢', '隐': '隱',
    '患': '患', '处': '處', '罚': '罰', '决': '決', '见': '見', '计': '計', '划': '劃',
    '总': '總', '结': '結', '报': '報', '数': '數', '据': '據', '统': '統', '预': '預',
    '警': '警', '诈': '詐', '骗': '騙', '资': '資', '账': '賬', '转': '轉', '核': '核',
    '实': '實', '护': '護', '权': '權', '声': '聲', '联': '聯', '繫': '繫', '业': '業',
    '许': '許', '迁': '遷', '签': '簽', '机': '機', '检': '檢', '验': '驗', '违': '違',
    '缴': '繳', '纳': '納', '场': '場', '营': '營', '馆': '館', '废': '廢', '属': '屬',
    '购': '購', '险': '險', '备': '備', '联': '聯', '审': '審', '鉴': '鑑', '逃': '逃',
    '缉': '緝', '协': '協', '导': '導', '侦': '偵', '财': '財', '队': '隊', '注': '註',
    '职': '職', '调': '調', '党': '黨', '员': '員', '担': '擔', '任': '任', '另': '另',
    '题': '題', '扬': '揚', '贯': '貫', '彻': '徹', '实': '實', '动': '動', '设': '設',
    '实': '實', '施': '施', '强': '強', '优': '優', '护': '護', '稳': '穩', '谐': '諧',
    '众': '眾', '环': '環', '境': '境', '创': '創', '驱': '驅', '战': '戰', '略': '略',
    '规': '規', '划': '劃', '项': '項', '目': '目', '投': '投', '资': '資', '产': '產',
    '园': '園', '区': '區', '企': '企', '团': '團', '厂': '廠', '产': '產', '造': '造',
    '备': '備', '质': '質', '量': '量', '艺': '藝', '营': '營', '运': '運', '务': '務',
    '机': '機', '构': '構', '组': '組', '织': '織', '职': '職', '责': '責', '权': '權',
    '监': '監', '督': '督', '审': '審', '核': '核', '议': '議', '决': '決', '执': '執',
    '法': '法', '规': '規', '章': '章', '制': '制', '度': '度', '程': '程', '序': '序',
    '诉': '訴', '讼': '訟', '复': '復', '议': '議', '赔': '賠', '偿': '償', '犯': '犯',
    '罪': '罪', '刑': '刑', '事': '事', '案': '案', '件': '件', '证': '證', '据': '據',
    '资': '資', '料': '料', '档': '檔', '案': '案', '卷': '卷', '宗': '宗', '归': '歸',
    '纳': '納', '库': '庫', '房': '房', '干': '幹', '部': '部', '群': '群', '补': '補',
    '贴': '貼', '补': '補', '贴': '貼', '电': '電', '脑': '腦', '软': '軟', '硬': '硬',
    '网': '網', '络': '絡', '数': '數', '码': '碼', '页': '頁', '链': '鏈', '接': '接',
    '访': '訪', '览': '覽', '简': '簡', '体': '體', '体': '體', '验': '驗', '测': '測',
    '试': '試', '选': '選', '择': '擇', '设': '設', '置': '置', '调': '調', '节': '節',
    '声': '聲', '音': '音', '读': '讀', '写': '寫', '帮': '幫', '助': '助', '动': '動',
    '画': '畫', '图': '圖', '标': '標', '识': '識', '颜': '顏', '色': '色', '对': '對',
    '比': '比', '度': '度', '恢复': '恢復', '默': '默', '认': '認', '适': '適', '老': '老',
    '无': '無', '障': '障', '碍': '礙', '浏': '瀏', '览': '覽', '繁': '繁', '体': '體',
    '警': '警', '务': '務', '通': '通', '站': '站', '首': '首', '页': '頁', '政': '政',
    '府': '府', '市': '市', '局': '局', '概': '概', '况': '況', '领': '領', '导': '導',
    '机': '機', '构': '構', '设': '設', '置': '置', '新': '新', '闻': '聞', '动': '動',
    '态': '態', '公': '公', '开': '開', '办': '辦', '事': '事', '服': '服', '务': '務',
    '民': '民', '互': '互', '动': '動', '人': '人', '事': '事', '任': '任', '免': '免',
    '财': '財', '政': '政', '信': '信', '息': '息', '法': '法', '规': '規', '文': '文',
    '件': '件', '执': '執', '法': '法', '公': '公', '开': '開', '通': '通', '知': '知',
    '公': '公', '告': '告', '征': '徵', '集': '集', '线': '線', '索': '索', '退': '退',
    '休': '休', '录': '錄', '用': '用', '分': '分', '配': '配', '定': '定', '级': '級',
    '派': '派', '出': '出', '所': '所', '长': '長', '副': '副', '书': '書', '记': '記',
    '主': '主', '任': '任', '委': '委', '纪': '紀', '检': '檢', '察': '察', '组': '組',
    '长': '長', '警': '警', '员': '員', '警': '警', '官': '官', '职': '職', '级': '級',
    '工': '工', '资': '資', '待': '待', '遇': '遇', '档': '檔', '案': '案', '转': '轉',
    '递': '遞', '手': '手', '续': '續', '完': '完', '成': '成', '定': '定', '期': '期',
    '限': '限', '内': '內', '外': '外', '办': '辦', '结': '結', '受': '受', '理': '理'
  };

  var REV = {};
  for (var s in MAP) {
    if (!REV[MAP[s]]) REV[MAP[s]] = s;
  }

  function conv(str, toTrad) {
    var out = '';
    for (var i = 0; i < str.length; i++) {
      var c = str.charAt(i);
      if (toTrad) out += (MAP[c] || c);
      else out += (REV[c] || c);
    }
    return out;
  }

  var collected = false;
  var nodes = [];

  function collect() {
    if (collected) return;
    collected = true;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    var n;
    while ((n = walker.nextNode())) {
      var p = n.parentNode;
      if (!p) continue;
      var tag = p.nodeName.toUpperCase();
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'OPTION') continue;
      if (!n.nodeValue || !n.nodeValue.trim()) continue;
      n.__orig = n.nodeValue;
      nodes.push(n);
    }
  }

  function applyTrad(on) {
    collect();
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      n.nodeValue = on ? conv(n.__orig, true) : n.__orig;
    }
  }

  var root = document.documentElement;

  var q = location.search;
  if (q.indexOf('trad=1') > -1) cfg.trad = true;
  if (q.indexOf('elder=1') > -1) cfg.elder = true;
  if (q.indexOf('hc=1') > -1) cfg.hc = true;
  if (q.indexOf('fs=1') > -1) cfg.fs = 1;
  if (q.indexOf('fs=2') > -1) cfg.fs = 2;

  function apply() {
    root.className = root.className
      .replace(/\b(fs-[123]|hc|elder|trad)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cfg.fs > 0) root.classList.add('fs-' + cfg.fs);
    if (cfg.hc) root.classList.add('hc');
    if (cfg.elder) root.classList.add('elder');
    if (cfg.trad) root.classList.add('trad');
    applyTrad(!!cfg.trad);
    try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {}
  }

  var panel = document.createElement('div');
  panel.className = 'a11y-panel';
  panel.innerHTML =
    '<div class="a11y-hd"><span style="font-size:13px;">辅助工具</span><span class="a11y-x">&times;</span></div>' +
    '<div class="a11y-row"><span>字体大小</span><span class="a11y-seg">' +
    '<button data-fs="0">标准</button><button data-fs="1">大</button><button data-fs="2">特大</button></span></div>' +
    '<div class="a11y-row"><span>高对比度</span><span class="a11y-sw" data-k="hc"></span></div>' +
    '<div class="a11y-row"><span>适老模式</span><span class="a11y-sw" data-k="elder"></span></div>' +
    '<div class="a11y-row"><span>繁体字</span><span class="a11y-sw" data-k="trad"></span></div>' +
    '<div class="a11y-ft"><button class="a11y-reset">恢复默认</button></div>';
  document.body.appendChild(panel);

  function sync() {
    var btns = panel.querySelectorAll('[data-fs]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].className = (+btns[i].getAttribute('data-fs') === cfg.fs) ? 'on' : '';
    }
    var sws = panel.querySelectorAll('[data-k]');
    for (var j = 0; j < sws.length; j++) {
      var k = sws[j].getAttribute('data-k');
      sws[j].className = 'a11y-sw' + (cfg[k] ? ' on' : '');
    }
  }

  panel.addEventListener('click', function (e) {
    var t = e.target;
    if (t.className === 'a11y-x') {
      panel.classList.remove('on');
      return;
    }
    if (t.className === 'a11y-reset') {
      cfg = { fs: 0, hc: false, elder: false, trad: false };
      apply();
      sync();
      return;
    }
    if (t.hasAttribute && t.hasAttribute('data-fs')) {
      cfg.fs = +t.getAttribute('data-fs');
      apply();
      sync();
      return;
    }
    if (t.hasAttribute && t.hasAttribute('data-k')) {
      var key = t.getAttribute('data-k');
      cfg[key] = !cfg[key];
      apply();
      sync();
    }
  });

  var links = document.querySelectorAll('.topbar a');
  for (var i = 0; i < links.length; i++) {
    var txt = links[i].textContent;
    if (txt.indexOf('无障碍') > -1) {
      links[i].addEventListener('click', function (e) {
        e.preventDefault();
        panel.classList.toggle('on');
        sync();
      });
    } else if (txt.indexOf('适老') > -1) {
      links[i].addEventListener('click', function (e) {
        e.preventDefault();
        cfg.elder = !cfg.elder;
        apply();
        sync();
      });
    } else if (txt.indexOf('繁') > -1) {
      links[i].addEventListener('click', function (e) {
        e.preventDefault();
        cfg.trad = !cfg.trad;
        apply();
        sync();
      });
    }
  }

  apply();
  sync();
  if (location.search.indexOf('panel=1') > -1) panel.classList.add('on');
})();
