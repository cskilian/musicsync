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
app.use(bodyParser.json({limit: '50mb'}));


app.post('/autosync/:id/audio', (request, response) => {
	const audioPath = path.join(APP_DATA_PREFIX, '/', request.params.id, '/audio.' + request.body.extension);
	const buff = Buffer.from(request.body.data, 'base64');
	fs.writeFile(audioPath, buff, (error) => {
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


app.post('/autosync/:id/score', (request, response) => {
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
	const workDirPath = path.join(APP_DATA_PREFIX, '/', request.params.id);
	const pidPath = path.join(APP_DATA_PREFIX, '/', request.params.id, '/pid');
	const syncPath = path.join(APP_DATA_PREFIX, '/', request.params.id, '/sync');
	let audioPaths = undefined;
	let scorePaths = undefined;
	fs.readdir(workDirPath, (error, files) => {
		if (error)
		{
			response.status(404);
			response.send();
		}
		else
		{
			audioPaths = files.filter((elem) => elem.startsWith("audio"));
			scorePaths = files.filter((elem) => elem.startsWith("score"));
			if (0 < audioPaths.length && 0 < scorePaths.length)
			{
				let child = spawn(config.PYTHON, ['auto_sync.py', audioPaths[0], scorePaths[0], syncPath]);
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
		}
	});
});

app.get('/autosync/:id', (request, response) => {
	const workDirPath = path.join(APP_DATA_PREFIX, '/', request.params.id);
	response.setHeader('Content-Type', 'application/json');
	response.header("Cache-Control", "no-cache, no-store, must-revalidate");
	response.header("Pragma", "no-cache");
	response.header("Expires", 0);
	fs.readdir(workDirPath, (error, files) => {
		if (error)
		{
			response.status(404);
			response.send();
		}
		else
		{
			const audioExists = files.reduce((acc, elem) => (acc || elem.startsWith("audio")), false);
			const scoreExists = files.reduce((acc, elem) => (acc || elem.startsWith("score")), false);
			const syncExists = files.reduce((acc, elem) => (acc || elem.startsWith("sync")), false);
			const pidPath = path.join(APP_DATA_PREFIX, '/', request.params.id, '/pid');
			let status = undefined;
			if (syncExists)
			{
				fs.readFile(pidPath, (err, data) => {
					if (error)
					{
						console.log(error);
						status = AUTO_SYNC_STATUS.STILL_SYNCING;
					}
					else if (data == "0")
					{
						status = AUTO_SYNC_STATUS.SYNC_COMPLETE;
					}
					else if (data == "1")
					{
						status = AUTO_SYNC_STATUS.SYNC_FAILED;
					}
					else
					{
						status = AUTO_SYNC_STATUS.STILL_SYNCING;
					}
					response.status(200);
					response.send({ status: status });
				});
			}
			else
			{
				if (scoreExists && !syncExists)
				{
					status = AUTO_SYNC_STATUS.READY_TO_SYNC;
				}
				else if (audioExists && !scoreExists)
				{
					status = AUTO_SYNC_STATUS.NO_SCORE;
				}
				else if (!audioExists)
				{
					status = AUTO_SYNC_STATUS.NO_AUDIO;
				}
				response.status(200);
				response.send({ status: status});
			}
		}
	});
});

app.delete('/autosync/:id', (request, response) => {
	const requestDir = path.join(APP_DATA_PREFIX, '/', request.params.id);
	fs.exists(requestDir, (exists) => {
		fs.rm(requestDir, { recursive: true, force: true}, (error) => {
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
