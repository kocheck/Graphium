import AVFoundation
import AppKit
import GraphiumCore

/// Plays the current soundscape under the music (macos/docs/planning/soundscapes/plan.md): one
/// looping player per bed, and a few voices per scatter layer that fire clips on a timer.
/// Everything runs through one bus, so the master volume and duck apply in one place.
@MainActor
final class SoundscapePlayer {
    private static let sceneFade = 1.5
    private static let voicesPerScatter = 3

    private let engine: AVAudioEngine
    private let bus = AVAudioMixerNode()
    private let ensureRunning: () -> Void
    private let onError: (String) -> Void
    private var sceneID: String?
    private var layers: [String: Layer] = [:]
    private var busLevel: Float = 0
    private var fadeTimer: Timer?
    /// The newest runtime, so a scene built after its fade-out uses the current levels.
    private var latest: SessionConsoleRuntime?
    /// True while the old scene fades out; a level fade then would cancel the switch.
    private var switching = false
    private var buffers: [String: AVAudioPCMBuffer] = [:]

    /// Every voice plays this format, so a mono clip and a stereo bed can share a layer.
    private static let format = AVAudioFormat(standardFormatWithSampleRate: 48_000, channels: 2)!

    private final class Layer {
        let id: String
        let mixer = AVAudioMixerNode()
        var voices: [AVAudioPlayerNode] = []
        var nextVoice = 0
        var schedule: ScatterSchedule?
        var timer: Timer?

        init(id: String) { self.id = id }
    }

    init(engine: AVAudioEngine, ensureRunning: @escaping () -> Void, onError: @escaping (String) -> Void) {
        self.engine = engine
        self.ensureRunning = ensureRunning
        self.onError = onError
        engine.attach(bus)
        engine.connect(bus, to: engine.mainMixerNode, format: Self.format)
        bus.outputVolume = 0
    }

    func apply(_ runtime: SessionConsoleRuntime) {
        latest = runtime
        guard runtime.ambience.soundscapeId == sceneID else {
            switchScene(to: runtime.soundscape)
            return
        }
        guard !switching, let scene = runtime.soundscape else { return }
        for layer in scene.layers {
            layers[layer.id]?.mixer.outputVolume = Float(runtime.ambience.level(of: layer) / 100)
        }
        fade(to: Float(runtime.ambienceVolume / 100), over: 0.25)
    }

    func shutdown() {
        fadeTimer?.invalidate()
        fadeTimer = nil
        tearDown()
        sceneID = nil
        switching = false
        latest = nil
        setBusLevel(0)
    }

    // MARK: Scenes

    /// Fades the old scene out, then builds and fades in the new one (or stays silent).
    private func switchScene(to scene: Soundscape?) {
        sceneID = scene?.id
        let start = { [weak self] in
            guard let self, self.sceneID == scene?.id else { return }
            self.switching = false
            self.tearDown()
            guard let scene, let runtime = self.latest else { return }
            self.build(scene, runtime: runtime)
            self.fade(to: Float(runtime.ambienceVolume / 100), over: Self.sceneFade)
        }
        if layers.isEmpty {
            start()
        } else {
            switching = true
            fade(to: 0, over: Self.sceneFade, then: start)
        }
    }

    private func build(_ scene: Soundscape, runtime: SessionConsoleRuntime) {
        ensureRunning()
        for layer in scene.layers {
            let playing = Layer(id: layer.id)
            engine.attach(playing.mixer)
            engine.connect(playing.mixer, to: bus, fromBus: 0, toBus: bus.nextAvailableInputBus, format: Self.format)
            playing.mixer.outputVolume = Float(runtime.ambience.level(of: layer) / 100)
            switch layer.kind {
            case .bed(let file):
                guard let buffer = buffer(for: file) else { continue }
                let voice = addVoice(to: playing)
                voice.scheduleBuffer(buffer, at: nil, options: .loops)
                voice.play()
            case .scatter(let files, let interval):
                for _ in 0..<Self.voicesPerScatter { _ = addVoice(to: playing) }
                playing.schedule = ScatterSchedule(files: files, interval: interval, seed: .random(in: .min ... .max))
                scheduleNext(playing, firstWithin: interval.upperBound)
            }
            layers[layer.id] = playing
        }
    }

    private func addVoice(to layer: Layer) -> AVAudioPlayerNode {
        let voice = AVAudioPlayerNode()
        engine.attach(voice)
        engine.connect(voice, to: layer.mixer, fromBus: 0, toBus: layer.mixer.nextAvailableInputBus, format: Self.format)
        layer.voices.append(voice)
        return voice
    }

    /// Waits the schedule's interval, plays the clip on the next free voice, and repeats.
    /// The first clip comes sooner, anywhere inside one interval, so a new scene isn't empty.
    private func scheduleNext(_ layer: Layer, firstWithin: Double? = nil) {
        guard let firing = layer.schedule?.next() else { return }
        let delay = firstWithin.map { Double.random(in: 0.5...max(0.5, $0)) } ?? firing.delay
        // The timer looks the layer up by id: a torn-down scene's timer finds nothing.
        let id = layer.id
        layer.timer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self, let layer = self.layers[id], !layer.voices.isEmpty else { return }
                if let buffer = self.buffer(for: firing.file) {
                    let voice = layer.voices[layer.nextVoice % layer.voices.count]
                    layer.nextVoice += 1
                    voice.volume = Float(pow(10, firing.gainDB / 20))
                    voice.scheduleBuffer(buffer, at: nil, options: .interrupts)
                    voice.play()
                }
                self.scheduleNext(layer)
            }
        }
    }

    private func tearDown() {
        for layer in layers.values {
            layer.timer?.invalidate()
            for voice in layer.voices {
                voice.stop()
                engine.detach(voice)
            }
            engine.detach(layer.mixer)
        }
        layers = [:]
    }

    // MARK: Files

    /// Bundled sounds are short, so each is decoded once into the shared stereo format.
    private func buffer(for file: String) -> AVAudioPCMBuffer? {
        if let cached = buffers[file] { return cached }
        guard let url = Bundle.main.url(forResource: file, withExtension: nil) else {
            onError("Soundscape sound “\(file)” is missing from the app.")
            return nil
        }
        do {
            let audio = try AVAudioFile(forReading: url)
            guard let decoded = AVAudioPCMBuffer(pcmFormat: audio.processingFormat, frameCapacity: AVAudioFrameCount(audio.length))
            else { return nil }
            try audio.read(into: decoded)
            let stereo = try Self.toStereo(decoded)
            buffers[file] = stereo
            return stereo
        } catch {
            onError("Couldn't read soundscape sound “\(file)”.")
            return nil
        }
    }

    /// Mono clips go to both channels; anything not at 48 kHz goes through a converter.
    private static func toStereo(_ input: AVAudioPCMBuffer) throws -> AVAudioPCMBuffer {
        guard let out = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: input.frameLength) else { return input }
        if input.format.sampleRate == format.sampleRate, let source = input.floatChannelData,
            let target = out.floatChannelData
        {
            let channels = Int(input.format.channelCount)
            for channel in 0..<2 {
                target[channel].update(from: source[min(channel, channels - 1)], count: Int(input.frameLength))
            }
            out.frameLength = input.frameLength
            return out
        }
        guard let converter = AVAudioConverter(from: input.format, to: format) else { return input }
        let ratio = format.sampleRate / input.format.sampleRate
        guard let resampled = AVAudioPCMBuffer(
            pcmFormat: format, frameCapacity: AVAudioFrameCount(Double(input.frameLength) * ratio) + 1024)
        else { return input }
        var fed = false
        var error: NSError?
        converter.convert(to: resampled, error: &error) { _, status in
            if fed {
                status.pointee = .endOfStream
                return nil
            }
            fed = true
            status.pointee = .haveData
            return input
        }
        if let error { throw error }
        return resampled
    }

    // MARK: Level

    private func fade(to level: Float, over requested: Double, then completion: (() -> Void)? = nil) {
        let seconds = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion ? 0 : requested
        fadeTimer?.invalidate()
        let start = busLevel
        let steps = max(1, Int((seconds * 1000 / 40).rounded()))
        guard seconds > 0 else {
            setBusLevel(level)
            completion?()
            return
        }
        var step = 0
        fadeTimer = Timer.scheduledTimer(withTimeInterval: 0.04, repeats: true) { [weak self] timer in
            MainActor.assumeIsolated {
                guard let self else { return timer.invalidate() }
                step += 1
                self.setBusLevel(start + (level - start) * Float(step) / Float(steps))
                if step >= steps {
                    timer.invalidate()
                    completion?()
                }
            }
        }
    }

    private func setBusLevel(_ level: Float) {
        busLevel = min(max(level, 0), 1)
        bus.outputVolume = busLevel
    }
}
