(function () {
  var query = new URLSearchParams(location.search).get('q') || '';
  query = query.trim();
  var input = document.querySelector('.search input');
  var status = document.getElementById('search-status');
  var list = document.getElementById('search-results');
  input.value = query;
  if (!query) {
    status.textContent = '请输入关键词进行搜索。';
    return;
  }

  fetch('/assets/search-index.json').then(function (response) {
    if (!response.ok) throw new Error('无法读取搜索索引');
    return response.json();
  }).then(function (pages) {
    var terms = query.toLocaleLowerCase().split(/\s+/);
    var matches = pages.filter(function (page) {
      var text = (page.title + ' ' + page.text).toLocaleLowerCase();
      return terms.every(function (term) { return text.indexOf(term) !== -1; });
    });
    matches.sort(function (a, b) {
      var aTitle = a.title.toLocaleLowerCase();
      var bTitle = b.title.toLocaleLowerCase();
      var score = function (title) {
        return terms.reduce(function (total, term) { return total + (title.indexOf(term) !== -1 ? 1 : 0); }, 0);
      };
      return score(bTitle) - score(aTitle);
    });
    status.textContent = '“' + query + '”的搜索结果：共 ' + matches.length + ' 条。';
    matches.forEach(function (page) {
      var li = document.createElement('li');
      var link = document.createElement('a');
      link.href = page.url;
      link.textContent = page.title;
      li.appendChild(link);
      list.appendChild(li);
    });
    if (!matches.length) status.textContent += ' 请尝试其他关键词。';
  }).catch(function () {
    status.textContent = '搜索暂时不可用，请稍后重试。';
  });
})();
