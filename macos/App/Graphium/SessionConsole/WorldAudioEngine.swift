import AVFoundation
import AppKit
import GraphiumCore
import WebKit

/// Plays the Session Console's audio for one World View (PARITY §5.4). The World
/// View owns audio so the DM can share that window, with sound, in Discord.
/// Local tracks and SFX go through AVAudioEngine; YouTube through a hidden web view.
@MainActor
final class WorldAudioEngine: ObservableObject {
    /// Shown in the DM's master bar via the document.
    @Published private(set) var lastError: String?

    let youtube = YouTubePlayer()
    private let engine = AVAudioEngine()
    private let music = AVAudioPlayerNode()
    private let effects = AVAudioPlayerNode()
    private var applied: SessionConsoleRuntime?
    private var musicLevel: Float = 0
    private var fadeTimer: Timer?
    private var fadeStep = 0
    private var fadeCompletion: (() -> Void)?
    private var tempFiles: [URL] = []

    init() {
        engine.attach(music)
        engine.attach(effects)
        engine.connect(music, to: engine.mainMixerNode, format: nil)
        engine.connect(effects, to: engine.mainMixerNode, format: nil)
        music.volume = 0
        youtube.onError = { [weak self] message in self?.lastError = message }
    }

    /// Ends all playback when the World View closes: the World View is the only audio
    /// output (PARITY §5.4). A later `apply` starts again from scratch.
    func shutdown() {
        fadeTimer?.invalidate()
        fadeTimer = nil
        fadeCompletion = nil
        musicGeneration += 1
        music.stop()
        effects.stop()
        engine.stop()
        youtube.shutdown()
        closeMusicFile()
        applied = nil
        setMusicLevel(0)
    }

    deinit {
        for url in tempFiles { try? FileManager.default.removeItem(at: url) }
    }

    private func ensureRunning() {
        guard !engine.isRunning else { return }
        do { try engine.start() } catch { lastError = "Audio output unavailable: \(error.localizedDescription)" }
    }

    /// Brings playback in line with the runtime (call on every runtime change).
    func apply(_ runtime: SessionConsoleRuntime, assets: [String: Data]) {
        let previous = applied
        applied = runtime
        let target = Float(runtime.effectiveVolume / 100)
        let audio = runtime.audio
        let old = previous?.audio

        let newTrack = audio.trackId != old?.trackId || audio.restartSeq != old?.restartSeq
        switch audio.status {
        case .stopped:
            if old?.status != .stopped, old != nil {
                fade(to: 0, over: 0.5) { [weak self] in
                    self?.music.stop()
                    self?.youtube.stop()
                }
            }
        case .playing:
            if newTrack || old?.status == .stopped || old == nil {
                // Switch: 300 ms out, start the new track, 300 ms in.
                fade(to: 0, over: previous?.audio.status == .playing ? 0.3 : 0) { [weak self] in
                    self?.start(audio, assets: assets)
                    self?.fade(to: target, over: 0.3)
                }
            } else if old?.status == .paused {
                resume(audio)
                fade(to: target, over: 0.25)
            } else {
                fade(to: target, over: 0.25)  // mixer change
            }
        case .paused:
            if old?.status == .playing { pause(audio) }
        }

        if runtime.sfxSeq != previous?.sfxSeq ?? 0, runtime.sfxSeq > 0, let id = runtime.sfxId {
            playEffect(id: id, kind: runtime.sfxKind, synth: runtime.sfxSynthType, src: runtime.sfxSrc, assets: assets)
        }
    }

    // MARK: Music

    private func start(_ audio: SessionConsoleRuntime.Audio, assets: [String: Data]) {
        musicGeneration += 1
        music.stop()
        youtube.stop()
        lastError = nil
        if audio.source != .local || audio.src != musicFile?.name { closeMusicFile() }
        switch audio.source {
        case .youtube:
            guard let id = audio.youtubeId else { return }
            youtube.play(videoID: id, loop: audio.loop, volume: 0)
        case .local:
            guard let src = audio.src, let file = openMusic(asset: src, assets: assets) else {
                lastError = "Couldn't play “\(audio.title)”."
                return
            }
            ensureRunning()
            engine.connect(music, to: engine.mainMixerNode, format: file.processingFormat)
            // Streamed from the open file, like TS's <audio> element; never decoded whole.
            musicLoops = audio.loop
            scheduleMusic(file, generation: musicGeneration)
            // A second copy queued ahead keeps the loop gapless; each finished copy queues another.
            if audio.loop { scheduleMusic(file, generation: musicGeneration) }
            music.play()
        case nil:
            break
        }
    }

    private func pause(_ audio: SessionConsoleRuntime.Audio) {
        audio.source == .youtube ? youtube.pause() : music.pause()
    }

    private func resume(_ audio: SessionConsoleRuntime.Audio) {
        audio.source == .youtube ? youtube.resume() : music.play()
    }

    /// TS `fadeToLevel`: 40 ms linear steps; zero duration sets immediately.
    private func fade(to level: Float, over requested: Double, then completion: (() -> Void)? = nil) {
        // Reduce Motion skips fades, as TS does under prefers-reduced-motion (PARITY §7).
        let seconds = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion ? 0 : requested
        fadeTimer?.invalidate()
        // An interrupted fade still finishes its job (e.g. starting the next track).
        let interrupted = fadeCompletion
        fadeCompletion = nil
        interrupted?()
        let start = musicLevel
        let steps = max(1, Int((seconds * 1000 / 40).rounded()))
        guard seconds > 0 else {
            setMusicLevel(level)
            completion?()
            return
        }
        fadeStep = 0
        fadeCompletion = completion
        fadeTimer = Timer.scheduledTimer(withTimeInterval: 0.04, repeats: true) { [weak self] timer in
            MainActor.assumeIsolated {
                guard let self else { return timer.invalidate() }
                self.fadeStep += 1
                self.setMusicLevel(start + (level - start) * Float(self.fadeStep) / Float(steps))
                if self.fadeStep >= steps {
                    timer.invalidate()
                    let done = self.fadeCompletion
                    self.fadeCompletion = nil
                    done?()
                }
            }
        }
    }

    private func setMusicLevel(_ level: Float) {
        musicLevel = min(max(level, 0), 1)
        music.volume = musicLevel
        youtube.setVolume(Int((musicLevel * 100).rounded()))
    }

    // MARK: Effects

    private func playEffect(id: String, kind: SfxKind?, synth: SynthType?, src: String?, assets: [String: Data]) {
        ensureRunning()
        let buffer: AVAudioPCMBuffer?
        if kind == .local, let src {
            buffer = decode(asset: src, assets: assets)
        } else if let type = SynthSfx.resolve(sfxID: id, synthType: synth) {
            buffer = synthBuffer(type)
        } else {
            buffer = nil
        }
        guard let buffer else { return }
        engine.connect(effects, to: engine.mainMixerNode, format: buffer.format)
        effects.scheduleBuffer(buffer, at: nil, options: [.interrupts])
        effects.play()
    }

    private var synthCache: [SynthType: AVAudioPCMBuffer] = [:]

    private func synthBuffer(_ type: SynthType) -> AVAudioPCMBuffer? {
        if let cached = synthCache[type] { return cached }
        let rate = 48_000.0
        let samples = SynthSfx.render(type, sampleRate: rate)
        guard let format = AVAudioFormat(standardFormatWithSampleRate: rate, channels: 1),
            let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(samples.count))
        else { return nil }
        buffer.frameLength = AVAudioFrameCount(samples.count)
        samples.withUnsafeBufferPointer { source in
            buffer.floatChannelData?[0].update(from: source.baseAddress!, count: samples.count)
        }
        synthCache[type] = buffer
        return buffer
    }

    private var decoded: [String: AVAudioPCMBuffer] = [:]

    /// Package assets are bytes in memory; AVAudioFile needs a file, so write to temp.
    private static func tempURL(for name: String) -> URL {
        FileManager.default.temporaryDirectory
            .appendingPathComponent("graphium-audio-\(UUID().uuidString)-\((name as NSString).lastPathComponent)")
    }

    /// SFX are short, so they are decoded whole (and cached); the temp file goes right away.
    private func decode(asset name: String, assets: [String: Data]) -> AVAudioPCMBuffer? {
        if let cached = decoded[name] { return cached }
        guard let data = assets[name] else { return nil }
        let url = Self.tempURL(for: name)
        defer { try? FileManager.default.removeItem(at: url) }
        do {
            try data.write(to: url)
            let file = try AVAudioFile(forReading: url)
            guard let buffer = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: AVAudioFrameCount(file.length))
            else { return nil }
            try file.read(into: buffer)
            decoded[name] = buffer
            return buffer
        } catch {
            lastError = "Couldn't read audio “\(name)”."
            return nil
        }
    }

    // MARK: Streamed music

    /// The current local track, open on its temp file (only one at a time).
    private var musicFile: (name: String, url: URL, file: AVAudioFile)?
    private var musicLoops = false
    /// Bumped whenever music restarts or shuts down, so stale completion handlers do nothing.
    private var musicGeneration = 0

    private func openMusic(asset name: String, assets: [String: Data]) -> AVAudioFile? {
        if let current = musicFile, current.name == name { return current.file }
        closeMusicFile()
        guard let data = assets[name] else { return nil }
        let url = Self.tempURL(for: name)
        do {
            try data.write(to: url)
            tempFiles.append(url)
            let file = try AVAudioFile(forReading: url)
            musicFile = (name: name, url: url, file: file)
            return file
        } catch {
            try? FileManager.default.removeItem(at: url)
            tempFiles.removeAll { $0 == url }
            lastError = "Couldn't read audio “\(name)”."
            return nil
        }
    }

    /// Drops the current track's file and deletes its temp copy.
    private func closeMusicFile() {
        guard let current = musicFile else { return }
        musicFile = nil
        try? FileManager.default.removeItem(at: current.url)
        tempFiles.removeAll { $0 == current.url }
    }

    private func scheduleMusic(_ file: AVAudioFile, generation: Int) {
        music.scheduleFile(file, at: nil, completionCallbackType: .dataPlayedBack) { [weak self] _ in
            Task { @MainActor in self?.musicSegmentFinished(generation) }
        }
    }

    /// Loops by queueing the file again each time a copy finishes playing.
    private func musicSegmentFinished(_ generation: Int) {
        guard generation == musicGeneration, musicLoops, let file = musicFile?.file,
            applied?.audio.status != .stopped
        else { return }
        scheduleMusic(file, generation: generation)
    }
}

/// A hidden YouTube IFrame player. Loaded from an https base URL so YouTube sees a
/// real origin and Referer (the reason TS needed its graphium:// protocol).
@MainActor
final class YouTubePlayer: NSObject, WKScriptMessageHandler {
    let webView: WKWebView
    var onError: ((String) -> Void)?
    private var ready = false
    /// What the player should be doing once it is ready. Calls made before the
    /// IFrame API loads update this instead of being dropped, so a fade-in, pause
    /// or stop issued meanwhile still takes effect (TS useWorldTransport).
    private var pendingLoad: (id: String, loop: Bool)?
    private var pendingVolume = 0
    private var pendingPaused = false

    override init() {
        let configuration = WKWebViewConfiguration()
        configuration.mediaTypesRequiringUserActionForPlayback = []
        let controller = WKUserContentController()
        configuration.userContentController = controller
        webView = WKWebView(frame: CGRect(x: 0, y: 0, width: 320, height: 180), configuration: configuration)
        super.init()
        // The controller retains its handlers; a weak proxy avoids a cycle through webView.
        controller.add(WeakScriptMessageHandler(self), name: "graphium")
        webView.loadHTMLString(Self.html, baseURL: URL(string: "https://graphium.app/world"))
    }

    func play(videoID: String, loop: Bool, volume: Int) {
        reviveIfShutDown()
        // The id comes from campaign.json, which may be a shared file; never let it reach the page unchecked.
        guard SessionConsoleAudio.isVideoID(videoID) else {
            onError?("That YouTube link isn't valid.")
            return
        }
        guard ready else {
            pendingLoad = (videoID, loop)
            pendingVolume = volume
            pendingPaused = false
            return
        }
        call("graphiumLoad(id, loop, volume)", ["id": videoID, "loop": loop, "volume": volume])
    }

    func pause() {
        guard ready else {
            pendingPaused = true
            return
        }
        call("graphiumPause()", [:])
    }

    func resume() {
        guard ready else {
            pendingPaused = false
            return
        }
        call("graphiumResume()", [:])
    }

    func stop() {
        guard ready else {
            pendingLoad = nil
            return
        }
        call("graphiumStop()", [:])
    }

    func setVolume(_ volume: Int) {
        guard ready else {
            pendingVolume = volume
            return
        }
        call("graphiumVolume(volume)", ["volume": volume])
    }

    private var isShutDown = false

    /// Unloads the player page so nothing keeps playing after the World View closes.
    func shutdown() {
        isShutDown = true
        ready = false
        pendingLoad = nil
        webView.stopLoading()
        if let blank = URL(string: "about:blank") { webView.load(URLRequest(url: blank)) }
    }

    /// Reloads the player page after `shutdown`; its "ready" message applies the pending load.
    private func reviveIfShutDown() {
        guard isShutDown else { return }
        isShutDown = false
        webView.loadHTMLString(Self.html, baseURL: URL(string: "https://graphium.app/world"))
    }

    /// Values travel as JavaScript arguments, never spliced into the script source.
    private func call(_ function: String, _ arguments: [String: Any]) {
        webView.callAsyncJavaScript(function, arguments: arguments, in: nil, in: .page, completionHandler: nil)
    }

    nonisolated func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        // WebKit delivers script messages on the main thread, and `body` is main-actor isolated.
        MainActor.assumeIsolated {
            let body = message.body as? [String: Any]
            let type = body?["type"] as? String
            let code = body?["code"] as? Int
            switch type {
            case "ready":
                ready = true
                if let load = pendingLoad {
                    // A track paused before the player loaded is cued, not started.
                    call(
                        pendingPaused ? "graphiumCue(id, loop, volume)" : "graphiumLoad(id, loop, volume)",
                        ["id": load.id, "loop": load.loop, "volume": pendingVolume])
                }
                pendingLoad = nil
            case "error":
                onError?(Self.errorMessage(code ?? 0))
            default:
                break
            }
        }
    }

    /// TS `youtubeErrorMessage`.
    static func errorMessage(_ code: Int) -> String {
        switch code {
        case 101, 150: return "This video's owner doesn't allow it to be played in other apps. Copy the links to share them instead."
        case 153: return "YouTube rejected the player's origin. Copy the links to share them instead."
        default: return "YouTube error \(code)"
        }
    }

    private static let html = """
        <!doctype html><html><body style="margin:0;background:#000">
        <div id="player"></div>
        <script>
        var player, wantLoop = true, queued = null;
        function post(m){ window.webkit.messageHandlers.graphium.postMessage(m); }
        function onYouTubeIframeAPIReady(){
          player = new YT.Player('player', { width: 320, height: 180,
            playerVars: { autoplay: 1, controls: 0, playsinline: 1, origin: 'https://graphium.app' },
            events: {
              onReady: function(){ post({type:'ready'}); },
              onError: function(e){ post({type:'error', code: e.data}); },
              onStateChange: function(e){ if (e.data === 0 && wantLoop) { player.seekTo(0); player.playVideo(); } }
            }});
        }
        function graphiumLoad(id, loop, volume){ wantLoop = loop; player.setVolume(volume); player.loadVideoById(id); }
        function graphiumCue(id, loop, volume){ wantLoop = loop; player.setVolume(volume); player.cueVideoById(id); }
        function graphiumPause(){ player && player.pauseVideo(); }
        function graphiumResume(){ player && player.playVideo(); }
        function graphiumStop(){ player && player.stopVideo(); }
        function graphiumVolume(v){ player && player.setVolume(v); }
        </script>
        <script src="https://www.youtube.com/iframe_api"></script>
        </body></html>
        """
}

/// Forwards script messages without retaining the real handler, which would otherwise
/// form a cycle (handler → webView → configuration → controller → handler).
@MainActor
private final class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
    weak var target: (any WKScriptMessageHandler)?

    init(_ target: any WKScriptMessageHandler) {
        self.target = target
        super.init()
    }

    nonisolated func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        MainActor.assumeIsolated {
            target?.userContentController(controller, didReceive: message)
        }
    }
}
