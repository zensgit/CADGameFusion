// render_cli — headless DXF/DWG → PNG/SVG renderer.
//
// Runs the exact same import pipeline as the editor (libdxfrw →
// CadgfDrwAdapter → expandUnreferencedBlocks) and the exact same drawing
// code (scene_render::renderScene), so its output matches the editor canvas
// pixel-for-pixel at the same view. Intended as the building block for
// server-side rendering (thumbnails / previews for PLM integration) and for
// the screenshot-regression harness over the training-drawing corpus.

#include "scene_renderer.hpp"
#include "dxf_libdxfrw_adapter.hpp"
#include "core/bounds.hpp"
#include "core/core_c_api.h"
#include "libdxfrw.h"
#include "libdwgr.h"

#include <QCommandLineParser>
#include <QColor>
#include <QDateTime>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QFont>
#include <QFontDatabase>
#include <QFontInfo>
#include <QGuiApplication>
#include <QImage>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QPainter>
#include <QProcess>
#include <QSet>
#include <QStringList>
#include <QSvgGenerator>

#include <cstdio>
#include <memory>
#include <string>
#include <variant>

#include "core/document.hpp"

namespace {

struct ImportResult {
    cadgf_document* doc = nullptr;
    std::unique_ptr<CadgfDrwAdapter> adapter;
    bool ok = false;
    QString errMsg;
};

// Same parse path as the editor's import (mainwindow parseDxfDwg), minus the
// UI-thread plumbing: DWG via dwgR with a dwg2dxf fallback, DXF via dxfRW,
// then orphan-XRef block expansion.
ImportResult importDxfDwg(const QString& path) {
    ImportResult r;
    r.doc = cadgf_document_create();
    r.adapter = std::make_unique<CadgfDrwAdapter>(r.doc);
    const bool isDwg = path.toLower().endsWith(".dwg");

    if (isDwg) {
        try {
            dwgR dwgReader(path.toStdString().c_str());
            r.ok = dwgReader.read(r.adapter.get(), false);
            if (!r.ok) r.errMsg = QString("DWG error: %1").arg((int)dwgReader.getError());
        } catch (const std::exception& e) {
            r.ok = false;
            r.errMsg = QString("DWG exception: %1").arg(e.what());
        } catch (...) { r.ok = false; }
        if (!r.ok) {
            QString tempDxf = QDir::tempPath() + "/cadgf_dwg_" +
                QString::number(QDateTime::currentMSecsSinceEpoch()) + ".dxf";
            QStringList tools = {"dwg2dxf", "/usr/local/bin/dwg2dxf", "/opt/homebrew/bin/dwg2dxf"};
            for (const auto& tool : tools) {
                QProcess proc;
                proc.start(tool, {path, "-o", tempDxf});
                if (proc.waitForFinished(30000) && proc.exitCode() == 0 && QFile::exists(tempDxf)) {
                    cadgf_document_destroy(r.doc);
                    r.doc = cadgf_document_create();
                    r.adapter = std::make_unique<CadgfDrwAdapter>(r.doc);
                    dxfRW dxfReader(tempDxf.toStdString().c_str());
                    r.ok = dxfReader.read(r.adapter.get(), false);
                    QFile::remove(tempDxf);
                    break;
                }
            }
        }
    } else {
        dxfRW reader(path.toStdString().c_str());
        r.ok = reader.read(r.adapter.get(), false);
    }
    if (r.ok) r.adapter->expandUnreferencedBlocks();
    return r;
}

bool parseBackground(const QString& spec, QColor* out) {
    if (spec == "dark")  { *out = QColor(30, 30, 35); return true; }   // editor canvas color
    if (spec == "white") { *out = QColor(255, 255, 255); return true; }
    QColor c(spec);
    if (!c.isValid()) return false;
    *out = c;
    return true;
}

// Load every font file under dir into the application font DB so QFont family
// matching resolves drawing fonts that the host OS lacks (B1; unblocks the
// per-tenant font store in the render service A5). Returns the families added.
QStringList loadFontDir(const QString& dir) {
    QStringList families;
    QDir d(dir);
    if (!d.exists()) return families;
    const QStringList filters = {"*.ttf", "*.ttc", "*.otf", "*.otc"};
    for (const QFileInfo& fi : d.entryInfoList(filters, QDir::Files, QDir::Name)) {
        int id = QFontDatabase::addApplicationFont(fi.absoluteFilePath());
        if (id >= 0) families += QFontDatabase::applicationFontFamilies(id);
    }
    families.removeDuplicates();
    return families;
}

// The renderer carries the resolved family on Entity::name as
// "family\x1f<widthFactor>" (see scene_renderer). Recover the family the same
// way so the report records exactly what renderScene will request.
QString familyOf(const core::Entity& e) {
    QString nm = QString::fromStdString(e.name);
    int sep = nm.indexOf(QChar(0x1f));
    QString fam = (sep >= 0) ? nm.left(sep) : nm;
    return fam.isEmpty() ? scene_render::defaultTextFamily() : fam;
}

// Counts only the text entities renderScene will actually draw — same
// visibility + degenerate-height gates as scene_renderer, so the report
// reflects the render path rather than the raw entity list.
bool willDrawText(const core::Document& doc, const core::Entity& e) {
    if (e.type != core::EntityType::Text) return false;
    if (!scene_render::isEntityVisible(&doc, e)) return false;
    const auto* t = std::get_if<core::Text>(&e.payload);
    return t && !t->text.empty() && t->height > 0.0;
}

bool containsFoldedToken(const QString& value, const QStringList& tokens) {
    const QString folded = value.toCaseFolded();
    for (const QString& tok : tokens) {
        if (folded.contains(tok.toCaseFolded())) return true;
    }
    return false;
}

bool isSansFallbackFamily(const QString& family) {
    return containsFoldedToken(family, {
        QStringLiteral("dejavu sans"),
        QStringLiteral("noto sans"),
        QStringLiteral("helvetica"),
        QStringLiteral("applesystem"),
        QStringLiteral("sans serif")
    });
}

bool isRequestedCjkSerifFamily(const QString& family) {
    return containsFoldedToken(family, {
        QStringLiteral("serif"),
        QStringLiteral("song"),
        QStringLiteral("fang"),
        QStringLiteral("仿宋"),
        QStringLiteral("stfang"),
        QStringLiteral("zhuque")
    });
}

// Two-layer font resolution record (B1): the adapter/default requested family
// (layer 1) vs. the effective CJK family used for report gates (layer 2).
// QFontInfo::family() can report the Latin primary face (e.g. DejaVu Sans)
// even when the requested CJK family is installed and supplies the Chinese
// glyphs. Preserve that raw value as qt_resolved, but make resolved represent
// the effective CJK request so render-regression gates do not confuse Latin
// primary-face reporting with a CJK sans fallback.
QJsonArray fontRecords(const core::Document& doc) {
    QSet<QString> requested;
    for (const auto& e : doc.entities()) {
        if (!willDrawText(doc, e)) continue;
        requested.insert(familyOf(e));
    }
    QJsonArray arr;
    QStringList sorted(requested.begin(), requested.end());
    sorted.sort();
    for (const QString& fam : sorted) {
        QFont f; f.setFamily(fam);
        QFontInfo fi(f);
        const QString qtResolved = fi.family();
        const bool useRequestedCjk = isSansFallbackFamily(qtResolved) && isRequestedCjkSerifFamily(fam);
        const QString resolved = useRequestedCjk ? fam : qtResolved;
        QJsonObject rec;
        rec["requested"] = fam;
        rec["resolved"] = resolved;
        rec["qt_resolved"] = qtResolved;
        rec["resolved_source"] = useRequestedCjk ? "requested-cjk-family" : "qt-fontinfo";
        rec["exact_match"] = fi.exactMatch();
        rec["substituted"] = !fi.exactMatch();
        arr.append(rec);
    }
    return arr;
}

int textEntityCount(const core::Document& doc) {
    int n = 0;
    for (const auto& e : doc.entities())
        if (willDrawText(doc, e)) ++n;
    return n;
}

} // namespace

int main(int argc, char** argv) {
    // Headless by default; QT_QPA_PLATFORM in the environment still wins so a
    // caller can force a specific platform plugin.
    if (qEnvironmentVariableIsEmpty("QT_QPA_PLATFORM"))
        qputenv("QT_QPA_PLATFORM", "offscreen");
    QGuiApplication app(argc, argv);
    QGuiApplication::setApplicationName("render_cli");

    QCommandLineParser parser;
    parser.setApplicationDescription(
        "Render a DXF/DWG drawing to PNG or SVG using the editor's scene renderer.");
    parser.addHelpOption();
    parser.addOption({"input",  "Input DXF/DWG file.", "file"});
    parser.addOption({"out",    "Output image file (.png or .svg).", "file"});
    parser.addOption({"width",  "Output width in pixels (default 2400).", "px", "2400"});
    parser.addOption({"height", "Output height in pixels (default 1697).", "px", "1697"});
    parser.addOption({"bg",     "Background: dark | white | #RRGGBB (default dark).", "color", "dark"});
    parser.addOption({"no-clip", "Do not clip to the drawing extents (EXTMIN/EXTMAX)."});
    parser.addOption({"window", "Frame a specific world rect 'x1,y1,x2,y2' (with the standard margin) instead of the drawing extents — e.g. the sheet frame for a garbage-extents drawing.", "rect"});
    parser.addOption({"font-dir", "Directory of font files (ttf/ttc/otf) to load before rendering.", "dir"});
    parser.addOption({"report",  "Write a render report JSON (params, view, counts, font records) to this path.", "file"});
    parser.process(app);

    QStringList loadedFamilies;
    if (parser.isSet("font-dir"))
        loadedFamilies = loadFontDir(parser.value("font-dir"));

    const QString inPath = parser.value("input");
    const QString outPath = parser.value("out");
    if (inPath.isEmpty() || outPath.isEmpty()) {
        std::fprintf(stderr, "error: --input and --out are required (see --help)\n");
        return 2;
    }
    if (!QFile::exists(inPath)) {
        std::fprintf(stderr, "error: input not found: %s\n", qPrintable(inPath));
        return 2;
    }
    const QString outSuffix = QFileInfo(outPath).suffix().toLower();
    if (outSuffix != "png" && outSuffix != "svg") {
        std::fprintf(stderr, "error: unsupported output format .%s (use .png or .svg)\n",
                     qPrintable(outSuffix));
        return 2;
    }
    bool wOk = false, hOk = false;
    const int width = parser.value("width").toInt(&wOk);
    const int height = parser.value("height").toInt(&hOk);
    if (!wOk || !hOk || width < 16 || height < 16 || width > 32768 || height > 32768) {
        std::fprintf(stderr, "error: bad --width/--height\n");
        return 2;
    }
    QColor bg;
    if (!parseBackground(parser.value("bg"), &bg)) {
        std::fprintf(stderr, "error: bad --bg value: %s\n", qPrintable(parser.value("bg")));
        return 2;
    }

    ImportResult imp = importDxfDwg(inPath);
    if (!imp.ok) {
        std::fprintf(stderr, "error: failed to read %s%s%s\n", qPrintable(inPath),
                     imp.errMsg.isEmpty() ? "" : ": ", qPrintable(imp.errMsg));
        if (imp.doc) cadgf_document_destroy(imp.doc);
        return 3;
    }
    const core::Document* doc = reinterpret_cast<core::Document*>(imp.doc);

    // View: drawing extents (like the editor's import) with content-fit fallback.
    // Explicit world window (B5) overrides extents/content fit — e.g. the
    // producer frames to the detected sheet rect when raw extents are garbage.
    double winX1 = 0, winY1 = 0, winX2 = 0, winY2 = 0;
    bool haveWindow = false;
    if (parser.isSet("window")) {
        const QStringList parts = parser.value("window").split(',');
        bool ok = parts.size() == 4;
        if (ok) {
            winX1 = parts[0].toDouble(&ok);
            if (ok) winY1 = parts[1].toDouble(&ok);
            if (ok) winX2 = parts[2].toDouble(&ok);
            if (ok) winY2 = parts[3].toDouble(&ok);
        }
        if (!ok || winX2 <= winX1 || winY2 <= winY1) {
            std::fprintf(stderr, "error: --window expects 'x1,y1,x2,y2' with x2>x1, y2>y1\n");
            cadgf_document_destroy(imp.doc);
            return 2;
        }
        haveWindow = true;
    }

    const QSize viewport(width, height);
    scene_render::View view;
    double emx = 0, emy = 0, eMx = 0, eMy = 0;
    const bool hasExtents = imp.adapter->getExtents(emx, emy, eMx, eMy);
    bool fitted = false;
    if (haveWindow) {
        fitted = scene_render::fitToExtents(viewport, winX1, winY1, winX2, winY2, &view);
        if (!fitted) {
            std::fprintf(stderr, "error: --window rect is degenerate\n");
            cadgf_document_destroy(imp.doc);
            return 2;
        }
    } else {
        if (hasExtents)
            fitted = scene_render::fitToExtents(viewport, emx, emy, eMx, eMy, &view);
        if (!fitted)
            fitted = scene_render::fitToContent(*doc, viewport, &view);
    }
    if (!fitted) {
        std::fprintf(stderr, "error: drawing has degenerate extents, nothing to render\n");
        cadgf_document_destroy(imp.doc);
        return 4;
    }
    if (!parser.isSet("no-clip")) {
        if (haveWindow) {
            view.hasClip = true;
            view.clipMinX = winX1; view.clipMinY = winY1;
            view.clipMaxX = winX2; view.clipMaxY = winY2;
        } else if (hasExtents) {
            view.hasClip = true;
            view.clipMinX = emx; view.clipMinY = emy;
            view.clipMaxX = eMx; view.clipMaxY = eMy;
        }
    }

    // B4: on a light background, flip near-white entity colors to black so
    // ACI-7 / near-white-default strokes are not invisible (AutoCAD's
    // color-7 convention). Decide by background luminance.
    view.lightBackground =
        (0.299 * bg.red() + 0.587 * bg.green() + 0.114 * bg.blue()) / 255.0 > 0.5;

    scene_render::LinetypeTable linetypes;
    linetypes.patterns = imp.adapter->linetypes();
    linetypes.ltScale = imp.adapter->ltScale();

    const QVector<scene_render::PolyVis> polylines = scene_render::buildPolyCache(*doc);

    bool written = false;
    if (outSuffix == "svg") {
        QSvgGenerator svg;
        svg.setFileName(outPath);
        svg.setSize(viewport);
        svg.setViewBox(QRect(0, 0, width, height));
        svg.setTitle(QFileInfo(inPath).fileName());
        QPainter pr(&svg);
        pr.fillRect(QRect(0, 0, width, height), bg);
        scene_render::renderScene(pr, doc, polylines, view, linetypes);
        pr.end();
        written = QFile::exists(outPath);
    } else {
        QImage img(viewport, QImage::Format_ARGB32_Premultiplied);
        img.fill(bg);
        QPainter pr(&img);
        scene_render::renderScene(pr, doc, polylines, view, linetypes);
        pr.end();
        written = img.save(outPath);
    }

    const int entityCount = imp.adapter->entityCount();

    // Render report (B1): consumed by the regression harness (view rect/scale
    // for alignment) and the render service (font resolution audit). Emitted
    // before the document is destroyed so it can read text/font data.
    if (parser.isSet("report")) {
        QJsonObject rep;
        rep["schema"] = "vemcad.render_report";
        rep["schema_version"] = "0.1";
        QJsonObject params;
        params["width"] = width;
        params["height"] = height;
        params["bg"] = parser.value("bg");
        params["format"] = outSuffix;
        params["view"] = haveWindow ? "window" : (hasExtents ? "extents" : "content");
        rep["params"] = params;
        QJsonObject v;
        v["scale"] = view.scale;
        v["pan_x"] = view.pan.x();
        v["pan_y"] = view.pan.y();
        // World→pixel: screenX = worldX*scale + pan_x; screenY = worldY*(-scale)
        // + pan_y (single uniform scale, Y negated — scene_renderer convention).
        v["y_axis"] = "down";
        v["viewport_w"] = width;
        v["viewport_h"] = height;
        v["has_clip"] = view.hasClip;
        if (view.hasClip) {
            QJsonObject clip;
            clip["min_x"] = view.clipMinX; clip["min_y"] = view.clipMinY;
            clip["max_x"] = view.clipMaxX; clip["max_y"] = view.clipMaxY;
            v["clip"] = clip;
        }
        // Real geometry content bbox — the extent of the ACTUAL geometry,
        // distinct from the header-derived clip (clip comes from getExtents() =
        // DXF $EXTMIN/$EXTMAX, which can be stale-small). Emitted unconditionally
        // (independent of has_clip) so the version-diff common-window upgrade can
        // frame a window that won't clip stale-header drawings.
        double cbx0, cby0, cbx1, cby1;
        if (doc && core::contentBounds(*doc, cbx0, cby0, cbx1, cby1)) {
            QJsonObject cb;
            cb["min_x"] = cbx0; cb["min_y"] = cby0;
            cb["max_x"] = cbx1; cb["max_y"] = cby1;
            v["content_bbox"] = cb;
        }
        rep["view"] = v;
        QJsonObject counts;
        counts["entities"] = entityCount;
        counts["polylines"] = polylines.size();
        counts["text_entities"] = textEntityCount(*doc);
        rep["counts"] = counts;
        QJsonObject fonts;
        fonts["loaded_dir"] = parser.isSet("font-dir") ? parser.value("font-dir") : QString();
        fonts["loaded_families"] = QJsonArray::fromStringList(loadedFamilies);
        fonts["records"] = fontRecords(*doc);
        rep["fonts"] = fonts;
        rep["source"] = QFileInfo(inPath).fileName();
        QFile rf(parser.value("report"));
        if (rf.open(QIODevice::WriteOnly)) {
            rf.write(QJsonDocument(rep).toJson(QJsonDocument::Indented));
            rf.close();
        } else {
            std::fprintf(stderr, "warning: could not write report %s\n",
                         qPrintable(parser.value("report")));
        }
    }

    cadgf_document_destroy(imp.doc);

    if (!written) {
        std::fprintf(stderr, "error: failed to write %s\n", qPrintable(outPath));
        return 5;
    }
    std::printf("rendered %s -> %s (%dx%d, %d entities%s)\n",
                qPrintable(QFileInfo(inPath).fileName()), qPrintable(outPath),
                width, height, entityCount,
                haveWindow ? ", window" : (hasExtents ? ", extents clip" : ", content fit"));
    return 0;
}
