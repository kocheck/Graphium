/// Metal Shading Language for `FogRenderer`, compiled at run time so the package needs no
/// Metal build step (`swift test` and Xcode build it the same way).
enum FogShaders {
    static let source = """
        #include <metal_stdlib>
        using namespace metal;

        struct VOut {
            float4 position [[position]];
            float2 map;
        };

        // view[0] = (origin.x, origin.y, pixels per map unit, 0); view[1] = (width, height, 0, 0).
        vertex VOut fogVertex(uint vid [[vertex_id]], const device float2 *points [[buffer(0)]],
                              constant float4 *view [[buffer(1)]]) {
            float2 m = points[vid];
            float2 px = (m - view[0].xy) * view[0].z;
            VOut out;
            out.position = float4(px.x / view[1].x * 2 - 1, 1 - px.y / view[1].y * 2, 0, 1);
            out.map = m;
            return out;
        }

        struct FogOut {
            float remaining [[color(0)]];
            float seen [[color(1)]];
        };

        fragment float one(VOut in [[stage_in]]) { return 1; }

        fragment FogOut nothing(VOut in [[stage_in]]) {
            FogOut out;
            out.remaining = 0;
            out.seen = 0;
            return out;
        }

        // k = (base fog, explored clearing, 0, 0).
        fragment FogOut fogBase(VOut in [[stage_in]], texture2d<float> explored [[texture(0)]],
                                constant float4 &k [[buffer(0)]]) {
            float e = explored.read(uint2(in.position.xy)).r;
            FogOut out;
            out.remaining = k.x * (1 - k.y * e);
            out.seen = 0;
            return out;
        }

        // c[0] = (kind, centre.x, centre.y, radius); c[1] = (dim radius, value, dim clearing, 0).
        // Kinds: 0 a constant `value`; 1 TS vision (clear to 60% of `radius`, fading out at it);
        // 2 a light (clear to its bright radius, dim clearing to 90% of `dim radius`, fading out).
        fragment FogOut clearing(VOut in [[stage_in]], constant float4 *c [[buffer(0)]]) {
            int kind = int(c[0].x);
            float d = distance(in.map, c[0].yz);
            float k;
            if (kind == 0) {
                k = c[1].y;
            } else if (kind == 1) {
                float r = c[0].w;
                k = d <= 0.6 * r ? 1 : (d >= r ? 0 : (r - d) / (0.4 * r));
            } else {
                float dim = c[1].x;
                float dc = c[1].z;
                float t = d / dim;
                float edge = min(c[0].w / dim, 0.9);
                float e0 = max(0.0, edge - 0.02);
                if (t <= e0) {
                    k = 1;
                } else if (t <= edge) {
                    k = mix(1.0, dc, (t - e0) / max(edge - e0, 1e-6));
                } else if (t <= 0.9) {
                    k = dc;
                } else if (t <= 1) {
                    k = mix(dc, 0.0, (t - 0.9) / 0.1);
                } else {
                    k = 0;
                }
            }
            FogOut out;
            out.remaining = k;
            out.seen = k > 0 ? 1 : 0;
            return out;
        }

        // u[0] = (origin.x, origin.y, pixels per map unit, 0);
        // u[1] = (hatch period px, line width px, line alpha, hatching on).
        fragment float4 composite(VOut in [[stage_in]], texture2d<float> remaining [[texture(0)]],
                                  texture2d<float> seen [[texture(1)]], texture2d<float> explored [[texture(2)]],
                                  constant float4 *u [[buffer(0)]]) {
            uint2 p = uint2(in.position.xy);
            float a = remaining.read(p).r;
            float h = 0;
            if (u[1].w > 0 && a > 0.001 && explored.read(p).r > 0.5 && seen.read(p).r < 0.5) {
                // Diagonal lines anchored to the map, so they move with it when the camera pans.
                float s = (in.map.x + in.map.y) * u[0].z * 0.70710678;
                float period = u[1].x;
                float f = s - period * floor(s / period);
                float w = u[1].y * 0.5;
                h = (1 - smoothstep(w - 0.5, w + 0.5, abs(f - period * 0.5))) * u[1].z;
            }
            return float4(h, h, h, h + a * (1 - h));
        }
        """
}
