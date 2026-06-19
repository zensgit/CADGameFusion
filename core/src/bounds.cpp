#include "core/bounds.hpp"

#include <cmath>
#include <variant>

namespace core {

namespace {

struct Acc {
    double mnx = 1e300, mny = 1e300;
    double mxx = -1e300, mxy = -1e300;
    bool any = false;
    void add(double x, double y) {
        if (x < mnx) mnx = x;
        if (y < mny) mny = y;
        if (x > mxx) mxx = x;
        if (y > mxy) mxy = y;
        any = true;
    }
};

// Over-estimate a text glyph box and bound its (rotated) rectangle's corners.
// width ~ 0.7*height per byte (>= per glyph: DXF default width factor < 1, and
// multibyte CJK counts >= 1 glyph), height ~ height with small descender/anchor
// margins. Over-covers (never clips); exact width is a render-layer follow-up.
void addText(Acc& a, const Text& t) {
    const double h = std::fabs(t.height);
    if (h <= 0.0) { a.add(t.pos.x, t.pos.y); return; }
    const double w = 0.7 * h * static_cast<double>(t.text.size());
    const double c = std::cos(t.rotation), s = std::sin(t.rotation);
    const double xs[2] = {-0.15 * h, w + 0.15 * h};
    const double ys[2] = {-0.30 * h, h + 0.15 * h};
    for (double lx : xs)
        for (double ly : ys)
            a.add(t.pos.x + lx * c - ly * s,
                  t.pos.y + lx * s + ly * c);
}

// Rotated full-ellipse AABB half-extents (over-covers elliptical arcs).
void addEllipse(Acc& a, const Ellipse& e) {
    const double c = std::cos(e.rotation), s = std::sin(e.rotation);
    const double hx = std::sqrt((e.rx * c) * (e.rx * c) + (e.ry * s) * (e.ry * s));
    const double hy = std::sqrt((e.rx * s) * (e.rx * s) + (e.ry * c) * (e.ry * c));
    a.add(e.center.x - hx, e.center.y - hy);
    a.add(e.center.x + hx, e.center.y + hy);
}

}  // namespace

bool contentBounds(const Document& doc,
                   double& minX, double& minY, double& maxX, double& maxY) {
    Acc a;
    for (const auto& e : doc.entities()) {
        if (auto* pl = std::get_if<Polyline>(&e.payload)) {
            for (const auto& p : pl->points) a.add(p.x, p.y);
        } else if (auto* ln = std::get_if<Line>(&e.payload)) {
            a.add(ln->a.x, ln->a.y);
            a.add(ln->b.x, ln->b.y);
        } else if (auto* ci = std::get_if<Circle>(&e.payload)) {
            a.add(ci->center.x - ci->radius, ci->center.y - ci->radius);
            a.add(ci->center.x + ci->radius, ci->center.y + ci->radius);
        } else if (auto* ar = std::get_if<Arc>(&e.payload)) {
            // Over-cover: an arc lies within its full circle.
            a.add(ar->center.x - ar->radius, ar->center.y - ar->radius);
            a.add(ar->center.x + ar->radius, ar->center.y + ar->radius);
        } else if (auto* el = std::get_if<Ellipse>(&e.payload)) {
            addEllipse(a, *el);
        } else if (auto* sp = std::get_if<Spline>(&e.payload)) {
            for (const auto& p : sp->control_points) a.add(p.x, p.y);
        } else if (auto* tx = std::get_if<Text>(&e.payload)) {
            addText(a, *tx);
        } else if (auto* bi = std::get_if<BlockInstance>(&e.payload)) {
            a.add(bi->insertionPoint.x, bi->insertionPoint.y);
        }
        // Point and std::monostate: intentionally not bounded (no rendered ink).
    }
    if (!a.any) return false;
    minX = a.mnx;
    minY = a.mny;
    maxX = a.mxx;
    maxY = a.mxy;
    return true;
}

}  // namespace core
