var express = require('express');
var request = require('request');
var bodyParser = require('body-parser');
var fs = require('fs');
var url = require("url");
var querystring = require("querystring");
var ping = require("ping");

var app = express();
app.use(bodyParser.urlencoded({ extended: false }));

//远程请求地址
var restart_url = 'https://panel.cloudatcost.com/api/v1/powerop.php';
var delete_url = 'https://panel.cloudatcost.com/api/v1/delete.php';
var allserver_url = 'https://panel.cloudatcost.com/api/v1/listservers.php';
var change_mode_url = 'https://panel.cloudatcost.com/api/v1/runmode.php';


app.listen(18080);

//关闭服务器
function stop_server(key, login, sid, callback) {
    request.post({ url: restart_url, form: { key: key, login: login, sid: sid,action:'poweroff' } },
        function (err, res, body) {
            if (!err && res.statusCode == 200) {
                try
                {
                    var info = JSON.parse(body);
                    return callback(null, info.status == 'ok');
                }catch(e){
                    return callback('未知错误', !1);
                }
            }
            callback(err);
        })
}

//启动服务器
function start_server(key, login, sid, callback){
	request.post({ url: restart_url, form: { key: key, login: login, sid: sid,action:'poweron' }},function(err, res, body){
		var info = JSON.parse(body);
                console.log(info);
                return callback(null, info.status == 'ok');
	});
}

//PING IP
function check_ping(ip, callback) {
    ping.sys.probe(ip, function (isAlive) {
        return callback(null, isAlive)
    });
}

//修改运行模式为普通
function change_mode(key,login,sid,callback){
	request.post({ url: change_mode_url, form: { key: key, login: login, sid: sid,mode:'normal' }},function(err, res, body){
		try{
            var info = JSON.parse(body);
            if(info.status === 'ok')
                return callback(null, info.status == 'ok');
            else
                return callback(info.status == 'ok');
        }catch(e)
        {
            return callback(e,null);
        }
	});
}

function is_server_finish(key, login, sid, callback) {
    request.get(allserver_url + "?login=" + login + "&key=" + key, function (err, res, body) {
        console.log(body);
        if (!err && res.statusCode == 200) {
            try
            {
                var info = JSON.parse(body);
	            for (var i in info.data) {
	    	        var server = info.data[i];
	    	        if (server.sid == sid){
                        callback(null, server.status == "Powered On" ? 1 : server.status == "Powered Off" ? 2 : 0, server.ip);
	    	            return;
	    	        }
                }
            }catch(e)
            {
                console.log(e);
            }
            callback('can not find server sid = ' + sid, !!0);
        }else
	        callback(err);
        });
}

function delete_server(key,login,sid,callback){
	request.post({ url: delete_url, form: { key: key, login: login, sid: sid}},function(err, res, body){
		var info = JSON.parse(body);
        return callback(null, info.status == 'ok');
	});
}

function success_ip(msg){
    fs.appendFile('./log.txt',msg,'utf8',function(err){  
        if(err){console.log(err);}});  
}

app.get("/cac/check", function (req, res) {
    var objectUrl = url.parse(req.url);
    var objectQuery = querystring.parse(objectUrl.query);
    sid = objectQuery.sid;
    login = objectQuery.login;
    key = objectQuery.key;
    is_server_finish(key, login, sid, function (err, flag, ip) {
        if (!err && flag > 0) {
    	    //已经关机,发送开机指令
            if(flag == 2){
    	        start_server(key, login, sid, function () {
                    console.log('SID:' + sid + ' IP:' + ip +' 服务器已关机,已经发送开机指令');
                    res.jsonp({ err_code: 1, status: 0, msg: '服务器已经关机，已经发送开机命令' });
                });
    	        return;
    	    }
            check_ping(ip, function (err, isok) {
                    if (isok){
                        console.log('SID:' + sid + ' IP:' + ip +' 服务器网络通了');
                        //success_ip(new Date().toLocaleString() + ' ::: ' + IP + '成功PING通');
                        res.jsonp({ err_code: 0, status: 1, msg: '服务器网络已经好了,访问:http://ping.chinaz.com/'+ ip + '查看'  });
                        return;
                    }
                    else{
                        stop_server(key, login, sid, function () {
                                console.log('SID:' + sid + ' IP:' + ip +' 服务器重启成功，但是网络不通，已发送关机命令');
                                res.jsonp({ err_code: 1, status: 0, msg: '服务器重启成功，但是网络不通，已发送关机命令' });
                                return;
    			        });
                    }
                })
        }
    	else{
            console.log('SID:' + sid + ' IP:' + ip +' 服务器处于启动中,请骚等......');        
            res.jsonp({ err_code: 3, status: 0, msg: '服务器处于启动中,请骚等......' });
    		return;
        }
    });
});

app.get('/cac/delete',function(req,res){
    var objectUrl = url.parse(req.url);
    var objectQuery = querystring.parse(objectUrl.query);
    sid = objectQuery.sid;
    login = objectQuery.login;
    key = objectQuery.key;
    delete_server(sid,login,key,function(err){
        console.log('SID:' + sid +' 已发送删除命令');
        return res.jsonp({ err_code: 1, status: 0, msg: ' 已发送删除命令' })
    });
});

app.get('/',function(req,res){
    res.sendfile('index.html');
})

