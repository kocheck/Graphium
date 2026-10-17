import AppKit
import QuartzCore
import GraphiumCore
import SwiftUI

/// Canvas timing for the performance monitor (PARITY §1.13). Main thread only.
@MainActor
final class PerformanceStats {
    static let shared = PerformanceStats()

    private var drawTimes: [CFTimeInterval] = []
    private(set) var lastDrawDuration: CFTimeInterval = 0

    func recordDraw(started: CFTimeInterval) {
        let now = CACurrentMediaTime()
        lastDrawDuration = now - started
        drawTimes.append(now)
        drawTimes.removeAll { now - $0 > 1 }
    }

    /// Canvas frames drawn in the last second, across every open canvas.
    var framesPerSecond: Int {
        let now = CACurrentMediaTime()
        return drawTimes.filter { now - $0 <= 1 }.count
    }

    /// The process's physical memory footprint, as Activity Monitor reports it.
    static var memoryFootprint: UInt64? {
        var info = task_vm_info_data_t()
        var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<integer_t>.size)
        let result = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
                task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count)
            }
        }
        return result == KERN_SUCCESS ? info.phys_footprint : nil
    }
}

/// ⇧⌘M overlay: canvas frame rate and draw time, memory, object counts, World Views.
struct PerformanceOverlay: View {
    @ObservedObject var document: CampaignDocument

    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.5)) { _ in
            let stats = PerformanceStats.shared
            let map = document.campaign.activeMap
            VStack(alignment: .leading, spacing: 2) {
                row("Canvas FPS", "\(stats.framesPerSecond)")
                row("Draw time", String(format: "%.1f ms", stats.lastDrawDuration * 1000))
                row("Memory", PerformanceStats.memoryFootprint.map { ByteCountFormatter.string(fromByteCount: Int64($0), countStyle: .memory) } ?? "—")
                row("Display", "\(NSScreen.main?.maximumFramesPerSecond ?? 60) Hz")
                row("Tokens", "\(map.tokens.count)")
                row("Drawings", "\(map.drawings.count)")
                row("Doors", "\(map.doors.count)")
                row("Fog regions", "\(map.exploredRegions.count)")
                row("World Views", "\(document.worldViewsOpen)")
            }
            .etchedPanel(padding: EdgeInsets(top: 10, leading: 10, bottom: 10, trailing: 10))
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Performance monitor")
        }
        .allowsHitTesting(false)
    }

    private func row(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(.body).foregroundStyle(Palette.inkSecondary.color)
            Spacer(minLength: 16)
            Text(value).readoutStyle()
        }
        .frame(width: 200)
    }
}
