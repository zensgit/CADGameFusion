# CADGameFusion v0.3.0 Roadmap

**Exporter Evolution for Multi-mesh and Metadata Extensions**

Status: **Draft** | Target: **Q4 2025** | Related: [Issue #15](https://github.com/zensgit/CADGameFusion/issues/15)

## Executive Summary

CADGameFusion v0.3.0 represents a significant evolution of the export pipeline, introducing multi-mesh support, material metadata, and enhanced geometry features for richer 3D engine integration. This roadmap outlines the technical design, implementation phases, and success criteria for delivering these capabilities while maintaining backward compatibility.

## Current State (v0.2.0)

### ✅ Foundation
- Unified topology export (outer + holes combined)
- JSON group metadata with normalization settings
- glTF basic mesh generation
- Strict validation pipeline with field comparison
- Cross-platform CI/CD with comprehensive testing

### ✅ Strengths
- Robust triangulation for complex geometries
- High-precision boolean operations
- Consistent export format with schema validation
- Mature testing infrastructure

### 🔧 Limitations
- Single mesh per group (no separation by role)
- Basic material placeholder system
- Limited metadata for engine integration
- No scene hierarchy support

## Vision for v0.3.0

Transform CADGameFusion from a **geometry exporter** to a **3D asset pipeline**, enabling:
- **Rich scene composition** with logical mesh separation
- **Engine-ready assets** with material and lighting metadata  
- **Production workflows** with version tracking and optimization metrics
- **Extensible architecture** for future 3D standards and features

## Core Features

### 1. Multi-mesh Segmentation 🎯

**Objective**: Enable separate meshes for different geometry types and groups.

#### 1.1 Group-based Mesh Separation
```json
{
  "meshes": [
    {
      "name": "group_0_outer",
      "role": "boundary",
      "groupId": 0,
      "vertices": [...],
      "indices": [...]
    },
    {
      "name": "group_0_holes", 
      "role": "interior",
      "groupId": 0,
      "vertices": [...],
      "indices": [...]
    }
  ]
}
```

#### 1.2 Scene Hierarchy
- glTF node structure for complex assemblies
- Parent-child relationships for grouped geometry
- Transform matrices for positioning and scaling

#### 1.3 Performance Considerations
- Memory impact analysis for large scenes
- Streaming support for massive assemblies
- LOD (Level of Detail) preparation

### 2. Material Stub Mapping 🎨

**Objective**: Automatic material assignment based on geometry properties.

#### 2.1 Intelligent Classification
```json
{
  "materials": [
    {
      "name": "boundary_material",
      "type": "pbr_metallic_roughness",
      "properties": {
        "baseColorFactor": [0.8, 0.8, 0.8, 1.0],
        "metallicFactor": 0.1,
        "roughnessFactor": 0.8
      },
      "autoAssigned": true,
      "sourceHeuristic": "role:boundary"
    }
  ]
}
```

#### 2.2 Extensible System
- Custom material metadata support
- Engine-specific material mappings
- User-defined material rules

### 3. Enhanced Geometry 📐

**Objective**: Richer geometry data for advanced rendering.

#### 3.1 Surface Normals
- Automatic normal generation for smooth shading
- Configurable normal calculation strategies
- Quality vs performance trade-offs

#### 3.2 UV Coordinate Preparation
- Placeholder UV mapping for texture support
- Automated unwrapping algorithms
- Custom UV coordinate injection

#### 3.3 Precision Strategy
- Configurable float32 vs quantization
- Platform-specific optimization
- Memory usage optimization

### 4. Extended Metadata 📊

**Objective**: Comprehensive export tracking and engine integration.

#### 4.1 Export Provenance
```json
{
  "meta": {
    "pipelineVersion": "0.3.0",
    "source": "cli",
    "exportTime": "2025-03-15T14:30:00Z",
    "processing": {
      "exportTimeMs": 1250,
      "triangleCount": 15420,
      "optimizationLevel": "standard"
    }
  }
}
```

#### 4.2 Engine Integration
- Rendering hints and optimization flags
- Physics collision metadata
- Animation-ready structure preparation

### 5. Advanced Features (Future) 🚀

#### 5.1 Animation Support
- Basic assembly motion parameters
- Component transformation tracks
- Timeline-based animation data

#### 5.2 Scene Environment
- Lighting data export
- Camera positioning information
- Environmental metadata

#### 5.3 Compression & Optimization
- File size optimization strategies
- Streaming-friendly formats
- Progressive loading support

## Implementation Strategy

### Phase 1: Research & Design (Q1 2025)

#### Core Deliverables
- [ ] **Technical feasibility study**: Performance analysis and complexity assessment
- [ ] **Schema design**: Extended JSON format specification
- [ ] **glTF extension strategy**: Custom extensions vs standard compliance
- [ ] **Backward compatibility plan**: Migration strategy for existing consumers

#### Research Focus
1. **Multi-mesh complexity**: Memory and performance impact analysis
2. **Material heuristics**: Automatic classification algorithm design
3. **File format evolution**: Versioning and compatibility strategy
4. **Tool compatibility**: Survey of 3D viewer and engine support

### Phase 2: Planning (Q2 2025)

#### Core Deliverables
- [ ] **Detailed implementation roadmap**: Sprint planning and milestone breakdown
- [ ] **API design**: New export parameters and configuration options
- [ ] **Testing strategy**: Extended validation for complex scenarios
- [ ] **UI/UX enhancements**: Qt dialog updates for new features

#### Risk Mitigation
1. **Performance regression**: Benchmark existing workflows
2. **Golden sample churn**: Minimized baseline updates strategy
3. **Complexity management**: Incremental feature rollout plan

### Phase 3: Implementation (Q3-Q4 2025)

#### Sprint Structure
```
Sprint 1-2: Multi-mesh foundation
Sprint 3-4: Material system implementation  
Sprint 5-6: Enhanced geometry features
Sprint 7-8: Extended metadata integration
Sprint 9-10: Performance optimization & testing
Sprint 11-12: Documentation & release preparation
```

#### Quality Gates
- [ ] **No validation pipeline degradation**
- [ ] **Backward compatibility maintained**
- [ ] **Performance within acceptable thresholds**
- [ ] **Comprehensive test coverage**

## Success Criteria

### Technical Metrics
- [ ] **Export time impact**: <25% increase for equivalent scenes
- [ ] **Memory usage**: Linear scaling with mesh complexity
- [ ] **File size**: Reasonable growth with feature richness
- [ ] **Validation coverage**: >95% test coverage for new features

### User Experience
- [ ] **Seamless migration**: Existing workflows work without changes
- [ ] **Clear value proposition**: Demonstrable benefits for 3D workflows
- [ ] **Tool compatibility**: Support in major 3D engines and viewers
- [ ] **Documentation quality**: Comprehensive guides and examples

### Process Excellence
- [ ] **Incremental delivery**: Regular PR cadence with feature toggles
- [ ] **Community feedback**: User testing and iteration cycles
- [ ] **Performance validation**: Continuous benchmarking throughout development
- [ ] **Quality assurance**: Rigorous testing across platforms and scenarios

## Constraints & Considerations

### Technical Constraints
- ✅ **glTF 2.0 compliance**: Maintain standard compatibility
- ✅ **Backward compatibility**: JSON format evolution without breaking changes
- ✅ **Performance**: Export time scaling within acceptable bounds
- ✅ **Cross-platform**: Windows, macOS, Linux support maintained

### Process Constraints  
- ✅ **Incremental delivery**: Feature toggles for gradual rollout
- ✅ **Golden sample stability**: Minimize validation baseline churn
- ✅ **CI/CD reliability**: Maintain strict validation pipeline
- ✅ **Documentation currency**: Keep guides and examples updated

## Risk Assessment

### High Risk
- **Performance regression**: Complex geometry with multi-mesh overhead
- **Memory usage**: Large scenes with numerous mesh separations
- **Complexity creep**: Feature interactions and edge cases

### Medium Risk
- **Tool compatibility**: Varying 3D engine support for extensions
- **Migration complexity**: User workflow adaptation requirements
- **Testing burden**: Expanded test matrix with new feature combinations

### Low Risk
- **Standard compliance**: Well-defined glTF extension mechanisms
- **Community adoption**: Clear value proposition for 3D workflows
- **Technical feasibility**: Proven algorithms and implementation patterns

## Timeline & Milestones

```
2025 Q1: Research & Design
├── Jan: Technical feasibility analysis
├── Feb: Schema design and compatibility planning  
└── Mar: Research findings and design document

2025 Q2: Planning & Preparation
├── Apr: Implementation roadmap and API design
├── May: Testing strategy and UI/UX planning
└── Jun: Development environment setup

2025 Q3: Core Implementation
├── Jul: Multi-mesh foundation and material system
├── Aug: Enhanced geometry and metadata integration
└── Sep: Performance optimization and core testing

2025 Q4: Finalization & Release
├── Oct: Documentation and user guides
├── Nov: Beta testing and community feedback
└── Dec: v0.3.0 release and post-launch support
```

## Related Resources

- **Issue #13**: Meta.normalize unit testing (validation infrastructure)
- **Issue #14**: Ring ordering tests (multi-mesh ordering considerations)
- **Issue #15**: Multi-mesh + metadata extensions planning
- **v0.2.0 baseline**: Current export capabilities and validation
- **docs/API.md**: Current API documentation
- **docs/schemas/**: JSON schema specifications

---

**Document Status**: Draft  
**Last Updated**: September 2025  
**Next Review**: December 2025  
**Maintainer**: CADGameFusion Core Team