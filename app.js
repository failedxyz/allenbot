var fs = require("fs");
var http = require("http");
var request = require("request");

var login = require("facebook-chat-api");
var config = require("./config");

var port = process.env.PORT || 5000;

try {
	fs.statSync("downloads");
} catch (e) {
	fs.mkdirSync("downloads");
}

http.createServer(function(req, res) {
	console.log("Ping.");
	res.writeHead(200, {
		"Content-Type": "text/plain"
	});
	res.end("");
}).listen(port);

var select_image = function(callback) {
	request({
		"url": "https://api.imgur.com/3/album/" + config.album_id + "/images",
		"headers": {
			"Authorization": "Client-ID " + config.imgur_apikey
		}
	}, function(error, response, body) {
		if (!error) {
			var data = JSON.parse(body);
			var images = data["data"];
			var i = ~~(Math.random() * images.length);
			var extension = {
				"image/jpeg": "jpg",
				"image/png": "png",
			}[images[i]["type"]];
			var filename = "downloads/" + images[i]["id"] + "." + extension;
			try {
				fs.statSync(filename);
				return callback(filename);
			} catch (e) {
				var file = fs.createWriteStream(filename);
				file.on("close", function() {
					console.log("Download successful.");
					callback(filename);
				});
				request(images[i]["link"]).pipe(file);
			}
		}
	});
};

login({
	email: config.username,
	password: config.password
}, function callback(err, api) {
	if (err) {
		return console.error(err);
	}
	api.setOptions({
		"listenEvents": true
	});
	var interpret = api.listen(function(err2, event) {
		if (err2) {
			return console.error(err2);
		}
		if (event.type === "message") {
			var message = event.body;
			var sender = event.senderName;
			var threadID = event.threadID;
			if (message.toLowerCase().startsWith("@dailyallen")) {
				select_image(function(filename) {
					var obj = {
						"attachment": fs.createReadStream(filename)
					};
					api.sendMessage(obj, threadID);
				});
			}
		}
	});
});