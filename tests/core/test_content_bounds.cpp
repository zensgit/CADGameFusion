// Unit tests for core::contentBounds — the real geometry content extent used by
// fitToContent and the render-service common-window upgrade. Pure geometry, no
// Qt: runs in the core-only (BUILD_EDITOR_QT=OFF) build.

#include "core/bounds.hpp"
#include "core/document.hpp"
#include "core/geometry2d.hpp"

#include <cassert>
#include <cmath>

// M_PI is not defined by MSVC without _USE_MATH_DEFINES; use a portable literal.
static constexpr double kHalfPi = 1.57079632679489661923;

static bool approx(double a, double b, double eps = 1e-6) {
    return std::fabs(a - b) < eps;
}

int main() {
    double x0, y0, x1, y1;

    // Empty document -> no bounds.
    {
        core::Document d;
        assert(!core::contentBounds(d, x0, y0, x1, y1));
    }

    // Only a Point -> no bounds (Points carry no rendered ink).
    {
        core::Document d;
        d.add_point(core::Vec2{5, 5}, "p");
        assert(!core::contentBounds(d, x0, y0, x1, y1));
    }

    // Polyline: exact vertex extent.
    {
        core::Document d;
        core::Polyline pl;
        pl.points = {{0, 0}, {10, 0}, {10, 4}, {0, 0}};
        d.add_polyline(pl, "pl");
        assert(core::contentBounds(d, x0, y0, x1, y1));
        assert(approx(x0, 0) && approx(y0, 0) && approx(x1, 10) && approx(y1, 4));
    }

    // Circle: center +/- radius.
    {
        core::Document d;
        core::Circle c{};
        c.center = {1, 2};
        c.radius = 5;
        d.add_circle(c, "c");
        assert(core::contentBounds(d, x0, y0, x1, y1));
        assert(approx(x0, -4) && approx(y0, -3) && approx(x1, 6) && approx(y1, 7));
    }

    // Ellipse axis-aligned: center +/- (rx, ry).
    {
        core::Document d;
        core::Ellipse e{};
        e.center = {0, 0};
        e.rx = 4;
        e.ry = 2;
        e.rotation = 0;
        d.add_ellipse(e, "e");
        assert(core::contentBounds(d, x0, y0, x1, y1));
        assert(approx(x0, -4) && approx(y0, -2) && approx(x1, 4) && approx(y1, 2));
    }

    // Ellipse rotated 90deg: x/y half-extents swap.
    {
        core::Document d;
        core::Ellipse e{};
        e.center = {0, 0};
        e.rx = 4;
        e.ry = 2;
        e.rotation = kHalfPi;
        d.add_ellipse(e, "e");
        assert(core::contentBounds(d, x0, y0, x1, y1));
        assert(approx(x0, -2) && approx(y0, -4) && approx(x1, 2) && approx(y1, 4));
    }

    // Text (rotation 0): box CONTAINS pos, over-covers width, stays short in y.
    {
        core::Document d;
        core::Text t{};
        t.pos = {0, 0};
        t.height = 2;
        t.rotation = 0;
        t.text = "ABCD";  // width est = 0.7*2*4 = 5.6
        d.add_text(t, "t");
        assert(core::contentBounds(d, x0, y0, x1, y1));
        assert(x0 <= 0 && y0 <= 0 && x1 >= 0 && y1 >= 0);  // contains pos
        assert(x1 >= 5.0);                                  // width over-covered
        assert(y1 < x1);                                    // not inflated to width in y
    }

    // Union across entities (incl. a far one): bounds span all geometry.
    {
        core::Document d;
        core::Circle c{};
        c.center = {0, 0};
        c.radius = 1;
        d.add_circle(c, "c");
        core::Polyline pl;
        pl.points = {{100, 100}};
        d.add_polyline(pl, "pl");
        assert(core::contentBounds(d, x0, y0, x1, y1));
        assert(approx(x0, -1) && approx(y0, -1) && approx(x1, 100) && approx(y1, 100));
    }

    return 0;
}
