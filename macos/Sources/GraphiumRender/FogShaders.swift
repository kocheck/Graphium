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
            float warmth [[color(2)]];
        };

        fragment float one(VOut in [[stage_in]]) { return 1; }

        fragment FogOut nothing(VOut in [[stage_in]]) {
            FogOut out;
            out.remaining = 0;
            out.seen = 0;
            out.warmth = 0;
            return out;
        }

        // k = (base fog, explored clearing, 0, 0).
        fragment FogOut fogBase(VOut in [[stage_in]], texture2d<float> explored [[texture(0)]],
                                constant float4 &k [[buffer(0)]]) {
            float e = explored.read(uint2(in.position.xy)).r;
            FogOut out;
            out.remaining = k.x * (1 - k.y * e);
            out.seen = 0;
            out.warmth = 0;
            return out;
        }

        // c[0] = (kind, centre.x, centre.y, radius); c[1] = (dim radius, value, dim clearing, glow).
        // Kinds: 0 a constant `value`; 1 TS vision (clear to 60% of `radius`, fading out at it);
        // 2 a light (clear to its bright radius, dim clearing to 90% of `dim radius`, fading out),
        // with a warm glow of strength `glow` at the centre fading to nothing at the dim radius.
        fragment FogOut clearing(VOut in [[stage_in]], constant float4 *c [[buffer(0)]]) {
            int kind = int(c[0].x);
            float d = distance(in.map, c[0].yz);
            float k;
            float warmth = 0;
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
                float f = saturate(1 - t);
                warmth = c[1].w * f * f;
            }
            FogOut out;
            out.remaining = k;
            out.seen = k > 0 ? 1 : 0;
            out.warmth = warmth;
            return out;
        }

        // Wall hatching mask. Each known wall piece is a quad; `seg` is the piece (a.xy, b.xy).
        struct BandOut {
            float4 position [[position]];
            float2 map;
            float4 seg [[flat]];
        };

        vertex BandOut bandVertex(uint vid [[vertex_id]], const device float2 *points [[buffer(0)]],
                                  constant float4 *view [[buffer(1)]], const device float4 *segs [[buffer(2)]]) {
            float2 m = points[vid];
            float2 px = (m - view[0].xy) * view[0].z;
            BandOut out;
            out.position = float4(px.x / view[1].x * 2 - 1, 1 - px.y / view[1].y * 2, 0, 1);
            out.map = m;
            out.seg = segs[vid];
            return out;
        }

        // u[0] = (origin.x, origin.y, pixels per map unit, 0); u[1] = (band width, nudge, view w, view h),
        // both in map units. Writes 1 − distance / band width, but only on the side of the wall
        // away from ground the party has explored or sees: the far side, mirrored across the
        // wall and `nudge` further, must be known. So a wall nobody has seen draws nothing.
        fragment float band(BandOut in [[stage_in]], texture2d<float> explored [[texture(0)]],
                            texture2d<float> seen [[texture(1)]], constant float4 *u [[buffer(0)]]) {
            float2 a = in.seg.xy;
            float2 b = in.seg.zw;
            float2 ab = b - a;
            float len2 = max(dot(ab, ab), 1e-6);
            float t = clamp(dot(in.map - a, ab) / len2, 0.0, 1.0);
            float2 foot = a + t * ab;
            float d = distance(in.map, foot);
            float width = u[1].x;
            if (d >= width) { return 0; }
            float2 normal = normalize(float2(-ab.y, ab.x));
            float2 away = d > 1e-3 ? (foot - in.map) / d : normal;
            float known = 0;
            for (int side = 0; side < (d > 1e-3 ? 1 : 2); side++) {
                float2 dir = side == 0 ? away : -away;
                float2 far = foot + dir * (d + u[1].y);
                float2 px = (far - u[0].xy) * u[0].z;
                if (px.x < 0 || px.y < 0 || px.x >= u[1].z || px.y >= u[1].w) { continue; }
                uint2 q = uint2(px);
                known = max(known, max(explored.read(q).r, seen.read(q).r));
            }
            return known > 0.5 ? 1 - d / width : 0;
        }

        float2 hash2(float2 p) {
            p = float2(dot(p, float2(127.1, 311.7)), dot(p, float2(269.5, 183.3)));
            return fract(sin(p) * 43758.5453);
        }

        // Ink (0…1) of Dyson-style rock hatching at map point `m`: Voronoi patches of `patch`
        // map units, each of parallel lines at its own angle, a sliver of paper between
        // patches. Returns the patch's reach as a fraction of the band in `.y`, so the band's
        // outer edge is ragged patch by patch. h = (patch, line period, line width, gap), map units.
        float2 rockHatch(float2 m, float4 h, float pixel) {
            float2 cell = floor(m / h.x);
            float2 f = m / h.x - cell;
            float f1 = 8, f2 = 8;
            float2 id = cell;
            for (int y = -1; y <= 1; y++) {
                for (int x = -1; x <= 1; x++) {
                    float2 g = float2(x, y);
                    float2 o = hash2(cell + g);
                    float dist = length(g + o - f);
                    if (dist < f1) {
                        f2 = f1;
                        f1 = dist;
                        id = cell + g;
                    } else if (dist < f2) {
                        f2 = dist;
                    }
                }
            }
            float2 r = hash2(id + 17.0);
            float angle = r.x * 3.14159265;
            float s = dot(m, float2(cos(angle), sin(angle))) / h.y + r.y;
            float across = abs(fract(s) - 0.5) * h.y;
            float half_w = h.z * 0.5;
            float ink = 1 - smoothstep(half_w - pixel * 0.5, half_w + pixel * 0.5, across);
            float edge = (f2 - f1) * h.x;
            ink *= smoothstep(h.w - pixel * 0.5, h.w + pixel * 0.5, edge);
            return float2(ink, 0.55 + 0.45 * hash2(id + 41.0).x);
        }

        // u[0] = (origin.x, origin.y, pixels per map unit, 0);
        // u[1] = (hatch period px, line width px, line alpha, hatching on);
        // u[2] = (glow r, g, b, wall hatching on);
        // u[3] = (band width, wall ink half width, paper, 0), map units;
        // u[4] = rock hatch (patch, line period, line width, gap), map units.
        fragment float4 composite(VOut in [[stage_in]], texture2d<float> remaining [[texture(0)]],
                                  texture2d<float> seen [[texture(1)]], texture2d<float> explored [[texture(2)]],
                                  texture2d<float> warmth [[texture(3)]], texture2d<float> band [[texture(4)]],
                                  constant float4 *u [[buffer(0)]]) {
            uint2 p = uint2(in.position.xy);
            float a = remaining.read(p).r;
            float e = explored.read(p).r;
            float s = seen.read(p).r;
            float pixel = 1 / u[0].z;
            if (u[2].w > 0 && a > 0.5 && e < 0.5 && s < 0.5) {
                float v = band.read(p).r;
                if (v > 0) {
                    float d = (1 - v) * u[3].x;
                    float2 rock = rockHatch(in.map, u[4], pixel);
                    float wall = 1 - smoothstep(u[3].y - pixel, u[3].y + pixel, d);
                    float reach = 1 - smoothstep(rock.y * u[3].x - pixel, rock.y * u[3].x + pixel, d);
                    float ink = max(wall, rock.x * reach);
                    float paper = max(reach, wall);
                    // Paper with ink on it, fading back to the black of the unknown past the band.
                    float3 rgb = float3(u[3].z * (1 - ink)) * paper;
                    return float4(rgb, 1);
                }
            }
            float w = warmth.read(p).r;
            float3 rgb = u[2].rgb * w * (1 - a);
            float alpha = a + w * (1 - a);
            float h = 0;
            if (u[1].w > 0 && a > 0.001 && e > 0.5 && s < 0.5) {
                // Diagonal lines anchored to the map, so they move with it when the camera pans.
                float l = (in.map.x + in.map.y) * u[0].z * 0.70710678;
                float period = u[1].x;
                float f = l - period * floor(l / period);
                float lw = u[1].y * 0.5;
                h = (1 - smoothstep(lw - 0.5, lw + 0.5, abs(f - period * 0.5))) * u[1].z;
            }
            return float4(rgb * (1 - h) + h, h + alpha * (1 - h));
        }
        """
}
