#pragma once

#include <string>
#include <vector>
#include <cstdint>
#include <variant>
#include <map>
#include <unordered_map>
#include <unordered_set>
#include <functional>

#include "core/geometry2d.hpp"

namespace core {

using EntityId = uint64_t;

enum class EntityType {
    Polyline = 0,
    Point = 1,
    Line = 2,
    Arc = 3,
    Circle = 4,
    Ellipse = 5,
    Spline = 6,
    Text = 7,
    BlockInstance = 8
};

// Sub-entity reference roles for constraints and editing (internal).
enum class PointRole {
    None = 0,
    Start,
    End,
    Mid,
    Center,
    ControlPoint
};

struct ElementRef {
    EntityId id{};
    PointRole role{PointRole::None};
    int index{-1}; // control point or vertex index when applicable
};

struct BlockDefinition {
    std::string name;
    std::vector<EntityId> memberIds; // entities belonging to this block
};

struct BlockInstance {
    std::string blockName;
    Vec2 insertionPoint{};
    double rotation{0.0};
    double scaleX{1.0};
    double scaleY{1.0};
};

using EntityPayload = std::variant<std::monostate, Point, Line, Arc, Circle, Ellipse, Spline, Text, Polyline, BlockInstance>;

struct Entity {
    EntityId id{};
    EntityType type{EntityType::Polyline};
    std::string name;
    int layerId{0}; // 0 is default layer
    EntityPayload payload{};

    // Editor metadata (PR4: single source of truth)
    bool visible{true};           // per-entity visibility override
    int groupId{-1};              // grouping identifier (-1 = ungrouped)
    uint32_t color{0};            // per-entity color (0 = inherit from layer)
    std::string line_type;        // empty = inherit
    double line_weight{0.0};      // <= 0 = inherit
    double line_type_scale{0.0};  // 0 = default
};

struct Layer {
    int id{0};
    std::string name;
    uint32_t color{0xFFFFFF}; // 0xRRGGBB
    bool visible{true};
    bool locked{false};
    bool printable{true};
    bool frozen{false};
    bool construction{false};
};

struct DocumentSettings {
    double unit_scale{1.0};
};

struct DocumentMetadata {
    std::string label;
    std::string author;
    std::string company;
    std::string comment;
    std::string created_at;
    std::string modified_at;
    std::string unit_name;
    std::map<std::string, std::string> meta;
};

class Document;

enum class DocumentChangeType {
    EntityAdded,
    EntityRemoved,
    EntityGeometryChanged,
    EntityMetaChanged,
    LayerChanged,
    Cleared,
    Reset,
    DocumentMetaChanged,
    SettingsChanged
};

struct DocumentChangeEvent {
    DocumentChangeType type{DocumentChangeType::Reset};
    EntityId entityId{0};
    int layerId{0};
};

class DocumentObserver {
public:
    virtual ~DocumentObserver() = default;
    virtual void on_before_document_changed(const Document& /*doc*/, const DocumentChangeEvent& /*event*/) {}
    virtual void on_document_changed(const Document& doc, const DocumentChangeEvent& event) = 0;
};

// Dependency graph for topological recompute (P3.2, FreeCAD-inspired).
// Tracks directed edges: source → dependent. When source changes, dependents recompute in topo order.
class DependencyGraph {
public:
    // Add a dependency edge: `dependent` depends on `source`.
    void addDependency(EntityId source, EntityId dependent);
    // Remove a single edge.
    void removeDependency(EntityId source, EntityId dependent);
    // Remove all edges involving an entity (both as source and dependent).
    void removeEntity(EntityId id);
    // Clear the entire graph.
    void clear();

    // Get direct dependents of a source entity.
    std::vector<EntityId> dependentsOf(EntityId source) const;
    // Get direct sources (providers) of a dependent entity.
    std::vector<EntityId> sourcesOf(EntityId dependent) const;
    // Check if adding source→dependent would create a cycle.
    bool wouldCycle(EntityId source, EntityId dependent) const;

    // Topological sort of all entities reachable from `roots` (downstream).
    // Returns entity ids in recompute order (sources before dependents).
    // If a cycle is detected, returns partial order + sets `hasCycle` to true.
    std::vector<EntityId> topologicalOrder(const std::vector<EntityId>& roots, bool* hasCycle = nullptr) const;

    // Get all entities in the graph.
    std::vector<EntityId> allEntities() const;
    bool empty() const { return forward_.empty(); }
    size_t edgeCount() const;

private:
    // forward_[source] = {dependents}
    std::unordered_map<EntityId, std::unordered_set<EntityId>> forward_;
    // reverse_[dependent] = {sources}
    std::unordered_map<EntityId, std::unordered_set<EntityId>> reverse_;
};

class Document {
public:
    Document();
    ~Document();

    // Layer management
    int add_layer(const std::string& name, uint32_t color = 0xFFFFFF);
    Layer* get_layer(int id);
    const Layer* get_layer(int id) const;
    const std::vector<Layer>& layers() const { return layers_; }
    bool set_layer_visible(int id, bool visible);
    bool set_layer_locked(int id, bool locked);
    bool set_layer_printable(int id, bool printable);
    bool set_layer_frozen(int id, bool frozen);
    bool set_layer_construction(int id, bool construction);
    bool set_layer_color(int id, uint32_t color);

    EntityId add_point(const Vec2& p, const std::string& name = "", int layerId = 0);
    EntityId add_line(const Line& l, const std::string& name = "", int layerId = 0);
    EntityId add_arc(const Arc& a, const std::string& name = "", int layerId = 0);
    EntityId add_circle(const Circle& c, const std::string& name = "", int layerId = 0);
    EntityId add_ellipse(const Ellipse& e, const std::string& name = "", int layerId = 0);
    EntityId add_spline(const Spline& s, const std::string& name = "", int layerId = 0);
    EntityId add_text(const Text& t, const std::string& name = "", int layerId = 0);

    Point* get_point(EntityId id);
    const Point* get_point(EntityId id) const;
    Line* get_line(EntityId id);
    const Line* get_line(EntityId id) const;
    Arc* get_arc(EntityId id);
    const Arc* get_arc(EntityId id) const;
    Circle* get_circle(EntityId id);
    const Circle* get_circle(EntityId id) const;
    Ellipse* get_ellipse(EntityId id);
    const Ellipse* get_ellipse(EntityId id) const;
    Spline* get_spline(EntityId id);
    const Spline* get_spline(EntityId id) const;
    Text* get_text(EntityId id);
    const Text* get_text(EntityId id) const;

    bool set_point(EntityId id, const Vec2& p);
    bool set_line(EntityId id, const Line& l);
    bool set_arc(EntityId id, const Arc& a);
    bool set_circle(EntityId id, const Circle& c);
    bool set_ellipse(EntityId id, const Ellipse& e);
    bool set_spline(EntityId id, const Spline& s);
    bool set_text(EntityId id, const Text& t);

    EntityId add_polyline(const Polyline& pl, const std::string& name = "", int layerId = 0);
    bool set_polyline_points(EntityId id, const Polyline& pl);

    // Block definition / instance management (P2.4)
    int add_block_definition(const std::string& name);
    bool add_entity_to_block(int blockIndex, EntityId entityId);
    EntityId add_block_instance(const BlockInstance& inst, const std::string& name = "", int layerId = 0);
    const std::vector<BlockDefinition>& block_definitions() const { return block_definitions_; }
    bool     remove_entity(EntityId id);
    void     clear();

    // Entity property setters (PR4: single source of truth)
    Entity* get_entity(EntityId id);
    const Entity* get_entity(EntityId id) const;
    bool set_entity_visible(EntityId id, bool visible);
    bool set_entity_color(EntityId id, uint32_t color);
    bool set_entity_group_id(EntityId id, int groupId);
    bool set_entity_line_type(EntityId id, const std::string& lineType);
    bool set_entity_line_weight(EntityId id, double weight);
    bool set_entity_line_type_scale(EntityId id, double scale);
    int alloc_group_id();

    void add_observer(DocumentObserver* observer);
    void remove_observer(DocumentObserver* observer);
    void begin_change_batch();
    void end_change_batch();

    const std::vector<Entity>& entities() const { return entities_; }
    DocumentSettings& settings() { return settings_; }
    const DocumentSettings& settings() const { return settings_; }
    DocumentMetadata& metadata() { return metadata_; }
    const DocumentMetadata& metadata() const { return metadata_; }
    bool set_label(const std::string& label);
    bool set_author(const std::string& author);
    bool set_company(const std::string& company);
    bool set_comment(const std::string& comment);
    bool set_created_at(const std::string& created_at);
    bool set_modified_at(const std::string& modified_at);
    bool set_unit_name(const std::string& unit_name);
    bool set_meta_value(const std::string& key, const std::string& value);
    bool remove_meta_value(const std::string& key);
    bool set_unit_scale(double unit_scale);

    // Dependency graph + topological recompute (P3.2)
    DependencyGraph& dependency_graph() { return dep_graph_; }
    const DependencyGraph& dependency_graph() const { return dep_graph_; }
    using RecomputeCallback = std::function<void(Document& doc, EntityId id)>;
    void set_recompute_callback(RecomputeCallback cb) { recompute_cb_ = std::move(cb); }
    // Recompute all entities downstream of `changedIds` in topological order.
    // Calls the registered recompute callback for each dependent entity.
    // Returns the number of entities recomputed.
    int recompute(const std::vector<EntityId>& changedIds);
    // Recompute everything in the graph.
    int recompute_all();

    // Transaction-based undo/redo (P2.1)
    void begin_transaction(const std::string& label = "");
    void commit_transaction();
    void rollback_transaction();
    bool undo();
    bool redo();
    bool can_undo() const;
    bool can_redo() const;
    std::string undo_label() const;
    std::string redo_label() const;
    size_t undo_stack_size() const;

private:
    void notify_before(DocumentChangeType type, EntityId entityId = 0, int layerId = 0);
    void notify(DocumentChangeType type, EntityId entityId = 0, int layerId = 0);

    DocumentSettings settings_{};
    DocumentMetadata metadata_{};
    std::vector<Entity> entities_{};
    std::vector<Layer> layers_{};
    std::vector<BlockDefinition> block_definitions_{};
    DependencyGraph dep_graph_;
    RecomputeCallback recompute_cb_;
    EntityId next_id_{1};
    int next_layer_id_{1};
    int next_group_id_{1};
    std::vector<DocumentObserver*> observers_{};
    int change_batch_depth_{0};
    bool pending_reset_{false};

    // Undo/redo state
    struct PropertyDiff {
        DocumentChangeType type{DocumentChangeType::Reset};
        EntityId entityId{0};
        int layerId{0};
        EntityPayload oldPayload{};
        EntityPayload newPayload{};
        // For layer changes
        Layer oldLayer{};
        // For entity meta changes
        Entity oldEntity{};
    };
    struct Transaction {
        std::string label;
        std::vector<PropertyDiff> diffs;
    };
    std::vector<Transaction> undo_stack_;
    std::vector<Transaction> redo_stack_;
    Transaction* active_transaction_{nullptr};
    Transaction active_tx_storage_;
    bool in_undo_redo_{false};
};

class DocumentChangeGuard {
public:
    explicit DocumentChangeGuard(Document& doc);
    ~DocumentChangeGuard();

    DocumentChangeGuard(const DocumentChangeGuard&) = delete;
    DocumentChangeGuard& operator=(const DocumentChangeGuard&) = delete;

private:
    Document* doc_{nullptr};
};

} // namespace core
