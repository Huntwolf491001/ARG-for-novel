(function () {
  var KEY = 'zz_gg_hide_until';
  try {
    var until = localStorage.getItem(KEY);
    if (until && Date.now() < parseInt(until, 10)) return;
  } catch (e) {}

  var ADS = [
    {
      t: '警惕冒充公检法诈骗',
      d: '凡自称公安、检察院、法院工作人员，以涉嫌洗钱、涉案为由要求转账至「安全账户」的，一律是诈骗。'
    },
    {
      t: '96110 来电请务必接听',
      d: '96110 是全国统一反诈预警劝阻专线。接到该号码来电，说明您或家人可能正在遭受诈骗。'
    },
    {
      t: '刷单返利都是诈骗',
      d: '网上兼职刷单、点赞返佣金，前期小额返利，后期大额不返。切勿垫付任何资金。'
    },
    {
      t: '警惕「杀猪盘」',
      d: '网恋、交友对象引导投资理财、赌博、买彩票的，均为诈骗。凡转账即失联。'
    }
  ];

  var idx = 0;

  var pop = document.createElement('div');
  pop.className = 'ad-pop';
  pop.innerHTML =
    '<div class="ad-hd"><span>反诈提醒</span><span class="ad-x" title="关闭">&times;</span></div>' +
    '<div class="ad-bd"><b></b><p></p></div>' +
    '<div class="ad-nav">' +
    ADS.map(function () { return '<i></i>'; }).join('') +
    '</div>';

  document.body.appendChild(pop);

  var titleEl = pop.querySelector('.ad-bd b');
  var descEl = pop.querySelector('.ad-bd p');
  var bars = pop.querySelectorAll('.ad-nav i');

  function render(n) {
    idx = n % ADS.length;
    titleEl.textContent = ADS[idx].t;
    descEl.textContent = ADS[idx].d;
    for (var i = 0; i < bars.length; i++) {
      bars[i].className = i === idx ? 'on' : '';
    }
  }

  render(0);

  var timer = setInterval(function () { render(idx + 1); }, 6000);

  for (var i = 0; i < bars.length; i++) {
    (function (n) {
      bars[n].addEventListener('click', function () { render(n); });
    })(i);
  }

  var pop2 = document.createElement('div');
  pop2.className = 'ad-pop2';
  pop2.innerHTML =
    '<div class="ad-hd"><span>便民提示</span><span class="ad-x" title="关闭">&times;</span></div>' +
    '<div class="ad-bd"><p>网上办事大厅已开通 32 项业务，户籍、出入境、交管业务均可预约办理。</p></div>';
  document.body.appendChild(pop2);

  function close(node) {
    clearInterval(timer);
    node.parentNode.removeChild(node);
    if (!document.querySelector('.ad-pop') && !document.querySelector('.ad-pop2')) {
      try {
        localStorage.setItem(KEY, String(Date.now() + 86400000));
      } catch (e) {}
    }
  }

  pop.querySelector('.ad-x').addEventListener('click', function () { close(pop); });
  pop2.querySelector('.ad-x').addEventListener('click', function () { close(pop2); });

  var tip = null;
  var tipTimer = null;

  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href="#"]') : null;
    if (!a) return;
    e.preventDefault();
    if (!tip) {
      tip = document.createElement('div');
      tip.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);' +
        'background:#2b2b2b;color:#e8dcc0;border:1px solid #7a6a4a;padding:14px 26px;' +
        'font-size:13px;z-index:9999;font-family:"Microsoft YaHei",sans-serif;' +
        'box-shadow:0 3px 16px rgba(0,0,0,.4);letter-spacing:1px;';
      tip.textContent = '该功能正在升级中，敬请期待。';
      document.body.appendChild(tip);
      tip.style.display = 'none';
    }
    tip.style.display = 'block';
    clearTimeout(tipTimer);
    tipTimer = setTimeout(function () { tip.style.display = 'none'; }, 1600);
  });
})();
