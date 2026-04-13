#pragma once

#include "drw_interface.h"
#include "core/core_c_api.h"

#include <string>
#include <map>
#include <vector>
#include <cmath>

// Stored entity from a block definition (lightweight copy of geometry)
struct BlockEntity {
    enum Type { Line, Circle, Arc, LWPolyline, Point, Text, Ellipse };
    Type type;
    // Line/Polyline points
    std::vector<std::pair<double,double>> pts;
    // Circle/Arc params
    double cx{0}, cy{0}, radius{0}, startAngle{0}, endAngle{0};
    // Text
    double height{0}, rotation{0};
    std::string text;
    // Ellipse
    double rx{0}, ry{0}, ellRot{0}, ellStart{0}, ellEnd{0};
    std::string layerName;
};

// Adapter: bridges libdxfrw DRW_Interface callbacks to cadgf_document C API.
class CadgfDrwAdapter : public DRW_Interface {
public:
    explicit CadgfDrwAdapter(cadgf_document* doc) : m_doc(doc) {}

    int entityCount() const { return m_entityCount; }
    int layerCount() const { return m_layerCount; }

    // ─── Table entries ───
    void addHeader(const DRW_Header* data) override;
    void addLType(const DRW_LType& data) override {}
    void addLayer(const DRW_Layer& data) override;
    void addDimStyle(const DRW_Dimstyle& data) override {}
    void addVport(const DRW_Vport& data) override {}
    void addTextStyle(const DRW_Textstyle& data) override {}
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
    void addDimAngular3P(const DRW_DimAngular3p* data) override {}
    void addDimOrdinate(const DRW_DimOrdinate* data) override {}
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
    int resolveLayer(const std::string& name);
    void addPolylineToDoc(const std::vector<std::pair<double,double>>& pts, int lid);
    // Transform a point by INSERT parameters (scale, rotate, translate)
    std::pair<double,double> transformPoint(double x, double y,
        double insX, double insY, double xscale, double yscale, double angle) const;
    // Expand a block's entities into the document with INSERT transform
    void expandBlock(const std::string& blockName, double insX, double insY,
                     double xscale, double yscale, double angle, int lid);

    cadgf_document* m_doc;
    int m_entityCount{0};
    int m_layerCount{0};
    std::map<std::string, int> m_layerMap;

    // Block definition storage
    bool m_inBlock{false};
    std::string m_currentBlockName;
    std::map<std::string, std::vector<BlockEntity>> m_blocks;
};
