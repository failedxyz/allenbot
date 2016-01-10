var fs = require("fs");
var http = require("http");

var login = require("facebook-chat-api");
var low = require("lowdb");
var request = require("request");
var storage = require("lowdb/file-sync");

var config = require("./config");
var db = low("db.json", { storage });

var port = process.env.PORT || 5000;
var cleverbot_module = require("cleverbot.io");
var cleverbot = cleverbot_module(config.cleverbot_apiuser, config.cleverbot_apikey);
// cleverbot.setNick("allenbot");
var allen_id = config.allen_id;

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
			try {
				var data = JSON.parse(body);
				var images = data["data"];
				var i = ~~(Math.random() * images.length);
				var extension = {
					"image/jpeg": "jpg",
					"image/png": "png",
				}[images[i]["type"]];
				var filename = "downloads/" + images[i]["id"] + "." + extension;
			} catch (e) {
				callback();
			}
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
		} else {
			var images = fs.readdirSync();
			var i = ~~(Math.random() * images.length);
			var filename = "downloads/" + images[i];
			console.log(filename);
			callback(filename);
		}
	});
};

login({
	email: config.username,
	password: config.password
}, function callback(err, api) {
	if (err) {
		return console.dir(err);
	}
	api.setOptions({
		"listenEvents": true
	});
	var interpret = api.listen(function(err2, event) {
		if (err2) {
			return console.dir(err2);
		}
		if (event.type === "message") {
			var message = event.body;
			var sender = event.senderName;
			var threadID = event.threadID;
			if (~~(event.senderID) == allen_id) {
				var quote = message;
				db("quotes").push({
					quote: quote,
					suggestedBy: sender
				});
			} else if (message.toLowerCase().startsWith("@commands")) {
				api.sendMessage("@allenbot commands:\n"
					+ "- @dailyallen for daily allen pic\n"
					+ "- @achachach for ach aCH ACHH\n"
					+ "- @dancingallen for dancing allen\n"
					+ "- @allenquote for quote of the day\n"
					+ "- @addquote to add a quote", threadID);
			} else if (message.toLowerCase().startsWith("@dailyallen")) {
				try {
					select_image(function(filename) {
						console.log("Sending " + filename);
						var obj = {
							"attachment": fs.createReadStream(filename)
						};
						api.sendMessage(obj, threadID);
					});
				} catch (e) {
					
				}
			} else if (message.toLowerCase().startsWith("@achachach")) {
				api.sendMessage("https://www.youtube.com/watch?v=3P_0ot0VJ9w", threadID);
			} else if (message.toLowerCase().startsWith("@source")) {
				api.sendMessage("http://github.com/failedxyz/allenbot", threadID);
			} else if (message.toLowerCase().startsWith("@dancingallen")) {
				var obj = {
					"attachment": fs.createReadStream("files/dancingallen.mp4")
				};
				api.sendMessage(obj, threadID);
			} else if (message.toLowerCase().startsWith("@allenquote")) {
				var N = 1;
				try {
					var x = parseInt(message.replace("@allenquote", "").trim());
					if (x > 1 && x <= 8)
						N = x;
				} catch (e) { }
				var quotes = db("quotes").cloneDeep();
				if (quotes.length == 0) {
					api.sendMessage("No quotes found. Use @addquote to add a quote!", threadID);
				} else {
					for(var j=0; j<N; j++) {
						var i = ~~(Math.random() * quotes.length);
						api.sendMessage("\"" + quotes[i]["quote"] + "\"", threadID);
					}
				}
			} else if (message.toLowerCase().startsWith("@addquote")) {
				var quote = message.replace("@addquote", "").trim();
				if (quote.length <= 0) {
					api.sendMessage("Usage: @addquote [quote]", threadID);
				} else {
					db("quotes").push({
						quote: quote,
						suggestedBy: sender
					});
					api.sendMessage("saved!", threadID);
				}
			} else if (message.toLowerCase().startsWith("@removeallen")) {
				api.removeUserFromGroup(allen_id, 512907945552033);
			} else if (message.toLowerCase().startsWith("@addallen")) {
				api.addUserToGroup(allen_id, 512907945552033);
			} else if (message.toLowerCase().startsWith("@cleverbot")) {
				var query = message.replace("@cleverbot", "").trim();
				cleverbot.create(function (err, session) {
					cleverbot.ask(query, function (err, response) {
						if (err) { console.log(err); return; }
						console.log(response);
						api.sendMessage("saved!", "@" + sender + ": " + response);
					});
				});
			}
		}
	});
});