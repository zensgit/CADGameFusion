#pragma once
// DXF parser zero-record (code == 0) transition handler.
// Extracted from dxf_importer_plugin.cpp to reduce branching in
// parse_dxf_entities().
//
// Dependencies: dxf_types.h, standard headers.

#include "dxf_types.h"

#include <functional>
#include <string>
#include <unordered_map>
#include <vector>

// ---------- DxfEntityKind ------------------------------------------------------
enum class DxfEntityKind {
    None,
    Polyline,
    Line,
    Point,
    Circle,
    Arc,
    Ellipse,
    Spline,
    Text,
    Solid,
    Hatch,
    Insert,
    Viewport
};

// ---------- DxfSection ---------------------------------------------------------
enum class DxfSection {
    None,
    Header,
    Tables,
    Blocks,
    Entities,
    Objects
};

// ---------- DxfImportStats -----------------------------------------------------
struct DxfImportStats {
    int entities_parsed = 0;
    int entities_imported = 0;
    int entities_skipped = 0;
    std::unordered_map<std::string, int> unsupported_types;
    std::vector<std::string> warnings;
};

// ---------- DxfZeroRecordContext ------------------------------------------------
// Bundles the parser state pointers and callbacks needed by the zero-record
// transition handler.  The caller sets up pointers into its own local state
// so that handle_zero_record can read and write parser variables without
// needing direct access to entity containers or finalize/reset lambdas.
struct DxfZeroRecordContext {
    // --- Core parser state (all non-null) ---
    DxfEntityKind* current_kind;
    DxfSection* current_section;
    std::string* current_table;
    bool* in_old_style_polyline;
    bool* expect_section_name;
    bool* expect_table_name;
    bool* in_layer_table;
    bool* in_layer_record;
    bool* in_style_table;
    bool* in_style_record;
    bool* in_vport_table;
    bool* in_vport_record;
    bool* in_block;
    bool* in_block_header;
    bool* in_layout_object;
    bool* has_active_insert_attribute_owner;
    bool* has_last_top_level_insert;

    // --- Insert ownership tracking ---
    DxfInsert* active_insert_attribute_owner;
    DxfInsert* last_top_level_insert;
    int* next_insert_attribute_group_tag;
    int* next_hatch_id;

    // --- Entity-specific writable fields for kind activation ---
    DxfText* current_text;
    DxfInsert* current_insert;
    DxfEntityOriginMeta* current_polyline_origin_meta;
    int* current_hatch_hatch_id;

    // --- Import stats ---
    DxfImportStats* import_stats;

    // --- Inserts collection (for ATTRIB owner lookup) ---
    std::vector<DxfInsert>* inserts;

    // --- Callbacks for operations that depend on local parser state ---
    std::function<void()> flush_current;
    std::function<void()> finalize_layout;
    std::function<void()> reset_layout;
    std::function<void()> finalize_layer;
    std::function<void()> reset_layer;
    std::function<void()> finalize_text_style;
    std::function<void()> reset_text_style;
    std::function<void()> finalize_vport;
    std::function<void()> reset_vport;
    std::function<void()> finalize_block;
    std::function<void()> reset_block;
    std::function<void()> reset_polyline;
    std::function<void()> reset_line;
    std::function<void()> reset_point;
    std::function<void()> reset_circle;
    std::function<void()> reset_arc;
    std::function<void()> reset_ellipse;
    std::function<void()> reset_spline;
    std::function<void()> reset_text;
    std::function<void()> reset_solid;
    std::function<void()> reset_hatch;
    std::function<void()> reset_insert;
    std::function<void()> reset_viewport;
    std::function<DxfEntityOriginMeta(const DxfInsert&)> build_insert_origin_metadata;
    std::function<DxfEntityOriginMeta()> build_leader_origin_metadata;
};

// Handles a single code-0 DXF record transition.  Caller must always
// `continue` in its parser loop after calling this function.
void handle_zero_record(const std::string& value_line, DxfZeroRecordContext& ctx);
