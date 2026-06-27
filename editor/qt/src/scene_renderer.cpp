#include "scene_renderer.hpp"

#include "core/bounds.hpp"

#include <QFont>
#include <QFontInfo>
#include <QFontMetricsF>
#include <QPainter>
#include <QPen>
#include <QStringList>
#include <QTransform>
#include <QtGlobal>

#include <cmath>
#include <cstdlib>
#include <vector>

namespace scene_render {

namespace {

bool familyContainsAny(const QString& folded, const QStringList& tokens) {
    for (const QString& tok : tokens) {
        if (folded.contains(tok.toCaseFolded())) return true;
    }
    return false;
}

bool isSansFallbackFamily(const QString& family) {
    const QString folded = family.toCaseFolded();
    return folded.contains(QStringLiteral("dejavu sans")) ||
           folded.contains(QStringLiteral("noto sans")) ||
           folded.contains(QStringLiteral("helvetica")) ||
           folded.contains(QStringLiteral("applesystem")) ||
           folded == QStringLiteral("sans serif");
}

bool isSongLikeCjkRequest(const QString& family) {
    const QString folded = family.toCaseFolded();
    return familyContainsAny(folded, {
        QStringLiteral("serif"),
        QStringLiteral("song"),
        QStringLiteral("fang"),
        QStringLiteral("仿宋"),
        QStringLiteral("宋"),
        QStringLiteral("zhuque")
    });
}

bool resolvesToSansFallback(const QString& family, QFont::StyleHint hint = QFont::Serif) {
    QFont probe(family);
    probe.setStyleHint(hint);
    return isSansFallbackFamily(QFontInfo(probe).family());
}

} // namespace

// Best-available FangSong/song-style CJK family for empty-style text (see header).
// Ordered by closeness to AutoCAD's 仿宋. Trust Qt's actual QFontInfo resolution,
// not just QFontDatabase::families(): headless fontconfig can omit a family from
// the list while still resolving it, and aliases can also resolve to a generic
// UI/sans fallback. On the Linux render host this picks Zhuque Fangsong (the authentic
// 仿宋) when the OFL font is bundled (VemCAD render-image), else Noto Serif CJK SC
// (song) — never the silent DejaVu Sans → Noto Sans CJK fallback. Resolved
// once — render_cli loads --font-dir before first use.
QString defaultTextFamily() {
    static const QString fam = [] {
        const QStringList prefer = {
#if defined(Q_OS_MACOS)
            QStringLiteral("STFangsong"),          // macOS 华文仿宋 (editor parity)
            QStringLiteral("Zhuque Fangsong (technical preview)"),
            QStringLiteral("朱雀仿宋（预览测试版）"),
            QStringLiteral("Zhuque Fangsong"),     // 朱雀仿宋 (bundled OFL, if present)
            QStringLiteral("Noto Serif CJK SC"),
#elif defined(Q_OS_WIN)
            QStringLiteral("FangSong"),            // Windows / generic
            QStringLiteral("仿宋"),        // 仿宋
            QStringLiteral("Noto Serif CJK SC"),
            QStringLiteral("Zhuque Fangsong (technical preview)"),
            QStringLiteral("朱雀仿宋（预览测试版）"),
            QStringLiteral("Zhuque Fangsong"),
#else
            // The bundled OFL file advertises this full family name. Requesting
            // the short alias "Zhuque Fangsong" can resolve to DejaVu Sans on
            // headless Linux, so probe the real family name first.
            QStringLiteral("Zhuque Fangsong (technical preview)"),
            QStringLiteral("朱雀仿宋（预览测试版）"),
            QStringLiteral("Zhuque Fangsong"),     // legacy/alias spelling
            QStringLiteral("Noto Serif CJK SC"),   // render-image Linux host (fonts-noto-cjk) — guaranteed song fallback
            QStringLiteral("Source Han Serif SC"),
            QStringLiteral("Noto Serif CJK TC"),
            QStringLiteral("FangSong"),
            QStringLiteral("仿宋"),
            QStringLiteral("STFangsong"),
#endif
            QStringLiteral("LXGW WenKai"),         // 霞鹜文楷 (kai; song-ish, still > sans)
        };

        const QStringList acceptableResolvedTokens = {
            QStringLiteral("serif"),
            QStringLiteral("song"),
            QStringLiteral("fang"),
            QStringLiteral("仿宋"),
            QStringLiteral("朱雀"),
            QStringLiteral("stfang"),
            QStringLiteral("zhuque"),
            QStringLiteral("lxgw")
        };
        for (const QString& f : prefer) {
            QFont probe(f);
            probe.setStyleHint(QFont::Serif);
            const QString resolved = QFontInfo(probe).family();
            const QString folded = resolved.toCaseFolded();
            if (folded.isEmpty()) continue;
            if (isSansFallbackFamily(resolved)) continue;
            for (const QString& tok : acceptableResolvedTokens) {
                if (folded.contains(tok.toCaseFolded())) return f;
            }
        }
        // Last resort for headless render hosts: the VemCAD render image
        // installs fonts-noto-cjk, and the VemCAD golden gate now fails if
        // this still resolves to a sans fallback. Real macOS STFangsong (when
        // installed) has already been selected by the QFontInfo probe above.
        return QStringLiteral("Noto Serif CJK SC");
    }();
    return fam;
}

// Best-available 楷体 (kai) family for explicit STKaiti text (importer-baked,
// macOS-only). Prefers the bundled LXGW WenKai (霞鹜文楷); falls back to a CJK
// serif (kai is closer to serif than to sans) so a kai request never lands on
// DejaVu Sans on a Linux render host. Mirrors defaultTextFamily()'s host-probe.
QString defaultKaiFamily() {
    static const QString fam = [] {
        const QStringList prefer = {
#if defined(Q_OS_MACOS)
            QStringLiteral("STKaiti"),
            QStringLiteral("Kaiti SC"),
            QStringLiteral("LXGW WenKai"),
#elif defined(Q_OS_WIN)
            QStringLiteral("KaiTi"),
            QStringLiteral("楷体"),
            QStringLiteral("LXGW WenKai"),
            QStringLiteral("Noto Serif CJK SC"),
#else
            QStringLiteral("LXGW WenKai"),         // 霞鹜文楷 (bundled OFL kai)
            QStringLiteral("Noto Serif CJK SC"),   // CJK serif fallback (no Noto kai)
            QStringLiteral("Source Han Serif SC"),
#endif
        };
        const QStringList acceptable = {
            QStringLiteral("lxgw"), QStringLiteral("wenkai"), QStringLiteral("kai"),
            QStringLiteral("楷"), QStringLiteral("serif"), QStringLiteral("song"),
        };
        for (const QString& f : prefer) {
            QFont probe(f);
            probe.setStyleHint(QFont::Serif);
            const QString folded = QFontInfo(probe).family().toCaseFolded();
            if (folded.isEmpty()) continue;
            if (isSansFallbackFamily(folded)) continue;
            for (const QString& tok : acceptable) {
                if (folded.contains(tok.toCaseFolded())) return f;
            }
        }
        return QStringLiteral("Noto Serif CJK SC");
    }();
    return fam;
}

// Best-available 黑体 (hei / CJK sans) family for explicit STHeiti text. Prefers
// Noto Sans CJK SC (always present in the render image via fonts-noto-cjk); a hei
// request must land on a CJK sans — never DejaVu Sans (Latin) or a serif.
QString defaultSansFamily() {
    static const QString fam = [] {
        const QStringList prefer = {
#if defined(Q_OS_MACOS)
            QStringLiteral("STHeiti"),
            QStringLiteral("PingFang SC"),
            QStringLiteral("Noto Sans CJK SC"),
#elif defined(Q_OS_WIN)
            QStringLiteral("SimHei"),
            QStringLiteral("黑体"),
            QStringLiteral("Microsoft YaHei"),
            QStringLiteral("Noto Sans CJK SC"),
#else
            QStringLiteral("Noto Sans CJK SC"),    // render-image Linux (fonts-noto-cjk)
            QStringLiteral("Source Han Sans SC"),
            QStringLiteral("Noto Sans CJK TC"),
#endif
        };
        // Must be a CJK sans: require a CJK marker; reject Latin sans (DejaVu/Helvetica).
        const QStringList acceptable = {
            QStringLiteral("cjk"), QStringLiteral("source han sans"),
            QStringLiteral("pingfang"), QStringLiteral("yahei"),
            QStringLiteral("黑"), QStringLiteral("heiti"),
        };
        for (const QString& f : prefer) {
            QFont probe(f);
            probe.setStyleHint(QFont::SansSerif);
            const QString folded = QFontInfo(probe).family().toCaseFolded();
            if (folded.isEmpty()) continue;
            if (folded.contains(QStringLiteral("dejavu")) ||
                folded.contains(QStringLiteral("helvetica")) ||
                folded.contains(QStringLiteral("applesystem")) ||
                folded == QStringLiteral("sans serif")) {
                continue;
            }
            for (const QString& tok : acceptable) {
                if (folded.contains(tok.toCaseFolded())) return f;
            }
        }
        return QStringLiteral("Noto Sans CJK SC");
    }();
    return fam;
}

QString resolveTextFamily(const QString& family) {
    const QString fam = family.trimmed();
    if (fam.isEmpty()) return defaultTextFamily();

    const QString folded = fam.toCaseFolded();
#if !defined(Q_OS_MACOS)
    // The DXF importer (resolveFontFamily) bakes macOS-only CJK family names for
    // both empty-style (STFangsong) and explicit styles (STSong/STKaiti/STHeiti).
    // On Linux/Windows render hosts those families are usually absent; requesting
    // them lets Qt pick a Latin sans primary face (DejaVu Sans on Linux) and merge
    // CJK glyphs. Remap each to a portable, typeface-class-correct host family:
    //   song/仿宋 (STFangsong/STSong) → defaultTextFamily()  [CJK serif]
    //   楷 (STKaiti)                  → defaultKaiFamily()    [LXGW WenKai / serif]
    //   黑/sans (STHeiti)             → defaultSansFamily()   [Noto Sans CJK SC]
    // macOS keeps the real families (this block is skipped there). This is the
    // render-layer home of the VemCAD fontconfig alias — so the image-side alias
    // is no longer needed for any of them.
    if (folded == QStringLiteral("stfangsong")) return defaultTextFamily();
    if (folded == QStringLiteral("stsong")) return defaultTextFamily();
    if (folded == QStringLiteral("stkaiti")) return defaultKaiFamily();
    if (folded == QStringLiteral("stheiti")) return defaultSansFamily();
    if (isSongLikeCjkRequest(fam) && resolvesToSansFallback(fam, QFont::Serif)) {
        return defaultTextFamily();
    }
#endif
    if (folded == QStringLiteral("sans serif") ||
        folded.contains(QStringLiteral("dejavu sans")) ||
        folded.contains(QStringLiteral("helvetica")) ||
        folded.contains(QStringLiteral("applesystem"))) {
        return defaultTextFamily();
    }
    return fam;
}

namespace {

uint32_t aci_to_rgb(int aci) {
    if (aci <= 0 || aci > 255) return 0xFFFFFFu;
    // ACI 1-9: standard primary colors
    static const uint32_t std9[9] = {
        0xFF0000u, 0xFFFF00u, 0x00FF00u, 0x00FFFFu, 0x0000FFu,
        0xFF00FFu, 0xFFFFFFu, 0x808080u, 0xC0C0C0u
    };
    if (aci <= 9) return std9[aci - 1];
    // ACI 250-255: specific grays
    if (aci >= 250) {
        static const uint32_t grays[6] = {
            0x333333u, 0x5B5B5Bu, 0x828282u, 0xAAAAAAu, 0xD2D2D2u, 0xFFFFFFu
        };
        return grays[aci - 250];
    }
    // ACI 10-249: 24 hue groups × 10 shades (HSV-based)
    int idx       = aci - 10;
    int hue_group = idx / 10;
    int shade     = idx % 10;
    static const float V_levels[5] = {1.0f, 0.74f, 0.51f, 0.41f, 0.31f};
    float V = V_levels[shade / 2];
    float S = (shade % 2 == 0) ? 1.0f : 0.33f;
    float hue = static_cast<float>(hue_group) * 15.0f;
    float h6  = hue / 60.0f;
    float C   = V * S;
    float X   = C * (1.0f - std::fabs(std::fmod(h6, 2.0f) - 1.0f));
    float m_v = V - C;
    float r, g, b;
    switch (static_cast<int>(h6) % 6) {
        case 0: r=C; g=X; b=0; break;
        case 1: r=X; g=C; b=0; break;
        case 2: r=0; g=C; b=X; break;
        case 3: r=0; g=X; b=C; break;
        case 4: r=X; g=0; b=C; break;
        default: r=C; g=0; b=X; break;
    }
    auto u8 = [](float v) { return static_cast<uint32_t>(std::min(255.0f, (v + 0.002f) * 255.0f)); };
    return (u8(r+m_v) << 16) | (u8(g+m_v) << 8) | u8(b+m_v);
}

bool parse_int(const std::string& s, int* out) {
    if (!out) return false;
    char* end = nullptr;
    long v = std::strtol(s.c_str(), &end, 10);
    if (!end || *end != '\0') return false;
    *out = static_cast<int>(v);
    return true;
}

std::string lookup_entity_meta(const core::Document* doc, EntityId id, const char* suffix) {
    if (!doc || id == 0 || !suffix || !*suffix) return {};
    const auto& meta = doc->metadata().meta;
    const std::string key = "dxf.entity." +
        std::to_string(static_cast<unsigned long long>(id)) + "." + suffix;
    const auto it = meta.find(key);
    if (it == meta.end()) return {};
    return it->second;
}

std::string lookup_layer_meta(const core::Document* doc, int layerId, const char* suffix) {
    if (!doc || layerId < 0 || !suffix || !*suffix) return {};
    const auto& meta = doc->metadata().meta;
    const std::string key = "dxf.layer." + std::to_string(layerId) + "." + suffix;
    const auto it = meta.find(key);
    if (it == meta.end()) return {};
    return it->second;
}

const core::Layer* layer_for(const core::Document* doc, int layerId) {
    if (!doc) return nullptr;
    return doc->get_layer(layerId);
}

QColor color_from_rgb(uint32_t rgb) {
    return QColor((rgb >> 16) & 0xFF, (rgb >> 8) & 0xFF, rgb & 0xFF);
}

} // namespace

QPointF worldToScreen(const View& view, const QPointF& p) {
    return QPointF(p.x() * view.scale + view.pan.x(), p.y() * (-view.scale) + view.pan.y());
}

void updatePolyCache(PolyVis& pv) {
    pv.cachePath = QPainterPath();
    if (pv.pts.size() < 2) {
        pv.aabb = QRectF();
        return;
    }
    pv.cachePath.moveTo(pv.pts[0]);
    for (int i = 1; i < pv.pts.size(); ++i) {
        pv.cachePath.lineTo(pv.pts[i]);
    }
    qreal minX = pv.pts[0].x(), maxX = minX;
    qreal minY = pv.pts[0].y(), maxY = minY;
    for (const auto& p : pv.pts) {
        if (p.x() < minX) minX = p.x();
        if (p.x() > maxX) maxX = p.x();
        if (p.y() < minY) minY = p.y();
        if (p.y() > maxY) maxY = p.y();
    }
    pv.aabb = QRectF(QPointF(minX, minY), QPointF(maxX, maxY));
}

QVector<PolyVis> buildPolyCache(const core::Document& doc) {
    QVector<PolyVis> out;
    for (const auto& e : doc.entities()) {
        if (e.type != core::EntityType::Polyline) continue;
        const auto* pl = std::get_if<core::Polyline>(&e.payload);
        if (!pl || pl->points.size() < 2) continue;

        PolyVis pv;
        pv.pts.reserve(static_cast<int>(pl->points.size()));
        for (const auto& pt : pl->points) {
            pv.pts.append(QPointF(pt.x, pt.y));
        }
        pv.entityId = e.id;
        updatePolyCache(pv);
        out.append(pv);
    }
    return out;
}

bool isEntityVisible(const core::Document* doc, const core::Entity& entity) {
    if (!entity.visible) return false;
    const auto* layer = layer_for(doc, entity.layerId);
    if (layer && !layer->visible) return false;
    return true;
}

// B4: on a light background, near-white colors are invisible — AutoCAD draws
// color-7 black on a light canvas. Flip only NEAR-WHITE ACHROMATIC colors
// (all channels high): pure white 0xFFFFFF and the near-white default
// 0xDCDCE6 flip to black; chromatic colors stay (a luminance test would
// wrongly flip saturated yellow 0xFFFF00, common in mechanical drawings).
static constexpr int kNearWhiteChannelMin = 0xDC; // 220 — 0xDCDCE6 just clears
static QColor finalize_color(uint32_t color, bool flipWhiteOnLight) {
    int r = (color >> 16) & 0xFF, g = (color >> 8) & 0xFF, b = color & 0xFF;
    if (flipWhiteOnLight && r >= kNearWhiteChannelMin
            && g >= kNearWhiteChannelMin && b >= kNearWhiteChannelMin)
        return QColor(0, 0, 0);
    return QColor(r, g, b);
}

QColor resolveEntityColor(const core::Document* doc, const core::Entity& entity,
                          bool flipWhiteOnLight) {
    uint32_t color = entity.color;
    const auto* layer = layer_for(doc, entity.layerId);
    const uint32_t layer_color = layer ? layer->color : 0xDCDCE6u;
    const bool inheritsLayerColor = (color == 0);
    bool layerTrueWhiteAci = false;
    if (inheritsLayerColor && layer && layer_color == 0xFFFFFFu) {
        int layerAci = 0;
        const std::string layerAciText = lookup_layer_meta(doc, layer->id, "color_aci");
        layerTrueWhiteAci = parse_int(layerAciText, &layerAci) && layerAci == 255;
    }

    // For DXF/DWG imported entities: color is already RGB (set by adapter).
    // If color is 0, fall back to layer color. Keep layer ACI metadata only
    // for the AutoCAD light-background distinction between color 7 (black on
    // white) and color 255 (true white, often intentionally invisible).
    if (color == 0) color = layer_color;
    if (color != 0 && color != 0xDCDCE6u)
        return finalize_color(color, flipWhiteOnLight && !layerTrueWhiteAci);

    const std::string source = lookup_entity_meta(doc, entity.id, "color_source");
    if (!source.empty()) {
        if (source == "BYLAYER") {
            color = layer_color;
        } else if (source == "BYBLOCK") {
            if (color == 0) {
                int aci = 0;
                const std::string aci_text = lookup_entity_meta(doc, entity.id, "color_aci");
                if (parse_int(aci_text, &aci) && aci > 0) {
                    color = aci_to_rgb(aci);
                } else {
                    color = layer_color;
                }
            }
        } else if (source == "INDEX") {
            if (color == 0) {
                int aci = 0;
                const std::string aci_text = lookup_entity_meta(doc, entity.id, "color_aci");
                if (parse_int(aci_text, &aci) && aci > 0) {
                    color = aci_to_rgb(aci);
                } else {
                    color = layer_color;
                }
            }
        } else if (source == "TRUECOLOR") {
            if (color == 0) {
                int aci = 0;
                const std::string aci_text = lookup_entity_meta(doc, entity.id, "color_aci");
                if (parse_int(aci_text, &aci) && aci > 0) {
                    color = aci_to_rgb(aci);
                } else {
                    color = layer_color;
                }
            }
        }
    }

    if (color == 0) color = layer_color ? layer_color : 0xDCDCE6u;
    return finalize_color(color, flipWhiteOnLight && !layerTrueWhiteAci);
}

std::vector<std::string> semanticClassOrder() {
    return {
        "geometry",
        "text",
        "dimension",
        "hatch",
        "insert_text",
        "other",
    };
}

uint32_t semanticClassRgb(const std::string& name) {
    if (name == "geometry") return 0x1F77B4u;    // blue
    if (name == "text") return 0xFF7F0Eu;        // orange
    if (name == "dimension") return 0xD62728u;   // red
    if (name == "hatch") return 0x2CA02Cu;       // green
    if (name == "insert_text") return 0x9467BDu; // purple
    return 0x8C8C8Cu;                            // other/unknown
}

std::string semanticClassName(const core::Document* doc, const core::Entity& entity) {
    const std::string source = lookup_entity_meta(doc, entity.id, "source_type");
    const std::string textKind = lookup_entity_meta(doc, entity.id, "text_kind");
    const std::string attributeTag = lookup_entity_meta(doc, entity.id, "attribute_tag");

    if (source == "DIMENSION" || textKind == "dimension") return "dimension";
    if (source == "HATCH" || entity.line_type == "__HATCH_FILL__") return "hatch";

    if (entity.type == core::EntityType::Text) {
        // Insert-sourced text includes title-block attributes in the G11 class
        // of drawings. Keep it separate from direct modelspace TEXT/MTEXT.
        if (source == "INSERT" || !attributeTag.empty() ||
            textKind == "attrib" || textKind == "attdef") {
            return "insert_text";
        }
        return "text";
    }

    switch (entity.type) {
        case core::EntityType::Polyline:
        case core::EntityType::Line:
        case core::EntityType::Arc:
        case core::EntityType::Circle:
        case core::EntityType::Ellipse:
        case core::EntityType::Spline:
            return "geometry";
        default:
            return "other";
    }
}

// Standard DXF linetype patterns: {dash_mm, gap_mm, dash_mm, gap_mm, ...}
// Dot is represented as very short dash (0.5mm).
// Build QPen dash pattern from real DXF linetype data.
// patterns: real DXF linetype map (from adapter), ltScale: global LTSCALE.
// scale: current pixels-per-world-unit.
QVector<qreal> linetypeDashPattern(const std::string& lt, double scale,
                                   const LinetypeTable& linetypes)
{
    // Normalise to uppercase
    std::string name = lt;
    for (char& c : name) c = static_cast<char>(std::toupper(static_cast<unsigned char>(c)));

    // Look up real DXF pattern first
    const auto& patterns = linetypes.patterns;
    auto it = patterns.find(name);
    if (it == patterns.end()) {
        // Try substring match (e.g., ACAD_ISO04W100 contains DASHED)
        for (auto& [key, _] : patterns)
            if (name.find(key) != std::string::npos || key.find(name) != std::string::npos)
                { it = patterns.find(key); break; }
    }

    // Fallback table for common patterns if DXF didn't define them
    static const struct { const char* name; std::initializer_list<double> pat; } fallback[] = {
        {"DASHED",  {12.7, -6.35}},
        {"HIDDEN",  {6.35, -3.175}},
        {"CENTER",  {31.75, -6.35, 6.35, -6.35}},
        {"DASHDOT", {12.7, -3.175, 0.0, -3.175}},
        {"PHANTOM", {31.75, -6.35, 6.35, -6.35, 6.35, -6.35}},
        {"DOT",     {0.0, -3.175}},
    };

    std::vector<double> rawPat;
    if (it != patterns.end() && !it->second.empty()) {
        rawPat = it->second;
    } else {
        for (auto& fb : fallback)
            if (name == fb.name || name.find(fb.name) != std::string::npos)
                { rawPat.assign(fb.pat.begin(), fb.pat.end()); break; }
    }
    if (rawPat.empty()) return {};

    // Convert DXF pattern (positive=dash, negative=gap, 0=dot) to QPen dash pattern
    // QPen expects alternating dash/gap lengths in pen-width units (for cosmetic: pixels)
    QVector<qreal> q;
    for (double v : rawPat) {
        double worldLen = std::abs(v) * linetypes.ltScale;
        double px = worldLen * scale;
        if (v == 0.0) px = 1.0; // dot: 1 pixel
        // Minimal visibility: dash >= 2px, gap >= 1px
        bool isDash = (v >= 0.0);
        if (isDash) { if (px < 2.0) px = 2.0; }
        else        { if (px < 1.0) px = 1.0; }
        q.append(px);
    }
    // QPen dash pattern must alternate dash/gap — ensure even count
    if (q.size() % 2 != 0) q.append(1.0);
    return q;
}

bool fitToExtents(const QSize& viewport, double mnx, double mny,
                  double mxx, double mxy, View* out) {
    if (!out) return false;
    int w = viewport.width(), h = viewport.height();
    if (w < 10 || h < 10) return false;
    double dw = mxx - mnx, dh = mxy - mny;
    if (dw < 1 || dh < 1) return false;
    // 5% margin
    mnx -= dw * 0.05; mxx += dw * 0.05;
    mny -= dh * 0.05; mxy += dh * 0.05;
    dw = mxx - mnx; dh = mxy - mny;

    // Transform: screenX = worldX * scale + panX
    //            screenY = worldY * (-scale) + panY  (Y flipped)
    // So: worldMinX → screenLeft, worldMaxX → screenRight
    //     worldMaxY → screenTop (small Y), worldMinY → screenBottom (large Y)
    double sx = (double)w / dw;
    double sy = (double)h / dh;
    out->scale = std::min(sx, sy) * 0.9;

    double wcx = (mnx + mxx) / 2.0;
    double wcy = (mny + mxy) / 2.0;

    // screenCenter.x = wcx * scale + panX → panX = w/2 - wcx*scale
    // screenCenter.y = wcy * (-scale) + panY → panY = h/2 + wcy*scale
    out->pan.setX(w / 2.0 - wcx * out->scale);
    out->pan.setY(h / 2.0 + wcy * out->scale);
    return true;
}

bool fitToContent(const core::Document& doc, const QSize& viewport, View* out) {
    if (!out) return false;
    int w = viewport.width(), h = viewport.height();
    if (w < 10 || h < 10) return false;

    // Bounding box of all geometry via the shared core::contentBounds — the one
    // geometry truth, also emitted in the render report as content_bbox. Covers
    // all payload types (Polyline/Line/Arc/Circle/Ellipse/Spline/Text), unlike
    // the previous inline loop which only saw Polyline points + Text positions.
    double mnx, mny, mxx, mxy;
    if (!core::contentBounds(doc, mnx, mny, mxx, mxy)) return false;
    double dw = mxx - mnx, dh = mxy - mny;
    if (dw < 1 || dh < 1) return false;
    // 5% margin
    mnx -= dw * 0.05; mxx += dw * 0.05;
    mny -= dh * 0.05; mxy += dh * 0.05;
    dw = mxx - mnx; dh = mxy - mny;

    // Fit content into the viewport with a small screen-space margin, centered.
    double margin = std::min(w, h) * 0.03;
    double sx = (w - 2*margin) / dw;
    double sy = (h - 2*margin) / dh;
    out->scale = std::min(sx, sy);

    double wcx = (mnx + mxx) / 2.0;
    double wcy = (mny + mxy) / 2.0;
    out->pan.setX(w / 2.0 - wcx * out->scale);
    out->pan.setY(h / 2.0 + wcy * out->scale);
    return true;
}

void renderScene(QPainter& pr, const core::Document* doc,
                 const QVector<PolyVis>& polylines, const View& view,
                 const LinetypeTable& linetypes,
                 const QSet<EntityId>* selection,
                 bool semanticClassMask) {
    if (!doc) return;

    QTransform transform;
    transform.translate(view.pan.x(), view.pan.y());
    transform.scale(view.scale, -view.scale); // negative Y to flip CAD Y-up to screen Y-down

    pr.save();
    pr.setTransform(transform);

    // Clip to EXTMIN/EXTMAX if set (hides entities outside drawing border)
    if (view.hasClip) {
        double margin = 10.0; // small margin in world units
        QRectF clipRect(view.clipMinX - margin, view.clipMinY - margin,
                        view.clipMaxX - view.clipMinX + 2*margin,
                        view.clipMaxY - view.clipMinY + 2*margin);
        pr.setClipRect(clipRect);
    }

    // 1. Draw Text entities — in screen coordinates (outside world transform)
    // Save and reset transform since text should not be Y-flipped
    {
        pr.save();
        pr.resetTransform(); // draw in screen pixel coordinates
        pr.setRenderHint(QPainter::Antialiasing, true);
        for (const auto& e : doc->entities()) {
            if (e.type != core::EntityType::Text) continue;
            if (!isEntityVisible(doc, e)) continue;
            const auto* txt = std::get_if<core::Text>(&e.payload);
            if (!txt || txt->text.empty()) continue;
            QColor col = semanticClassMask
                ? color_from_rgb(semanticClassRgb(semanticClassName(doc, e)))
                : resolveEntityColor(doc, e, view.lightBackground);
            pr.setPen(col);
            QPointF screenPos = worldToScreen(view, QPointF(txt->pos.x, txt->pos.y));
            // Importer carries "family" or "family\x1f<widthFactor>" on
            // Entity::name (no core::Text change). Split it out.
            QString fam; double widthFactor = 1.0;
            {
                QString nm = QString::fromStdString(e.name);
                int sep = nm.indexOf(QChar(0x1f));
                if (sep >= 0) {
                    fam = nm.left(sep);
                    bool ok = false; double w = nm.mid(sep + 1).toDouble(&ok);
                    if (ok && w > 0.05 && w < 20.0) widthFactor = w;
                } else {
                    fam = nm;
                }
                fam = resolveTextFamily(fam); // best-available 仿宋/song family (was STFangsong)
            }
            // AutoCAD model: a DXF text of world-height H is drawn so the
            // glyphs are H units tall → on screen H*scale px. Size the font so
            // the ACTUAL string's tight bounding box height == H*scale (works
            // for any font/script: Latin digits, CJK — capHeight() is
            // unreliable for CJK fonts). Cache the glyph-px-per-pixelSize ratio
            // per (family, line) class to keep paintEvent cheap.
            double targetPx = txt->height * view.scale;
            // Do NOT skip sub-pixel text: AutoCAD/ezdxf still draw it (clamped
            // to ~1px). Skipping made dense annotation vanish when a large
            // drawing is zoomed to extents. Only bail on degenerate sizes.
            if (!(targetPx > 0.0) || txt->height <= 0.0) continue;
            QString qtext = QString::fromStdString(txt->text);
            QStringList lines = qtext.split('\n');
            QString sample;
            for (const QString& ln : lines) if (!ln.isEmpty()) { sample = ln; break; }
            if (sample.isEmpty()) continue;
            constexpr double kProbe = 256.0;
            QFont mfont; mfont.setFamily(fam); mfont.setPixelSize(static_cast<int>(kProbe));
            double gh = QFontMetricsF(mfont).tightBoundingRect(sample).height();
            double ratio = (gh > 1.0) ? gh / kProbe : 0.72; // glyph px per pixelSize
            double fontSize = targetPx / ratio;
            // No fixed minimum: text must scale with zoom like AutoCAD (a px
            // floor makes zoomed-out text oversized vs geometry). Only guard
            // against zero/degenerate sizes.
            if (fontSize < 1.0) fontSize = 1.0;
            if (fontSize > 4000.0) fontSize = 4000.0;
            QFont font;
            font.setFamily(fam);
            font.setPixelSize(static_cast<int>(fontSize));
            const bool cjkSerifTextOverdraw = !semanticClassMask && isSongLikeCjkRequest(fam);
            pr.setFont(font);
            pr.save();
            pr.translate(screenPos);
            if (std::abs(txt->rotation) > 0.01)
                pr.rotate(-txt->rotation * 180.0 / M_PI);
            // DXF text-style width factor: horizontal-only glyph scaling about
            // the insertion point (drawText origin x=0, so unaffected).
            if (std::abs(widthFactor - 1.0) > 0.01)
                pr.scale(widthFactor, 1.0);
            double lineH = fontSize * 1.4;
            for (int li = 0; li < lines.size(); ++li) {
                if (lines[li].isEmpty()) continue;
                const QPointF origin(0, li * lineH);
                pr.drawText(origin, lines[li]);
                if (cjkSerifTextOverdraw) {
                    // AutoCAD's mechanical plots render default SHX/CJK 仿宋
                    // text with a slightly heavier stroke than headless Qt's
                    // regular Zhuque/Noto serif rasterization. A symmetric
                    // one-pixel color-pass overdraw tracks the measured
                    // text-mask dilation that improves the AutoCAD comparison;
                    // relying on QFont::DemiBold was ignored by Qt/fontconfig
                    // for the single-weight bundled Zhuque font. Keep semantic
                    // class masks unmodified so diagnostics still report entity
                    // coverage rather than display-weight inflation.
                    constexpr qreal kCjkSerifOverdrawPx = 1.0;
                    pr.drawText(origin + QPointF(kCjkSerifOverdrawPx, 0), lines[li]);
                    pr.drawText(origin + QPointF(-kCjkSerifOverdrawPx, 0), lines[li]);
                    pr.drawText(origin + QPointF(0, kCjkSerifOverdrawPx), lines[li]);
                    pr.drawText(origin + QPointF(0, -kCjkSerifOverdrawPx), lines[li]);
                }
            }
            pr.restore();
        }
        pr.restore(); // restore world transform for subsequent drawing
    }

    // 2. Draw Ellipses (from block expansion — stored as native Ellipse type)
    for (const auto& e : doc->entities()) {
        if (e.type != core::EntityType::Ellipse) continue;
        if (!isEntityVisible(doc, e)) continue;
        const auto* ell = std::get_if<core::Ellipse>(&e.payload);
        if (!ell) continue;
        QColor color = semanticClassMask
            ? color_from_rgb(semanticClassRgb(semanticClassName(doc, e)))
            : resolveEntityColor(doc, e, view.lightBackground);
        QPen pen(color, 1); pen.setCosmetic(true);
        // Apply line width and line type (same logic as polylines)
        {
            double lwPx = 0.0;
            const auto* layer = layer_for(doc, e.layerId);
            std::string ln = layer ? layer->name : "";
            if (e.line_weight > 0.0) {
                lwPx = std::max(1.5, e.line_weight * view.scale);
            } else if (ln.find("中心线") != std::string::npos || ln.find("点划线") != std::string::npos ||
                       ln.find("点画线") != std::string::npos) {
                lwPx = 2.0;
            } else if (ln.find("虚线") != std::string::npos) {
                lwPx = 1.5;
            } else if (ln.find("粗") != std::string::npos) {
                lwPx = 3.0;
            }
            if (!e.line_type.empty()) {
                auto dashPat = linetypeDashPattern(e.line_type, view.scale, linetypes);
                if (!dashPat.isEmpty()) {
                    pen.setStyle(Qt::CustomDashLine);
                    pen.setDashPattern(dashPat);
                }
            }
            pen.setWidthF(lwPx > 0.0 ? lwPx : 1.0);
        }
        pr.setPen(pen);
        double sa = ell->start_angle, ea = ell->end_angle;
        if (std::abs(ea - sa) < 1e-10) { sa = 0; ea = 2.0 * M_PI; }
        // Build path so dash pattern works across the whole arc. Path is in
        // world coordinates — the active world transform maps it to screen
        // (the cosmetic pen still strokes dashes/width in device pixels).
        QPainterPath arcPath;
        for (int s = 0; s <= 64; ++s) {
            double a = sa + (ea - sa) * s / 64;
            double lx = ell->rx * std::cos(a), ly = ell->ry * std::sin(a);
            double cosR = std::cos(ell->rotation), sinR = std::sin(ell->rotation);
            QPointF cur(ell->center.x + lx*cosR - ly*sinR,
                        ell->center.y + lx*sinR + ly*cosR);
            if (s == 0) arcPath.moveTo(cur);
            else arcPath.lineTo(cur);
        }
        pr.drawPath(arcPath);
    }

    // 3. Draw Polylines
    pr.setRenderHint(QPainter::Antialiasing, true);
    for (int i=0; i<polylines.size(); ++i) {
        const auto& pv = polylines[i];
        const core::Entity* entity = (pv.entityId != 0) ? doc->get_entity(pv.entityId) : nullptr;
        if (!entity) continue;
        if (!isEntityVisible(doc, *entity)) continue;

        QColor color = semanticClassMask
            ? color_from_rgb(semanticClassRgb(semanticClassName(doc, *entity)))
            : resolveEntityColor(doc, *entity, view.lightBackground);
        QPen pen(color, 1);
        pen.setCosmetic(true);

        // Line weight: entity → layer → layer-name fallback
        double lwPx = 0.0;
        const auto* layer = layer_for(doc, entity->layerId);
        std::string ln = layer ? layer->name : "";

        // Pattern-fill hatch lines: marked by the importer with linetype
        // "__HATCH_FILL__". Always render as 1-device-px hairlines — pattern
        // spacing is often sub-pixel at fit-to-extents, and any wider pen
        // makes adjacent strokes overlap into a solid color blob (the
        // "yellow filled section" symptom in the reboiler before this fix).
        bool isHatchFill = (entity->line_type == "__HATCH_FILL__");
        if (isHatchFill) {
            pen.setWidthF(1.0); // pen is already cosmetic → 1 device px
            lwPx = -1.0; // signal: already set, skip below
        } else if (entity->line_weight > 0.0) {
            // 1. Entity explicit lineweight (mm → pixels, min 1px)
            lwPx = std::max(1.0, entity->line_weight * view.scale);
        } else if (layer && layer->line_weight > 0.0) {
            // 2. Layer lineweight (stored by adapter from DXF layer table)
            lwPx = std::max(1.0, layer->line_weight * view.scale);
        } else {
            // 3. Layer-name fallback (last resort)
            if (ln.find("粗实线") != std::string::npos || ln.find("YGJ粗") != std::string::npos)
                lwPx = 2.5;
            else if (ln == "0")
                lwPx = 1.5;
            else
                lwPx = 1.0; // default thin
        }

        // Apply linetype dash pattern if not continuous
        if (lwPx >= 0.0) { // lwPx < 0 means pen width already set (e.g. hatch)
            if (!entity->line_type.empty()) {
                auto dashPat = linetypeDashPattern(entity->line_type, view.scale, linetypes);
                if (!dashPat.isEmpty()) {
                    pen.setStyle(Qt::CustomDashLine);
                    pen.setDashPattern(dashPat);
                    pen.setWidthF(lwPx > 0.0 ? lwPx : 1.0);
                } else {
                    pen.setWidthF(lwPx > 0.0 ? lwPx : 1.5);
                }
            } else {
                pen.setWidthF(lwPx > 0.0 ? lwPx : 1.5);
            }
        }

        if (!semanticClassMask && selection && selection->contains(pv.entityId)) {
            pen.setColor(QColor(255,220,100));
            pen.setStyle(Qt::SolidLine);
            pen.setWidthF(2.5);
        }
        pr.setPen(pen);
        // SOLID/TRACE entities: filled polygon (drawn in world coords via transform)
        if (entity->name == "__SOLID__" && pv.pts.size() >= 3) {
            pr.setPen(Qt::NoPen);
            pr.setBrush(pen.color());
            pr.drawPath(pv.cachePath); // cachePath is in world coords, transform handles it
            pr.setBrush(Qt::NoBrush);
            continue;
        }
        pr.drawPath(pv.cachePath);
    }

    pr.restore();
}

} // namespace scene_render
