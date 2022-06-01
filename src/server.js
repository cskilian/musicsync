const express = require('express');
const config = require('./config.js');
const path = require('path');
const fs = require('fs');
const uuid = require('uuid');
var spawn = require('child_process').spawn;
const bodyParser = require('body-parser');
const app = express();

const CLIENT_DIR = 'client';
const APP_DATA_DIR = config.APP_DATA_DIR;
let APP_DATA_PREFIX = path.join(process.env.HOME, APP_DATA_DIR);

const AUTO_SYNC_STATUS = {
	NO_AUDIO: 0,
	NO_SCORE: 1,
	READY_TO_SYNC: 2,
	STILL_SYNCING: 3,
	SYNC_COMPLETE: 4,
	SYNC_FAILED: 5,
};

/* =======================================================================
 * Server
 * =======================================================================
 */

app.use('/css', express.static(path.join(__dirname, `${CLIENT_DIR}/css`)));
app.use('/', express.static(path.join(__dirname, CLIENT_DIR)));
app.use(bodyParser.json());


app.post('/autosync/:id/audio', (request, response) => {
	let data = '';
	request.on('data', (chunk) => {
		data += chunk;
	});
	request.on('end', () => {
		let stripped = data.split('base64,')[1];
		let buffer = Buffer.from(stripped, 'base64');
		fs.writeFile(path.join(APP_DATA_PREFIX, '/', request.params.id, '/audio'), buffer, (error) => {
			if (error)
			{
				response.status(500);
				response.send();
			}
			else
			{
				response.status(200);
				response.send();
			}
		});	
	});
});


app.post('/autosync/:id/score', (request, response) => {
	console.log(request.body)
	const scorePath = path.join(APP_DATA_PREFIX, '/', request.params.id, '/score.' + request.body.extension);
	const buff = Buffer.from(request.body.data, 'base64');
	fs.writeFile(scorePath, buff, (error) => {
		if (error)
		{
			response.status(500);
			response.send();
		}
		else
		{
			response.status(200);
			response.send();
		}
	});
	console.log("extension: ", request.body)
});

app.get('/autosync/:id/sync', (request, response) => {
	const syncPath = path.join(APP_DATA_PREFIX, '/', request.params.id, '/sync');
	fs.readFile(syncPath, (error, json) => {
		if (error)
		{
			response.status(500);
			response.send();
			return;
		}
		else
		{
			response.status(200);
			response.send(json);
		}
	});
});

app.post('/autosync/:id/sync', (request, response) => {
	const scorePath = path.join(APP_DATA_PREFIX, '/', request.params.id, '/score');
	const audioPath = path.join(APP_DATA_PREFIX, '/', request.params.id, '/audio');
	const pidPath = path.join(APP_DATA_PREFIX, '/', request.params.id, '/pid');
	const syncPath = path.join(APP_DATA_PREFIX, '/', request.params.id, '/sync');
	fs.exists(audioPath, (exists) => {
		if (exists)
		{
			fs.exists(scorePath, (exists) => {
				if (exists)
				{
					let child = spawn(config.PYTHON, ['auto_sync.py', audioPath, scorePath, syncPath]);
					child.on('spawn', () => {
						fs.writeFile(pidPath, child.pid.toString(), (error) => {});
					});
					child.on('error', (error) => {
						fs.writeFile(pidPath, '1', (error) => {});
					});
					child.on('exit', (code, signal) => {
						fs.writeFile(pidPath, code.toString(), (error) => {});
					});
					response.status(200);
					response.send();
				}
				else
				{
					response.status(404);
					response.send();
				}
			});
		}
		else
		{
			response.status(404);
			response.send();
		}
	});
});

app.get('/autosync/:id', (request, response) => {
	response.setHeader('Content-Type', 'application/json');
	const pidPath = path.join(APP_DATA_PREFIX, '/', request.params.id, '/pid');
	const syncPath = path.join(APP_DATA_PREFIX, '/', request.params.id, '/sync');
	const scorePath = path.join(APP_DATA_PREFIX, '/', request.params.id, '/score');
	const audioPath = path.join(APP_DATA_PREFIX, '/', request.params.id, '/audio');
	response.header("Cache-Control", "no-cache, no-store, must-revalidate");
	response.header("Pragma", "no-cache");
	response.header("Expires", 0);
	fs.exists(audioPath, (exists) => {
		if (exists)
		{
			fs.exists(scorePath, (exists) => {
				if (exists)
				{
					fs.exists(syncPath, (exists) => {
						if (exists)
						{
							fs.readFile(pidPath, (error, data) => {
								if (error)
								{
									console.log(error);
									response.status(200);
									response.send({ status: AUTO_SYNC_STATUS.STILL_SYNCING});
									return;
								}
								if (data == "0")
								{
									response.status(200);
									response.send(JSON.stringify({ status: AUTO_SYNC_STATUS.SYNC_COMPLETE}));
								}
								else if (data == "1")
								{
									response.status(200);
									response.send(JSON.stringify({ status: AUTO_SYNC_STATUS.SYNC_FAILED}));
								}
								else
								{
									response.status(200);
									response.send(JSON.stringify({ status: AUTO_SYNC_STATUS.STILL_SYNCING}));
								}
							});
						}
						else
						{
							response.status(200);
							response.send(JSON.stringify({ status: AUTO_SYNC_STATUS.READY_TO_SYNC}));
						}
					});
				}
				else
				{
					response.status(200);
					response.send(JSON.stringify({ status: AUTO_SYNC_STATUS.NO_SCORE}));
				}
			});
		}
		else
		{
			response.status(200);
			response.send(JSON.stringify({ status: AUTO_SYNC_STATUS.NO_AUDIO}));
		}
	});
});


app.delete('/autosync/:id', (request, response) => {
	const requestDir = path.join(APP_DATA_PREFIX, '/', request.params.id);
	fs.exists(requestDir, (exists) => {
		fs.rmdir(requestDir, { recursive: true, force: true}, (error) => {
		});
	});
});

app.post('/autosync', (request, response) => {
	const id = uuid.v4();
	fs.mkdir(path.join(APP_DATA_PREFIX, id), (error) => {
		if (error !== null)
		{
			console.log('Unable to create working directory for autosync request');
			response.status(500);
			response.send();
		}
		else
		{
			response.setHeader('Content-Type', 'application/json');
			response.status(200);
			response.send(JSON.stringify({ id: id}));	
		}
	});
});

app.get('/', (request, response) => {
	response.sendFile('client.html', { root: CLIENT_DIR});
});


app.listen(config.PORT, config.HOST, () => {
	console.log(`Example app listening at http://${config.HOST}:${config.PORT}`);
});

module.exports = app;
init();

function init()
{
	if (!fs.existsSync(APP_DATA_PREFIX)) 
	{
		fs.mkdir(APP_DATA_PREFIX, (error) => {
			if (error !== null)
			{
				console.log(error);
				APP_DATA_PREFIX = path.join('./', APP_DATA_DIR);
				fs.mkdir(APP_DATA_PREFIX, (error) => {
					if (error !== null)
					{
						console.log(error);
						console.log('Unable to create directory for data. Server functionality is disabled');
					}
				});
			}
		});
	}
}
