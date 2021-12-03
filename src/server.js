const express = require('express');
const path = require('path');
const fs = require('fs');
const uuid = require('uuid');
const app = express();
const port = 3000;

const CLIENT_DIR = 'client';
const APP_DATA_DIR = '.musicsync';
let APP_DATA_PREFIX = path.join(process.env.HOME, APP_DATA_DIR);

const AUTO_SYNC_STATUS = {
	NO_AUDIO: 0,
	NO_SCORE: 1,
	READY_TO_SYNC: 2,
	STILL_SYNCING: 3,
	SYNC_COMPLETE: 4,
};

/* =======================================================================
 * Server
 * =======================================================================
 */

app.use('/css', express.static(path.join(__dirname, `${CLIENT_DIR}/css`)));
app.use('/', express.static(path.join(__dirname, CLIENT_DIR)));


app.post('/autosync/:id/audio', (request, response) => {
	let fstream = fs.createWriteStream(path.join(APP_DATA_PREFIX, '/', request.params.id, '/audio'));
	fstream.on('finish', (error) => {
		response.status(200);
		response.send();
	});
	fstream.on('error', (error) => {
		console.log(error);
		response.status(500);
		response.send();
	});
	request.pipe(fstream);
});


app.post('/autosync/:id/score', (request, response) => {
	let fstream = fs.createWriteStream(path.join(APP_DATA_PREFIX, '/', request.params.id, '/score'));
	fstream.on('finish', (error) => {
		response.status(200);
		response.send();
	});
	fstream.on('error', (error) => {
		console.log(error);
		response.status(500);
		response.send();
	});
	request.pipe(fstream);
});

app.get('/autosync/:id/sync', (request, response) => {

});

app.put('/autosync/:id', (request, response) => {

});

app.get('/autosync/:id', (request, response) => {
	response.setHeader('Content-Type', 'application/json');
	const pidPath = path.join(APP_DATA_PREFIX, '/', request.params.id, '/pid');
	const syncPath = path.join(APP_DATA_PREFIX, '/', request.params.id, '/sync');
	const scorePath = path.join(APP_DATA_PREFIX, '/', request.params.id, '/score');
	const audioPath = path.join(APP_DATA_PREFIX, '/', request.params.id, '/audio');
	fs.exists(audioPath, (exists) => {
		if (exists)
		{
			fs.exists(scorePath, (exists) => {
				if (exists)
				{
					fs.exists(syncPath, (exists) => {
						if (exists)
						{
							fs.exists(pidPath, (exists) => {
								if (!exists)
								{
									response.send(JSON.stringify({ status: AUTO_SYNC_STATUS.SYNC_COMPLETE}));
								}
								else
								{
									response.send(JSON.stringify({ status: AUTO_SYNC_STATUS.STILL_SYNCING}));
								}
							});
						}
						else
						{
							response.send(JSON.stringify({ status: AUTO_SYNC_STATUS.READY_TO_SYNC}));
						}
					});
				}
				else
				{
					response.send(JSON.stringify({ status: AUTO_SYNC_STATUS.NO_SCORE}));
				}
			});
		}
		else
		{
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


app.listen(port, () => {
	console.log(`Example app listening at port ${port}`);
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
