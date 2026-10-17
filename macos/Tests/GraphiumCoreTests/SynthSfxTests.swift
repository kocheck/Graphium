import XCTest

@testable import GraphiumCore

final class SynthSfxTests: XCTestCase {
    func testDurationsMatchRecipes() {
        for type in SynthType.allCases {
            let samples = SynthSfx.render(type, sampleRate: 8000)
            XCTAssertEqual(samples.count, Int((SynthSfx.duration(of: type) * 8000).rounded(.up)), "\(type)")
            XCTAssertTrue(samples.allSatisfy { $0.isFinite && abs($0) <= 1 }, "\(type) stays in range")
        }
    }

    func testEnvelopesShapeLoudness() {
        func rms(_ s: ArraySlice<Float>) -> Float { (s.reduce(0) { $0 + $1 * $1 } / Float(s.count)).squareRoot() }
        let chime = SynthSfx.render(.chime, sampleRate: 8000)
        XCTAssertGreaterThan(rms(chime[0..<800]), rms(chime[(chime.count - 800)...]) * 10, "chime decays")
        let drone = SynthSfx.render(.drone, sampleRate: 8000)
        XCTAssertLessThan(rms(drone[0..<400]), rms(drone[6000..<6800]), "drone swells in")
        let tone = SynthSfx.render(.testTone, sampleRate: 8000)
        XCTAssertGreaterThan(rms(tone[8000..<16000]), 0.1, "test tone holds")
    }

    func testSnapIsDeterministic() {
        XCTAssertEqual(SynthSfx.render(.snap, sampleRate: 8000), SynthSfx.render(.snap, sampleRate: 8000))
    }

    func testResolveSynthType() {
        XCTAssertEqual(SynthSfx.resolve(sfxID: "anything", synthType: .ping), .ping)
        XCTAssertEqual(SynthSfx.resolve(sfxID: "chime", synthType: nil), .chime)
        XCTAssertEqual(SynthSfx.resolve(sfxID: "test-tone", synthType: nil), .testTone)
        XCTAssertNil(SynthSfx.resolve(sfxID: "door-creak", synthType: nil))
    }
}
