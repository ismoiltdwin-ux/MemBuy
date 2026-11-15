// Сборка Membuy: index.html (обычный сайт, отдельные файлы) и dist/membuy-artifact.html (один файл для предпросмотра).
const fs = require('fs'), path = require('path'), R = path.join(__dirname, '..');
const JS = ['config', 'i18n', 'util', 'store', 'data/demo', 'data/live', 'data/social', 'data/ads', 'wallet', 'fees', 'referral', 'adchain', 'postchain', 'pumpcreate', 'send', 'chat', 'analytics', 'swap', 'chart', 'ui/components', 'ui/market', 'ui/token', 'ui/feed', 'ui/leaders', 'ui/portfolio', 'ui/create', 'ui/adsview', 'ui/more', 'ui/info', 'ui/user', 'ui/inbox', 'app'];
const body = fs.readFileSync(path.join(__dirname, 'body.html'), 'utf8');
// Метка версии по содержимому файла: после обновления браузеры (в том числе Telegram) берут свежий файл, а не старую копию.
const ver = f => require('crypto').createHash('sha1').update(fs.readFileSync(path.join(R, f))).digest('hex').slice(0, 8);
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@700;800&family=Manrope:wght@400;600;700&display=swap" rel="stylesheet">';
fs.writeFileSync(path.join(R, 'index.html'), `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Membuy</title>
<meta name="description" content="Membuy — терминал для покупки и продажи мемкоинов Solana.">
<meta name="theme-color" content="#120f24">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" href="img/logo-32.png">
<link rel="apple-touch-icon" href="img/icon-180.png">
${fonts}
<link rel="stylesheet" href="css/app.css?v=${ver('css/app.css')}">
</head>
<body>
${body}${JS.map(f => `<script src="js/${f}.js?v=${ver('js/' + f + '.js')}"></script>`).join('\n')}
</body>
</html>
`);
const css = fs.readFileSync(path.join(R, 'css/app.css'), 'utf8');
const js = JS.map(f => fs.readFileSync(path.join(R, 'js', f + '.js'), 'utf8')).join('\n');
fs.mkdirSync(path.join(R, 'dist'), { recursive: true });
fs.writeFileSync(path.join(R, 'dist/membuy-artifact.html'), `<title>Membuy</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n${fonts}\n<style>\n${css}</style>\n${body}<script>\n${js}\n</script>\n`);
console.log('built', JS.length, 'modules');
