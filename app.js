var express = require('express');
var path = require('path'); // path-to-regexp
var os = require('os');
var qrcode = require('qrcode-js');
//var logger = require('morgan');
//var cookieParser = require('cookie-parser');
//var bodyParser = require('body-parser');
var routes = require('./routes/index');
var users = require('./routes/users');

var MACHINE_NAME = 'j-hashi.labs.jp';
var PORT_NUMBER = process.env.PORT || 3000;

var app = express();
app.set('port', PORT_NUMBER);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
//app.use(favicon());
//app.use(logger('dev'));
//app.use(bodyParser.json());
//app.use(bodyParser.urlencoded());
//app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/', routes);
app.use('/users', users);


function dump(v) {
	console.log(require('util').inspect(v));
}

///  Messageのリスト（古い順）
var gMessages = []
///  クライアントリスト（古い順）
var gSockets = [];

///  
function Message(time, name, text) {
	return {time:time, name: name, text: text}
}

/// 全通知
function notifiAll(json, exceptWS) {
	gSockets.forEach(function(ws) {
		if ( ws != exceptWS ) {
			ws.send(JSON.stringify(json));
		}
	});
}

/// コマンドハンドラ
function onNewCommand(m) {
	var me = this; // bind me!

	try {
		m = JSON.parse(m);
	} catch (e) {
		console.log('cannot parse', e, m);
		return;
	}

	switch ( m.cmd ) {
	case 'post':
		var time = Date.now();
		var message = Message(time, m.name, m.text);
		me.username = m.name;
		console.log("messages", message);
		gMessages.push(message);
		notifiAll({cmd: 'message', message: message});
		break;
	case 'ping':
		//var temp = JSON.stringify({cmd: 'pong'});
		//me.send(temp);
		me.send(JSON.stringify({cmd: 'pong'}));
		break;
	case 'event':
	default:
		console.log('uncaught message', JSON.stringify(m));
	}
}

/// 新規接続
app.set('wsconnect', function onNewConnection(ws) {
	//dump(ws);

	// 追加
	gSockets.push(ws);
	// 終了時処理
	ws.on('close', function() {
		var i = gSockets.indexOf(ws);
		if ( i != -1 ) {
			// 全員に通知
			var name = ws.username || 'A user'
			notifiAll({cmd: 'event', body: name + ' left' }, ws);
			console.log('Socket closed ' + name + ' left');
			//dump(ws);
			gSockets.splice(i, 1);
		}
	});

	// 初回接続はすべてのメッセージを送信
	ws.send(JSON.stringify({cmd: 'hello', messages: gMessages}));

	// コマンドハンドラ
	ws.on('message', onNewCommand.bind(ws));
});

// ホスト情報照会
app.get('/host', function(req, res, next) {
	var ret = []
	var ifs = os.networkInterfaces();

	for ( var dev in ifs ) {

		//console.log('ifs', [dev], "-------------------------------------");

		ifs[dev].forEach(function(details) {

			//console.log('***details', details ) ;

			//if ( details.internal && 
			if ( details.family == 'IPv4' && details.address != "127.0.0.1" ) {

				var hostname = details.address.replace(/\./g, '-');
				var scheme = 'https';
				var port = PORT_NUMBER !== 80 ? (':' + PORT_NUMBER) : '';
				var url = scheme + "://" + hostname + "." + MACHINE_NAME + port + '/';
				var q = qrcode.toDataURL(url, 4)
				//console.log(q);
				console.log(">>>>", url, details.family);
				ret.push( {
				   	family:details.family,
				   	name: dev,
				   	address: details.address,
					url: url,
					qrcode: q
				} );
			}
		});
	}
	res.status(200);
	res.send(JSON.stringify(ret));
});


/// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});


/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
///app.use(function(err, req, res, next) {
///    res.status(err.status || 500);
///    res.render('error', {
///        message: err.message,
///        error: {}
///    });
///});

module.exports = app;
