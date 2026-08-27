import Foundation

// Compiled at launch with makeLibrary(source:), so the build stays a single
// swiftc invocation with no metallib step.
let shaderSource = """
#include <metal_stdlib>
using namespace metal;

struct VOut { float4 pos [[position]]; float2 uv; };

vertex VOut v_main(uint vid [[vertex_id]]) {
    // One full-viewport triangle. Cheaper than a quad and avoids the seam.
    float2 p = float2((vid << 1) & 2, vid & 2);
    VOut o;
    o.pos = float4(p * 2.0 - 1.0, 0.0, 1.0);
    o.uv  = float2(p.x, 1.0 - p.y);
    return o;
}

struct Uniforms {
    float2 size;        // points
    float  progress;    // 0...1, already eased by the host
    float  time;        // seconds, for the sheen
    float4 accent;
    float4 track;
    float  indeterminate;
    float  scale;       // backing scale, so the SDF stays crisp on any display
    float  inset;       // horizontal padding inside the status item
    float  barHeight;   // capsule height, in points
};

// Signed distance to a rounded box, in pixels.
float sdRoundedBox(float2 p, float2 halfSize, float r) {
    float2 q = abs(p) - halfSize + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

fragment float4 f_main(VOut in [[stage_in]], constant Uniforms& u [[buffer(0)]]) {
    // u.size is the whole status item. Carve the capsule out of its middle so
    // the bar's placement is decided here, not by AppKit subview layout.
    float2 view = in.uv * u.size;
    float2 barSize = float2(u.size.x - u.inset * 2.0, u.barHeight);
    float2 origin  = float2(u.inset, (u.size.y - u.barHeight) * 0.5);
    float2 px = view - origin;

    float2 c  = px - barSize * 0.5;
    float  h  = barSize.y * 0.5;
    float  r  = h;                                   // full capsule

    float d = sdRoundedBox(c, barSize * 0.5, r);
    // Antialias over one pixel of the backing store, not one point.
    float aa = 1.0 / u.scale;
    float shape = 1.0 - smoothstep(-aa, aa, d);
    if (shape <= 0.001) { return float4(0.0); }

    float4 col = u.track;

    if (u.indeterminate > 0.5) {
        // A soft pill travelling the length of the track.
        float head = fract(u.time * 0.55);
        float x = px.x / barSize.x;
        float band = exp(-pow((x - head) * 3.2, 2.0) * 6.0)
                   + exp(-pow((x - head + 1.0) * 3.2, 2.0) * 6.0);
        col = mix(u.track, u.accent, clamp(band, 0.0, 1.0) * 0.9);
    } else {
        float edge = u.progress * barSize.x;
        float fill = 1.0 - smoothstep(edge - aa, edge + aa, px.x);
        float4 base = u.accent;

        // Vertical shading: a touch lighter at the top, so the capsule reads as
        // a physical object rather than a flat rectangle.
        float vgrad = mix(1.08, 0.92, clamp(px.y / barSize.y, 0.0, 1.0));
        base.rgb *= vgrad;

        // Sheen: one narrow highlight drifting through the filled region.
        float sheenPos = fract(u.time * 0.28);
        float sheen = exp(-pow((px.x / barSize.x - sheenPos) * 9.0, 2.0));
        base.rgb += sheen * 0.18 * fill;

        // Leading edge catches a little more light.
        float tip = exp(-pow((px.x - edge) / max(h * 0.9, 1.0), 2.0));
        base.rgb += tip * 0.22 * fill;

        col = mix(u.track, base, fill);
    }

    // The pipeline blends with .one / .oneMinusSourceAlpha, so colour has to
    // leave here premultiplied. Returning straight rgb made the 35%-alpha
    // track paint as solid white.
    return float4(col.rgb * col.a, col.a) * shape;
}
"""
