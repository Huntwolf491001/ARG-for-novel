(function () {
  var service = 'https://arg-auth-683dc0f14848.yangyi42905341.workers.dev';
  var site = 'city-bureau';
  var el = function (id) { return document.getElementById(id); };
  var steps = [el('step1'), el('step2'), el('step3a'), el('step3b'), el('appealBox')];
  var proof = '';
  function showErr(message) { el('err').textContent = message; el('err').style.display = 'block'; }
  function hideErr() { el('err').style.display = 'none'; }
  function only(target) { steps.forEach(function (step) { step.style.display = step === target ? 'block' : 'none'; }); }
  async function request(path, data) {
    var response = await fetch(service + '/api/player/' + path + '?site=' + encodeURIComponent(site), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({site:site}, data))
    });
    var result = await response.json();
    if (!response.ok) throw new Error(result.error || '验证失败，请重试');
    return result;
  }
  async function act(button, callback) {
    button.disabled = true;
    try { hideErr(); await callback(); }
    catch (error) { showErr(error.message === 'Failed to fetch' ? '验证服务暂时无法连接，请稍后重试。' : error.message); }
    finally { button.disabled = false; }
  }
  el('btnLogin').addEventListener('click', function () { var button=this; act(button,async function () {
    var username=el('user').value.trim(), password=el('pass').value.trim();
    if (!/^\d{5}$/.test(username)) throw new Error('警号应为五位数字');
    var result=await request('login',{username:username,password:password});
    if(result.stage!=='appeal' || !result.proof) throw new Error('该账号尚未配置二级验证，请联系管理员');
    proof=result.proof;el('pass').value='';only(el('appealBox'));showErr('该账号已停用，请联系管理员');el('pass2').focus();
  }); });
  el('forgot').addEventListener('click', function (event) {event.preventDefault(); var link=this; act(link,async function () {
    var username=el('user').value.trim();if(!/^\d{5}$/.test(username))throw new Error('警号应为五位数字');
    var result=await request('recover/start',{username:username}); proof=result.proof;only(el('step2'));
  }); });
  el('useYes').addEventListener('click',function(){hideErr();only(el('step3a'));});
  el('useNo').addEventListener('click',function(){hideErr();only(el('step3b'));el('answer').focus();});
  el('resend').addEventListener('click',function(){showErr('验证码已重新发送至 138 7419 362。');});
  el('backA').addEventListener('click',function(){hideErr();only(el('step2'));});
  el('backB').addEventListener('click',function(){hideErr();only(el('step2'));el('answer').value='';});
  el('btnAnswer').addEventListener('click',function(){var button=this;act(button,async function(){
    var result=await request('recover/answer',{proof:proof,answer:el('answer').value.trim()});
    proof=result.proof;el('answer').value='';only(el('appealBox'));el('pass2').focus();
  });});
  el('btnAppeal').addEventListener('click',function(){var button=this;act(button,async function(){
    var result=await request('appeal',{proof:proof,password:el('pass2').value.trim()});
    if(!result.redirect)throw new Error('验证失败，请重试');el('pass2').value='';location.assign(result.redirect);
  });});
})();
