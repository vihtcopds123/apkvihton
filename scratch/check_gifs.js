const testGifs = {
  wine: '1f377',
  strawberry: '1f353',
  ribbon: '1f380',
  dollar: '1f4b5',
  card: '1f4b3',
  money_wings: '1f4b8'
}

async function run() {
  for (const [name, code] of Object.entries(testGifs)) {
    const url = `https://fonts.gstatic.com/s/e/notoemoji/latest/${code}/512.gif`
    try {
      const res = await fetch(url, { method: 'HEAD' })
      console.log(`${name} (${code}): ${res.status === 200 ? 'OK ✅' : 'FAILED ❌ (' + res.status + ')'}`)
    } catch (err) {
      console.log(`${name} (${code}): ERROR ❌`, err.message)
    }
  }
}
run()
