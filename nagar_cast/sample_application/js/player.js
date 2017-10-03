(function start() {

	// Constants
	var STREAM_FILE = "streams.json";
	var SERVER_FILE = "servers.json";
	var SERVER_KEY = "Cloud_SSP";
	var TENANT_ID = "CON935WN";

	var playerInstance;
	var streamsInfo = null;
	var serverInfo = null;
	var uiControls = {};

	document.addEventListener("DOMContentLoaded", function initializeRefApp() {

		console.log("Entering setup");

		videojs.Html5DashJS.hook("beforeinitialize", function beforeInitialize(player, mediaPlayer) {
			if (videojs) {
				//Setup the Protection Controller to use SSP specific functionaility
				mediaPlayer.extend("ProtectionController", OTV.player.dashjs.SSPProtectionController, true);
				document.getElementById("lib-version").textContent = mediaPlayer.getVersion();
				mediaPlayer.setAutoPlay = function setAutoPlay() {
					//hack to fix live play back due to know bug with videojs-dashjs
				};
			}
		});

		//Try to retrive the server information first
		setupServerInfo();

		//Try to construct the streams list
		setupStreamsList();

		// Initialise the player
		playerInstance = videojs("videoPlayer", {
			controlBar: {
				fullscreenControl: false
			},
			html5: {
				nativeCaptions: false,
				nativeAudioTracks: false
			}
		});
		window.playerInstance = playerInstance;



		//Setup the version information
		document.getElementById("your-version").textContent = OTV.versions.product;

		//Assign the functionalities
		uiControls.streamLoadButton = document.getElementById("stream-load-btn");
		uiControls.streamTokenCheckbox = document.getElementById("stream-token-checkbox");
		uiControls.castButton = document.getElementById("castButton");
		uiControls.streamUrlInput = document.getElementById("stream-url-input");
		uiControls.streamTokenInput = document.getElementById("stream-token-input");
		uiControls.streamLoadButton.onclick = loadStream;
		uiControls.streamTokenCheckbox.onchange = toggleTokenInput;

		//setup for chromecast
		if (window.chrome && !/Edge/.test(navigator.userAgent)) {
			window.castVideo.setCastCallback(function cb() {
				var value = document.getElementById("streamList").value;
				window.castVideo.playRemote(generateCastData(value), playerInstance.currentTime());
			});
		} else {
			uiControls.castButton.style.display = "none";
		}

	});

	//cache streams available in server for future ref
	function setupStreamsList() {
		readExternalFiles(STREAM_FILE, function cb(text) {
			streamsInfo = parseStreamInfo(text);
			displayStreamsList(streamsInfo);
		}, "application/json");
	};

	function parseStreamInfo(text) {
		return JSON.parse(text)[SERVER_KEY];
	};

	//Setup server related information for future reference
	function setupServerInfo() {
		readExternalFiles(SERVER_FILE, function cb(text) {
			serverInfo = JSON.parse(text)[SERVER_KEY];
		}, "application/json");
	}

	// Construct and display the stream list
	function displayStreamsList(streamsObj) {
		let streamsDropdown = document.getElementById("streamsDropdown");

		for (let i = 0; i < streamsObj.length; i++) {
			let liItem = document.createElement("li");
			// display Stream Name and Friendly Description
			// pass Stream URL as data-stream-url attribute
			let archorItem = document.createElement("a");
			let t = streamsObj[i].Stream_Name + " ~~~~ [" + streamsObj[i].Friendly_Description + "]";
			let u = streamsObj[i].Stream_URL;
			archorItem.text = t;
			archorItem.href = "#";
			archorItem.setAttribute("data-stream-url", u);
			archorItem.onclick = getSelectedStream;
			liItem.appendChild(archorItem);
			streamsDropdown.appendChild(liItem);
		}
	}

	// set selected stream URL
	function getSelectedStream(event) {
		const target = event.target;
		uiControls.streamUrlInput.value = target.attributes['data-stream-url'].value;
	}

	// toggle stream token input
	function toggleTokenInput() {
		uiControls.streamTokenInput.disabled = !uiControls.streamTokenCheckbox.checked;
	}

	//Change or select the stream to play
	function loadStream() {
		var value = uiControls.streamUrlInput.value;
		initiatePlayback(value);
	}

	//reset to a new content
	function initiatePlayback(newSource) {
		if (!newSource) {
			logToWindow('Please input/select a stream URL');
			return;
		}

		logToWindow("Loading stream: " + newSource);
		const source = {
			src: newSource,
			type: "application/dash+xml"
		};
		const stream = findStream(newSource);

		if (stream && stream.Token) {
			source.keySystemOptions = generateProtection(stream.Token);
		}

		if (uiControls.streamTokenCheckbox.checked && uiControls.streamTokenInput.value) {
			logToWindow(`Use input token: ${uiControls.streamTokenInput.value}`);
			source.keySystemOptions = generateProtection(uiControls.streamTokenInput.value);
		}

		playerInstance.remoteTextTracks().tracks_.forEach(function (track) {
			console.log('RemovingTrack');
			console.log(track);
			playerInstance.removeRemoteTextTrack(track);
		});

		if (stream) {
			const webVttThumnailsStream = stream.Thumbnail_URL;
			if (webVttThumnailsStream) {
				videojs.getPlugin("thumbnails").call(playerInstance, {
					vtt: webVttThumnailsStream
				});
			} else {
				videojs.getPlugin("thumbnails").call(playerInstance, {
					vtt: ''
				});
			}
		}

		playerInstance.src(source);
	}



	//find the stream by URL
	function findStream(streamURL) {
		var stream = streamsInfo.filter(function search(item) {
			return item.Stream_URL === streamURL;
		});

		if (stream.length !== 1) {
			logToWindow("Can't locate the stream !!!!");
			return null;
		}
		return stream[0];
	}

	// Setup the token
	function generateProtection(streamToken) {
		return [{
			name: "com.microsoft.playready",
			options: {
				serverURL: serverInfo.url + "/" + TENANT_ID + "/prls/contentlicenseservice/v1/licenses/",
				httpRequestHeaders: {
					"Content-Type": "text/xml; charset=utf-8",
					"nv-authorizations": streamToken,
					"nv-tenant-id": TENANT_ID
				}
			}
		}, {
			name: "com.widevine.alpha",
			options: {
				serverURL: serverInfo.url + "/" + TENANT_ID + "/wvls/contentlicenseservice/v1/licenses",
				httpRequestHeaders: {
					Accept: "application/json",
					"Content-Type": "application/json",
					"nv-authorizations": streamToken,
					"nv-tenant-id": TENANT_ID
				}
			}
		}];
	}

	//creates the correct object for sending metadata to chromecast
	function generateCastData(streamURL) {
		var streamData = findStream(streamURL);
		if (streamData) {
			return {
				source: streamData.Stream_URL,
				title: streamData.Stream_Name,
				subtitle: "Test Stream",
				thumb: "",
				contentType: "application/dash+xml",
				description: "",
				customData: {
					rights: streamData.Token,
					PRLicenceUrl: serverInfo.url + "/" + TENANT_ID + "/prls/contentlicenseservice/v1/licenses/",
					WVLicenceUrl: serverInfo.url + "/" + TENANT_ID + "/wvls/contentlicenseservice/v1/licenses/"
				}
			};
		}
		return null;
	}

	//Enable logs to the display text area
	function logToWindow() {
		var logger = document.getElementById("logWindow");
		for (var i = 0; i < arguments.length; i++) {
			if (typeof arguments[i] === "object") {
				logger.innerHTML += (JSON && JSON.stringify ? JSON.stringify(arguments[i], undefined, 2) : arguments[i]) + "<br />";
			} else {
				logger.innerHTML += arguments[i] + "<br />";
			}
		}
		console.log(arguments);
	}

	//Read the external files
	function readExternalFiles(file, callback, mimeType) {
		var xhr = new XMLHttpRequest();
		xhr.overrideMimeType(mimeType);
		xhr.open("GET", file, true);
		xhr.onreadystatechange = function onreadystatechange() {
			if (xhr.readyState === 4 && xhr.status === 200) {
				callback(xhr.responseText);
			}
		};
		xhr.send(null);
	}

}());
