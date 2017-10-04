(function load() {

	var RECEIVER_APP_ID = "F38CA5E3"; //Nagra Test Application
	var castCallback = function () { };

	window.castVideo = {};
	window.castVideo.setCastCallback = function setCastCallback(callback) {
		castCallback = callback;
	};

	window.__onGCastApiAvailable = function __onGCastApiAvailable(isAvailable) {
		if (!isAvailable) {
			document.getElementById("castButton").style.display = "none";
			return;
		}

		// Init cast
		cast.framework.CastContext.getInstance().setOptions({
			receiverApplicationId: RECEIVER_APP_ID,
			autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
		});

		// Init player controller and expose
		window.castVideo = {};
		window.castVideo.castplayer = new cast.framework.RemotePlayer();
		window.castVideo.playerController = new cast.framework.RemotePlayerController(window.castVideo.castplayer);

		//expose API for player to instigate cast
		window.castVideo.playRemote = function playRemote(content, currentTime) {
			var session = cast.framework.CastContext.getInstance().getCurrentSession();
			if (session) {
				var mediaInfo = new chrome.cast.media.MediaInfo(content.source, content.contentType);
				mediaInfo.metadata = new chrome.cast.media.GenericMediaMetadata();
				mediaInfo.metadata.title = content.title;
				mediaInfo.metadata.subtitle = content.subtitle;
				mediaInfo.metadata.images = [{ url: content.thumb }];
				mediaInfo.customData = content.customData;
				var request = new chrome.cast.media.LoadRequest(mediaInfo);
				request.currentTime = currentTime || 0;
				request.autoplay = true;
				session.loadMedia(request).then(
					function success() {
						console.log("Load succeed");
					},
					function fail(e) {
						console.log("Load failed " + e);
					}
				);
			}
		};

		//custom cast button behaviour
		window.castVideo.playerController.addEventListener(cast.framework.RemotePlayerEventType.IS_CONNECTED_CHANGED, function cb() {
			castCallback();
		});

	};
}());
