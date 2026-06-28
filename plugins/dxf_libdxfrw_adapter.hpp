#pragma once

#include "drw_interface.h"
#include "core/core_c_api.h"

#include <string>
#include <map>
#include <set>
#include <vector>
#include <cmath>

// Stored entity from a block definition (lightweight copy of geometry)
struct BlockEntity {
    enum Type { Line, Circle, Arc, LWPolyline, Point, Text, Ellipse, Insert };
    Type type;
    // Line/Polyline points
    std::vector<std::pair<double,double>> pts;
    // Circle/Arc params
    double cx{0}, cy{0}, radius{0}, startAngle{0}, endAngle{0};
    // Text
    double height{0}, rotation{0};
    std::string text;
    double widthFactor{1.0};  // DXF text-style width × entity widthscale
    std::string fontFam;      // resolved Qt family (empty → engineering 仿宋)
    std::string textStyleName;
    std::string textKind;      // "text" / "mtext" provenance for report-only diagnostics
    std::string attributeTag;
    bool isAttDef{false}; // ATTDEF tag text: hidden during INSERT expansion
    // Ellipse
    double rx{0}, ry{0}, ellRot{0}, ellStart{0}, ellEnd{0};
    std::string layerName;
    uint32_t color{0};
    std::string linetype; // entity-level linetype (empty = bylayer)
    std::string sourceType; // DXF provenance for the semantic classifier (e.g. "HATCH"); empty = inherit the INSERT's originType
    // Insert-specific
    std::string blockName;
    double insX{0}, insY{0}, xscale{1}, yscale{1}, insAngle{0};
};

struct HatchPatternDiagnostic {
    std::string patternName;
    std::string layerName;
    bool inBlock{false};
    bool solid{false};
    int hatchStyle{0};
    int hatchPattern{0};
    int doubleFlag{0};
    int defLines{0};
    int loopCount{0};
    int usableLoopCount{0};
    int familyCount{0};
    int emittedSegments{0};
    double angleDeg{0.0};
    double scale{0.0};
    double spacing{0.0};
    bool spacingCapped{false};
    double bboxWidth{0.0};
    double bboxHeight{0.0};
    int colorAci{0};
    uint32_t colorRgb{0};
};

// Adapter: bridges libdxfrw DRW_Interface callbacks to cadgf_document C API.
class CadgfDrwAdapter : public DRW_Interface {
public:
    explicit CadgfDrwAdapter(cadgf_document* doc) : m_doc(doc) {}

    int entityCount() const { return m_entityCount; }
    int layerCount() const { return m_layerCount; }
    const std::vector<HatchPatternDiagnostic>& hatchPatternDiagnostics() const { return m_hatchPatternDiagnostics; }

    // Real DXF linetype patterns: name → dash/gap vector (positive=dash, negative=gap, 0=dot)
    const std::map<std::string, std::vector<double>>& linetypes() const { return m_linetypes; }
    double ltScale() const { return m_ltScale; }

    // Resolve a DXF text-style name to a macOS Qt font family (engineering convention).
    std::string fontFamilyForStyle(const std::string& styleName) const;
    // DXF text-style horizontal width factor for a style name (1.0 if unknown).
    double widthFactorForStyle(const std::string& styleName) const;

    // Drawing extents from DXF/DWG header ($EXTMIN/$EXTMAX).
    // Returns true if header provided valid extents.
    bool getExtents(double& minX, double& minY, double& maxX, double& maxY) const {
        if (!m_hasExtents) return false;
        minX = m_extMinX; minY = m_extMinY;
        maxX = m_extMaxX; maxY = m_extMaxY;
        return true;
    }

    // Call after read() to expand XRef blocks not referenced by any INSERT
    void expandUnreferencedBlocks();

    // ─── Table entries ───
    void addHeader(const DRW_Header* data) override;
    void addLType(const DRW_LType& data) override;
    void addLayer(const DRW_Layer& data) override;
    void addDimStyle(const DRW_Dimstyle& data) override;
    void addVport(const DRW_Vport& data) override {}
    void addTextStyle(const DRW_Textstyle& data) override;
    void addAppId(const DRW_AppId& data) override {}

    // ─── Blocks ───
    void addBlock(const DRW_Block& data) override;
    void setBlock(const int handle) override {}
    void endBlock() override;

    // ─── Entities ───
    void addPoint(const DRW_Point& data) override;
    void addLine(const DRW_Line& data) override;
    void addRay(const DRW_Ray& data) override {}
    void addXline(const DRW_Xline& data) override {}
    void addArc(const DRW_Arc& data) override;
    void addCircle(const DRW_Circle& data) override;
    void addEllipse(const DRW_Ellipse& data) override;
    void addLWPolyline(const DRW_LWPolyline& data) override;
    void addPolyline(const DRW_Polyline& data) override;
    void addSpline(const DRW_Spline* data) override;
    void addKnot(const DRW_Entity& data) override {}
    void addInsert(const DRW_Insert& data) override;
    void addTrace(const DRW_Trace& data) override;
    void add3dFace(const DRW_3Dface& data) override {}
    void addSolid(const DRW_Solid& data) override;
    void addMText(const DRW_MText& data) override;
    void addText(const DRW_Text& data) override;

    // ─── Dimensions ───
    void addDimAlign(const DRW_DimAligned* data) override;
    void addDimLinear(const DRW_DimLinear* data) override;
    void addDimRadial(const DRW_DimRadial* data) override;
    void addDimDiametric(const DRW_DimDiametric* data) override;
    void addDimAngular(const DRW_DimAngular* data) override;
    void addDimAngular3P(const DRW_DimAngular3p* data) override;
    void addDimOrdinate(const DRW_DimOrdinate* data) override;
    void addLeader(const DRW_Leader* data) override;
    void addHatch(const DRW_Hatch* data) override;
    void addViewport(const DRW_Viewport& data) override {}
    void addImage(const DRW_Image* data) override {}

    // ─── Objects ───
    void linkImage(const DRW_ImageDef* data) override {}
    void addComment(const char* comment) override {}

    // Write callbacks (not used for import)
    void writeHeader(DRW_Header& data) override {}
    void writeBlocks() override {}
    void writeBlockRecords() override {}
    void writeEntities() override {}
    void writeLTypes() override {}
    void writeLayers() override {}
    void writeTextstyles() override {}
    void writeVports() override {}
    void writeDimstyles() override {}
    void writeAppId() override {}

private:
    bool shouldSkipEntity(const DRW_Entity& ent) const;
    bool useDimBlock(const DRW_Dimension* dim);
    int resolveLayer(const std::string& name);
    cadgf_entity_id addPolylineToDoc(const std::vector<std::pair<double,double>>& pts, int lid,
                          uint32_t color = 0, const std::string& linetype = "",
                          const std::string& layerName = "", double lweightMm = 0.0,
                          const char* entityName = nullptr);
    // Transform a point by INSERT parameters (scale, rotate, translate)
    std::pair<double,double> transformPoint(double x, double y,
        double insX, double insY, double xscale, double yscale, double angle) const;
    // Expand a block's entities into the document with INSERT transform.
    // insColor: INSERT entity's effective color for BYBLOCK (0xFFFFFFFF) entities; 0 = BYLAYER
    void expandBlock(const std::string& blockName, double insX, double insY,
                     double xscale, double yscale, double angle, int lid,
                     uint32_t insColor = 0, const std::string& originType = "");
    // Tag an entity with DXF provenance (source_type) so render_cli's semantic
    // class buffer (scene_renderer semanticClassName) can classify expanded
    // primitives. Mirrors the plugin import path's metadata contract; the key
    // format must match scene_renderer's lookup_entity_meta.
    void setEntitySourceType(cadgf_entity_id id, const std::string& originType);
    void writeTextStyleMetadata(cadgf_entity_id id,
                                const std::string& styleName,
                                double effectiveWidthFactor) const;

    // Resolve effective linetype name for a DRW entity (entity-level overrides layer)
    std::string resolveLinetype(const std::string& entLinetype,
                                const std::string& layerName) const;
    // Set entity linetype after creation (skips empty/continuous/bylayer)
    void applyLinetype(cadgf_entity_id eid,
                       const std::string& entLinetype,
                       const std::string& layerName);

    cadgf_document* m_doc;
    int m_entityCount{0};
    int m_layerCount{0};
    std::map<std::string, int> m_layerMap;
    std::map<std::string, int> m_layerColorAci;
    // layer name → linetype name
    std::map<std::string, std::string> m_layerLineType;
    // layer name → line weight in mm (0 = default)
    std::map<std::string, double> m_layerLineWeight;
    // set of layer names that are frozen or turned off
    std::set<std::string> m_frozenLayers;
    // linetype name → dash pattern (positive=dash len, negative=gap len, 0=dot)
    std::map<std::string, std::vector<double>> m_linetypes;
    // Dimension styling from header/$DIMSCALE/$DIMASZ or Standard dimstyle
    double m_dimArrowSize{3.5};   // effective arrow length in drawing units
    double m_dimTextHeight{3.5};  // effective dim text height in drawing units
    double m_dimExo{0.0};         // extension line offset from measurement point
    double m_dimExe{0.0};         // extension line extension past dim line
    double m_dimLFac{1.0};        // dimension length factor ($DIMLFAC)
    int    m_dimDecPrecision{2};  // decimal digits for dimension text ($DIMDEC)
    double m_ltScale{1.0};        // global linetype scale ($LTSCALE)

    // Drawing extents from $EXTMIN/$EXTMAX header variables
    bool m_hasExtents{false};
    double m_extMinX{0}, m_extMinY{0}, m_extMaxX{0}, m_extMaxY{0};

    // Text style info: style name → {font file, width factor, char width ratio}
    struct TextStyleInfo {
        std::string fontFile;      // e.g., "romans.shx"
        std::string bigFontFile;   // e.g., "hzdx.shx" / CJK bigfont
        double widthFactor{1.0};   // DXF code 41 (style-level width scale)
        double charRatio{0.6};     // base char width/height ratio for this font
    };
    std::map<std::string, TextStyleInfo> m_textStyles;

    // Block definition storage
    bool m_inBlock{false};
    std::string m_currentBlockName;
    std::map<std::string, std::vector<BlockEntity>> m_blocks;
    std::map<std::string, int> m_blockFlags;     // DXF code 70 per block name
    std::set<std::string> m_referencedBlocks; // blocks referenced by INSERT
    std::set<std::string> m_referencedDimensionBlocks;  // *D blocks referenced by DIMENSION
    std::map<std::string, std::string> m_dimensionBlockLayerName; // *D block name -> parent DIMENSION layer
    std::set<std::string> m_dimensionBlocksOnTrueWhiteLayer; // parent DIMENSION layer has ACI 255
    std::vector<HatchPatternDiagnostic> m_hatchPatternDiagnostics;
};
