const fetch = require('node-fetch'); // wait, native fetch is in node 18+
fetch('http://localhost:8080/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
})
    .then(r => r.text().then(text => console.log('STATUS:', r.status, 'BODY:', text)))
    .catch(console.error);
