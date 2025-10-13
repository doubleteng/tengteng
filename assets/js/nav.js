// 自动为 <a data-nav="..."> 生成正确的 href（适配 GitHub Pages 项目站 / 自定义域名）
// 还会为当前页对应的导航项加 aria-current="page" 做高亮。
(function(){
  function detectBaseFromScript(){
    var scripts = document.getElementsByTagName('script');
    for (var i=scripts.length-1; i>=0; i--){
      var s = scripts[i];
      if (s.src && s.src.indexOf('/assets/js/nav.js') !== -1){
        try{
          var u = new URL(s.src, location.href);
          var p = u.pathname;                // e.g. /<repo>/assets/js/nav.js 或 /assets/js/nav.js
          var k = p.indexOf('/assets/');
          if (k > 0) return p.slice(0, k+1); // => '/<repo>/' 或 '/'
        }catch(e){}
      }
    }
    return null;
  }
  function detectBaseFallback(){
    var segs = location.pathname.split('/').filter(Boolean);
    if (location.hostname.endsWith('github.io') && segs.length){
      return '/' + segs[0] + '/';            // 项目站：/<repo>/
    }
    return '/';                               // 自定义域名或根站
  }

  var base = detectBaseFromScript() || detectBaseFallback();

  // 写入 href
  var here = location.pathname.startsWith(base) ? location.pathname.slice(base.length) : location.pathname;
  document.querySelectorAll('a[data-nav]').forEach(function(a){
    var to = (a.getAttribute('data-nav') || '').replace(/^\/+/, '');
    a.setAttribute('href', base + to);       // "" => 仓库根
    // 高亮当前页面
    if ((to === '' && (here === '' || here === 'index.html')) ||
        (to !== '' && here.startsWith(to))) {
      a.setAttribute('aria-current','page');
    }
  });

  // 同时把 <link id="site-css"> 的 href 也自动补全（如果你用了它来加载全站样式）
  var css = document.getElementById('site-css');
  if (css && !css.getAttribute('href')){
    css.setAttribute('href', base + 'assets/css/site.css');
  }
})();
