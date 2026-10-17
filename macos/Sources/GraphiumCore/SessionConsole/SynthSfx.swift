import Foundation

/// Offline renders of the TS Web Audio sound-effect recipes (`worldStageSfx.ts`,
/// CORE_SPEC §3.18), as mono Float samples the app plays through AVAudioEngine.
public enum SynthSfx {
    public static func duration(of type: SynthType) -> Double {
        switch type {
        case .testTone: return 3
        case .chime: return 2.5
        case .drone: return 5
        case .snap: return 0.06
        case .ping: return 1.2
        }
    }

    /// TS `resolveSynthType`: the explicit synth type, else the sfx id if it names one.
    public static func resolve(sfxID: String, synthType: SynthType?) -> SynthType? {
        synthType ?? SynthType(rawValue: sfxID)
    }

    public static func render(_ type: SynthType, sampleRate: Double = 48_000) -> [Float] {
        let count = Int((duration(of: type) * sampleRate).rounded(.up))
        var out = [Float](repeating: 0, count: count)
        let dt = 1 / sampleRate
        switch type {
        case .testTone:
            // Sines 220/330/440 Hz detuned 0/4/8 cents; ramp in 0.2 s, hold to 2.6 s, out by 3 s.
            let freqs = [220.0, 330.0, 440.0].enumerated().map { i, f in f * pow(2, Double(i * 4) / 1200) }
            for n in 0..<count {
                let t = Double(n) * dt
                let gain = t < 0.2 ? linear(0.0001, 0.22, t / 0.2) : t < 2.6 ? 0.22 : linear(0.22, 0.0001, (t - 2.6) / 0.4)
                out[n] = Float(gain * freqs.reduce(0) { $0 + sin(2 * Double.pi * $1 * t) })
            }
        case .chime:
            // Sine sweeping 880→1760 Hz (exponential, 0.1 s); gain 0.35→0.0001 exponential over 2.5 s.
            var phase = 0.0
            for n in 0..<count {
                let t = Double(n) * dt
                let f = t < 0.1 ? exponential(880, 1760, t / 0.1) : 1760
                phase += 2 * Double.pi * f * dt
                out[n] = Float(exponential(0.35, 0.0001, t / 2.5) * sin(phase))
            }
        case .drone:
            // Sawtooth 55 Hz through a 220 Hz low-pass; gain up to 0.28 by 0.8 s, down by 5 s.
            var filtered = 0.0
            let alpha = onePoleAlpha(cutoff: 220, sampleRate: sampleRate)
            for n in 0..<count {
                let t = Double(n) * dt
                let saw = 2 * (t * 55 - (t * 55 + 0.5).rounded(.down))
                filtered += alpha * (saw - filtered)
                let gain = t < 0.8 ? linear(0.0001, 0.28, t / 0.8) : linear(0.28, 0.0001, (t - 0.8) / 4.2)
                out[n] = Float(gain * filtered)
            }
        case .snap:
            // 50 ms of white noise with a linear decay, high-passed at 1 kHz; gain 0.5→0.0001 in 60 ms.
            var rng = SplitMix64(seed: 0x5EED)
            var previousIn = 0.0
            var previousOut = 0.0
            let rc = 1 / (2 * Double.pi * 1000)
            let a = rc / (rc + dt)
            for n in 0..<count {
                let t = Double(n) * dt
                let noise = t < 0.05 ? (Double(rng.next() % 2_000_001) / 1_000_000 - 1) * (1 - t / 0.05) : 0
                let high = a * (previousOut + noise - previousIn)
                previousIn = noise
                previousOut = high
                out[n] = Float(exponential(0.5, 0.0001, t / 0.06) * high)
            }
        case .ping:
            // Triangle 1200 Hz; gain 0.3→0.0001 exponential over 1.2 s.
            for n in 0..<count {
                let t = Double(n) * dt
                let x = t * 1200 - (t * 1200).rounded(.down)
                let triangle = 4 * abs(x - 0.5) - 1
                out[n] = Float(exponential(0.3, 0.0001, t / 1.2) * triangle)
            }
        }
        return out
    }

    private static func linear(_ from: Double, _ to: Double, _ progress: Double) -> Double {
        from + (to - from) * min(max(progress, 0), 1)
    }

    /// Web Audio `exponentialRampToValueAtTime`.
    private static func exponential(_ from: Double, _ to: Double, _ progress: Double) -> Double {
        from * pow(to / from, min(max(progress, 0), 1))
    }

    private static func onePoleAlpha(cutoff: Double, sampleRate: Double) -> Double {
        let dt = 1 / sampleRate
        let rc = 1 / (2 * Double.pi * cutoff)
        return dt / (rc + dt)
    }
}

/// Small deterministic RNG so the snap sounds the same every time (and tests are stable).
struct SplitMix64: RandomNumberGenerator {
    private var state: UInt64

    init(seed: UInt64) { state = seed }

    mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }
}
