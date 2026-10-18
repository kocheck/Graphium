import GraphiumCore
import SwiftUI
import WebKit

/// The Session Console "plate" shown full-window over the map (PARITY §4.1):
/// artwork, optional frame, title and subtitle, crossfading between plates.
struct WorldStageView: View {
    let runtime: SessionConsoleRuntime
    let imageProvider: (String) -> CGImage?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            if runtime.stageVisible, let active = runtime.activeImage {
                ZStack {
                    Color.black
                    if let image = imageProvider(active.src) {
                        Image(decorative: image, scale: 1)
                            .resizable()
                            .scaledToFit()
                            .padding(runtime.stage.showFrame ? 48 : 0)
                            .overlay {
                                if runtime.stage.showFrame {
                                    RoundedRectangle(cornerRadius: 6)
                                        .strokeBorder(Color(white: 0.85), lineWidth: 6)
                                        .padding(36)
                                }
                            }
                            .accessibilityLabel(active.alt.isEmpty ? active.name : active.alt)
                    }
                    if !runtime.stage.title.isEmpty || !runtime.stage.subtitle.isEmpty {
                        VStack(spacing: 6) {
                            Spacer()
                            if !runtime.stage.title.isEmpty {
                                Text(runtime.stage.title).font(.system(size: 34, weight: .bold))
                            }
                            if !runtime.stage.subtitle.isEmpty {
                                Text(runtime.stage.subtitle).font(.system(size: 26))
                            }
                        }
                        .foregroundStyle(.white)
                        .shadow(color: .black, radius: 6)
                        .padding(.bottom, 56)
                    }
                }
                .id(active.id)
                .transition(.opacity)
            }
        }
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.6), value: runtime.activeImage?.id)
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.4), value: runtime.stageVisible)
        .ignoresSafeArea()
    }
}

/// Hosts the YouTube player's web view invisibly inside the World View window.
struct HiddenWebView: NSViewRepresentable {
    let webView: WKWebView

    func makeNSView(context: Context) -> WKWebView { webView }
    func updateNSView(_ view: WKWebView, context: Context) {}
}
