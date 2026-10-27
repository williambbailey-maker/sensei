const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright')
;(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  for (const q of ['?entry=borough', '?entry=search', '?entry=all']) {
    const p = await b.newPage({ viewport: { width: 390, height: 664 } })
    await p.route('**/*supabase.co/**', (r) => {
      const u = r.request().url()
      if (u.includes('live_stores')) return r.fulfill({ json: [{ id: 'st1', slug: 'hii', name: 'Hii', borough: 'Brooklyn', neighborhood: 'Williamsburg', lat: 40.71, lng: -73.96 }] })
      if (u.includes('site_stats')) return r.fulfill({ json: { shops: 126, neighborhoods: 33, in_stock: 63854 } })
      return r.fulfill({ json: [], headers: { 'content-range': '0-0/0' } })
    })
    await p.goto(process.argv[2] + '/' + q); await p.waitForTimeout(900)
    const r = await p.evaluate(() => ({
      sheet: !!document.querySelector('.agesheet'),
      view: document.querySelector('#journey') ? 'borough journey' : document.querySelector('main h1.poster') ? document.querySelector('main h1.poster').textContent : document.querySelector('.home-grid') ? 'home' : '?',
      inert: !!document.querySelector('[inert]'),
    }))
    console.log(q.padEnd(16), JSON.stringify(r))
    if (q === '?entry=borough') await p.screenshot({ path: process.argv[3] + '/sheet-deeplink-borough-390x664.png' })
    await p.close()
  }
  await b.close()
})()
