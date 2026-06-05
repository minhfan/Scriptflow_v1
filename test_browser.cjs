const fs = require('fs');
const JSDOM = require('jsdom').JSDOM;
const dom = new JSDOM(fs.readFileSync('src/app.html', 'utf8'), { runScripts: "dangerously", resources: "usable" });
dom.window.addEventListener('load', () => {
  const event = new dom.window.KeyboardEvent('keydown', { key: 'I', code: 'KeyI', bubbles: true });
  dom.window.document.dispatchEvent(event);
  console.log("valTcIn: " + dom.window.document.getElementById('valTcIn').innerText);
});
