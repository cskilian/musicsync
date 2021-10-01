const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

const CLIENT_DIR = path.join(__dirname, 'client');

app.use(express.static(CLIENT_DIR));

app.get('/', (req, res) => {
	res.sendFile('main.html', { root: CLIENT_DIR});
});

app.listen(port, () => {
	console.log(`Example app listening at http://localhost:${port}`);
});

module.exports = app;