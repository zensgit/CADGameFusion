#pragma once

// Shared renderer for imported document content (DXF/DWG drawings).
// Both the interactive editor canvas (CanvasWidget) and headless outputs
// (render_cli → PNG/SVG) draw through renderScene(), so on-screen display
// and exported images stay pixel-identical. The AutoCAD-fidelity behavior
// verified against reference screenshots lives here — keep changes to the
// drawing logic backend-agnostic.

#include <QColor>
#include <QPainterPath>
#include <QPointF>
#include <QRectF>
#include <QSet>
#include <QSize>
#include <QString>
#include <QVector>

#include <cstdint>
#include <map>
#include <string>
#include <vector>

#include "core/document.hpp"

class QPainter;

namespace scene_render {

using EntityId = uint64_t; // Mirror core::EntityId

// Cached drawable form of a core::Polyline entity.
struct PolyVis {
    QVector<QPointF> pts;
    EntityId entityId{0}; // 0 = not bound to a Document entity
    // Cache
    QPainterPath cachePath;
    QRectF aabb;
};

// View mapping: screenX = worldX*scale + pan.x; screenY = worldY*(-scale) + pan.y
struct View {
    double scale{1.0};      // pixels per world unit
    QPointF pan{0.0, 0.0};  // pixels
    bool hasClip{false};    // clip content to drawing extents (DXF EXTMIN/EXTMAX)
    double clipMinX{0}, clipMinY{0}, clipMaxX{0}, clipMaxY{0};
    // Light-background mode (B4): on a white/light canvas, near-white entity
    // colors (ACI 7, the near-white default) are drawn black — AutoCAD's
    // color-7 / background-relative convention. Editor (dark canvas) leaves
    // this false; render_cli sets it when --bg is light.
    bool lightBackground{false};
};

// Real DXF linetype patterns from the importer (dash/gap lengths in drawing
// units) plus the drawing's global LTSCALE.
struct LinetypeTable {
    std::map<std::string, std::vector<double>> patterns;
    double ltScale{1.0};
};

QPointF worldToScreen(const View& view, const QPointF& p);

// Rebuild the cached path/aabb of a PolyVis after its pts changed.
void updatePolyCache(PolyVis& pv);
// Build the polyline draw cache for every Polyline entity in the document.
QVector<PolyVis> buildPolyCache(const core::Document& doc);

bool isEntityVisible(const core::Document* doc, const core::Entity& entity);
QColor resolveEntityColor(const core::Document* doc, const core::Entity& entity,
                          bool flipWhiteOnLight = false);
QVector<qreal> linetypeDashPattern(const std::string& lt, double scale,
                                   const LinetypeTable& linetypes);

// Semantic render classes for diagnostic mask buffers. These are renderer-side
// classes for the ink we actually draw, not AutoCAD reference truth.
std::vector<std::string> semanticClassOrder();
uint32_t semanticClassRgb(const std::string& name);
std::string semanticClassName(const core::Document* doc, const core::Entity& entity);

// Best-available FangSong/song-style CJK family for empty-style (SHX) text.
// AutoCAD draws such Chinese mechanical text in a 仿宋 style; the macOS family
// (STFangsong) is absent on the Linux render host, so pick the closest installed
// song family (e.g. Noto Serif CJK SC) rather than letting Qt fall back to a sans
// (DejaVu Sans → Noto Sans CJK). Resolved once against the live font DB.
QString defaultTextFamily();
// Best-available 楷体 (kai) family for explicit STKaiti, and 黑体 (CJK sans) family
// for explicit STHeiti — the macOS-only families the importer bakes for those
// explicit styles. Same host-probe as defaultTextFamily(), typeface-class-correct.
QString defaultKaiFamily();
QString defaultSansFamily();
// Normalize an importer/style-provided family into the family renderScene will
// actually request. Empty/default SHX text and platform-specific missing
// defaults (notably STFangsong outside macOS) resolve to defaultTextFamily().
QString resolveTextFamily(const QString& family);

// Fit the world rect [mnx..mxx]×[mny..mxy] into the viewport. Same formula as
// the editor's zoom-to-extents (5% margin, 0.9 factor). False on degenerate
// extents (width/height < 1 world unit).
bool fitToExtents(const QSize& viewport, double mnx, double mny,
                  double mxx, double mxy, View* out);
// Fit all document content into the viewport. Same formula as the editor's
// zoom-to-fit (bbox over polyline points + text positions, 3% margin).
bool fitToContent(const core::Document& doc, const QSize& viewport, View* out);

// Draw the document content (texts, ellipses, polylines incl. __SOLID__ fills
// and __HATCH_FILL__ hairlines) into `pr`. The painter must be passed in its
// default (identity-transform) state; all transform/clip state is restored
// before returning. `selection` draws the editor highlight; pass nullptr for
// headless rendering.
void renderScene(QPainter& pr, const core::Document* doc,
                 const QVector<PolyVis>& polylines, const View& view,
                 const LinetypeTable& linetypes,
                 const QSet<EntityId>* selection = nullptr,
                 bool semanticClassMask = false);

} // namespace scene_render
