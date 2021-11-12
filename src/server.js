const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

const CLIENT_DIR = 'client';

app.use('/css', express.static(path.join(__dirname, `${CLIENT_DIR}/css`)));
app.use('/', express.static(path.join(__dirname, CLIENT_DIR)));

app.get('/', (req, res) => {
	res.sendFile('client.html', { root: CLIENT_DIR});
});

app.listen(port, () => {
	console.log(`Example app listening at port ${port}`);
});

module.exports = app;