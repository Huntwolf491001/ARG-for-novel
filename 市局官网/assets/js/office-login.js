(function () {
  var U = '00417';
  var H1 = 'a8aaa586c6d95ba4ee026d65e7877a4e23c39b87798743becb28e057127f38a9';
  var HA = 'c58fbd01cd5a55acf1e31d0f6d8026b3c94d71c26d14b72304c637ba00f53b51';
  var VIV = 'wh6QJToHHXG402JX';
  var VDATA = 'nwylIbCfcY9q2C5v0-1GYmRdvwQDpEjqfPsJhcGtTaD8cg';
  var SALT = 'zzga.0714.jia.2022';
  var ITER = 600000;

  var el = function (id) { return document.getElementById(id); };

  var err = el('err');
  var steps = [el('step1'), el('step2'), el('step3a'), el('step3b'), el('appealBox')];
  var user = el('user');
  var pass = el('pass');
  var answer = el('answer');
  var pass2 = el('pass2');

  function showErr(message) {
    err.textContent = message;
    err.style.display = 'block';
  }

  function hideErr() {
    err.style.display = 'none';
  }

  function only(target) {
    steps.forEach(function (step) {
      step.style.display = step === target ? 'block' : 'none';
    });
  }

  function ub(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var b = atob(s), a = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
    return a;
  }

  function bu(a) {
    var s = '';
    for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function hex(buffer) {
    var a = new Uint8Array(buffer), s = '';
    for (var i = 0; i < a.length; i++) s += ('0' + a[i].toString(16)).slice(-2);
    return s;
  }

  function sha(text) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(hex);
  }

  function unlock(password) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: enc.encode(SALT), iterations: ITER, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']
        );
      })
      .then(function (key) {
        return crypto.subtle.decrypt({ name: 'AES-GCM', iv: ub(VIV) }, key, ub(VDATA))
          .then(function () {
            return crypto.subtle.exportKey('raw', key).then(function (raw) {
              return bu(new Uint8Array(raw));
            });
          });
      })
      .catch(function () { return null; });
  }

  function toAppeal() {
    hideErr();
    only(el('appealBox'));
    pass2.focus();
  }

  el('btnLogin').addEventListener('click', function () {
    var button = this;
    var uv = user.value.trim();
    var pv = pass.value.trim();

    if (uv.length !== 5) {
      showErr('警号应为五位数字');
      user.focus();
      return;
    }

    if (uv !== U) {
      showErr('账号或密码错误');
      return;
    }

    button.disabled = true;
    sha(pv).then(function (h) {
      button.disabled = false;
      if (h !== H1) {
        showErr('账号或密码错误');
        return;
      }
      showErr('该账号已停用，请联系管理员');
      only(el('appealBox'));
      pass2.focus();
    });
  });

  el('forgot').addEventListener('click', function (event) {
    event.preventDefault();
    var uv = user.value.trim();

    if (uv.length !== 5) {
      showErr('警号应为五位数字');
      user.focus();
      return;
    }

    if (uv !== U) {
      showErr('未查询到该账号');
      return;
    }

    hideErr();
    only(el('step2'));
  });

  el('useYes').addEventListener('click', function () {
    hideErr();
    only(el('step3a'));
  });

  el('useNo').addEventListener('click', function () {
    hideErr();
    only(el('step3b'));
    el('answer').focus();
  });

  el('resend').addEventListener('click', function () {
    showErr('验证码已重新发送至 138 7419 362。');
  });

  el('backA').addEventListener('click', function () {
    hideErr();
    only(el('step2'));
  });

  el('backB').addEventListener('click', function () {
    hideErr();
    only(el('step2'));
    el('answer').value = '';
  });

  el('btnAnswer').addEventListener('click', function () {
    var button = this;
    var v = answer.value.trim().replace(/\s/g, '');
    button.disabled = true;
    sha(v).then(function (h) {
      button.disabled = false;
      if (h !== HA) {
        showErr('验证信息有误，请重新输入');
        answer.value = '';
        answer.focus();
        return;
      }
      toAppeal();
    });
  });

  el('btnAppeal').addEventListener('click', function () {
    var button = this;
    var pv = pass2.value.trim();
    if (!pv) return;

    button.disabled = true;
    button.textContent = '校验中…';

    unlock(pv).then(function (key) {
      if (!key) {
        button.disabled = false;
        button.textContent = '提交申诉';
        showErr('二级密码错误，请重新输入');
        pass2.value = '';
        pass2.focus();
        return;
      }
      sessionStorage.setItem('arg_key', key);
      location.href = '/archive/index.html';
    });
  });
})();
