# teng-teng

发一条新 News？

打开 assets/js/news.js，在数组末尾追加一条：

{
  title: "Your title",
  date: "2025-05-10",
  category: "research",
  tags: ["publication"],
  excerpt: "One sentence summary…",
  link: "research/your-project/",
  image: "assets/img/news/your-cover.webp",
  pin: false
}


加project
1 放置文件与图片

新建目录：research/diamanti-post-tensioned-concrete-canopy/

把上面的 HTML 存成该目录下的 index.html。

把图片放到：assets/img/diamanti/（与首页同级的 assets 目录）。

需要：hero.webp、main-1.webp、main-2.webp、render-1.webp…、assembly-1.webp… 等。

2 在 assets/js/projects.js 里确保有这个项目

3 替换文字与图注
在模板里把 <!-- ... --> 的提示处换成你的摘要、方法、测试说明、致谢等。
如果有视频，把 iframe 那段解除注释并填入 YouTube ID。

4 测试
打开 research/diamanti-post-tensioned-concrete-canopy/ 看是否显示正常；
从首页/Research Gallery 点击缩略图也应能进入。
