#pragma once
// SHX stroke font renderer: converts romans.shx shape commands to line segments.
#include "shx_romans_data.hpp"
#include <vector>
#include <string>
#include <cmath>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace shx {

struct Seg { double x1, y1, x2, y2; };

// Execute SHX shape commands, return advance width in design units.
inline double renderChar(const int8_t* data, int len,
    std::vector<Seg>& out, double ox, double oy,
    double sc, double cosR, double sinR)
{
    double x = 0, y = 0, scale = 1.0;
    bool pen = false;
    double px = 0, py = 0;
    double stk[8][2]; int sp = 0;

    auto xf = [&](double lx, double ly, double& wx, double& wy) {
        double s = sc / shx_data::kAbove;
        wx = ox + (lx * scale * s * cosR - ly * scale * s * sinR);
        wy = oy + (lx * scale * s * sinR + ly * scale * s * cosR);
    };
    auto moveTo = [&](double nx, double ny) {
        if (pen) {
            double wx1, wy1, wx2, wy2;
            xf(px, py, wx1, wy1); xf(nx, ny, wx2, wy2);
            out.push_back({wx1, wy1, wx2, wy2});
        }
        px = nx; py = ny;
    };

    int i = 0;
    auto skipCmd = [&]() {
        if (i >= len) return;
        int c = data[i] & 0xFF; i++;
        if (c == 8) i += 2;
        else if (c == 9) { while (i+1<len) { if (data[i]==0 && data[i+1]==0) { i+=2; break; } i+=2; } }
        else if (c==10||c==12||c==13) i+=2;
        else if (c==11) i+=5;
        else if (c==3||c==4||c==7) i++;
    };

    while (i < len) {
        int r = data[i] & 0xFF;
        if (r == 0) break;
        else if (r == 1) { pen = true; px = x; py = y; i++; }
        else if (r == 2) { pen = false; i++; }
        else if (r == 3) { i++; int d = data[i]&0xFF; if(d>0) scale/=d; i++; }
        else if (r == 4) { i++; scale *= (data[i]&0xFF); i++; }
        else if (r == 5) { if(sp<8){stk[sp][0]=x;stk[sp][1]=y;sp++;} i++; }
        else if (r == 6) { if(sp>0){sp--;x=stk[sp][0];y=stk[sp][1];} i++; }
        else if (r == 7) { i+=2; }
        else if (r == 8) { i++; x+=data[i]; y+=data[i+1]; i+=2; moveTo(x,y); }
        else if (r == 9) {
            i++;
            while (i+1<len) {
                int dx=data[i], dy=data[i+1]; i+=2;
                if (dx==0 && dy==0) break;
                x+=dx; y+=dy; moveTo(x,y);
            }
        }
        else if (r == 10) { i+=3; }
        else if (r == 11) { i+=6; }
        else if (r == 12) { i++; x+=data[i]; y+=data[i+1]; i+=3; moveTo(x,y); }
        else if (r == 13) { i+=3; }
        else if (r == 14) { i++; skipCmd(); }
        else { // direction vector
            i++;
            int length = (r>>4)&0xF, dir = r&0xF;
            double a = dir * M_PI / 8.0;
            x += length * std::cos(a); y += length * std::sin(a);
            moveTo(x, y);
        }
    }
    return x * scale;
}

// Render an ASCII string as SHX stroke segments.
// height: text height in drawing units. rotation: radians.
// Returns segments in world coordinates.
inline std::vector<Seg> renderText(const std::string& text, double height,
    double rotation, double ox, double oy)
{
    std::vector<Seg> segs;
    double cosR = std::cos(rotation), sinR = std::sin(rotation);
    double cursor = 0;
    double sc = height; // scale factor: height maps to kAbove design units

    for (unsigned char ch : text) {
        if (ch < 32 || ch > 126) { cursor += shx_data::kAbove; continue; }
        auto& ci = shx_data::kChars[ch - 32];
        if (ci.len == 0) { cursor += shx_data::kAbove; continue; }

        // Origin for this character: cursor offset along text direction
        double cx = ox + cursor * (sc / shx_data::kAbove) * cosR;
        double cy = oy + cursor * (sc / shx_data::kAbove) * sinR;

        double adv = renderChar(shx_data::kData + ci.off, ci.len,
                                segs, cx, cy, sc, cosR, sinR);
        cursor += adv;
    }
    return segs;
}

} // namespace shx
