const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  try {
    await page.goto('http://localhost:3000');
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('usuario', JSON.stringify({ nombre: 'Admin', rol: 'admin' }));
    });
    await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle2' });
  } catch (err) {
    console.error('Nav error:', err);
  }
  
  await browser.close();
})();
