# STEP190 Editor Property Provenance Verification

## 范围
验证 editor property provenance 收口是否满足以下合同：
- `color_source/color_aci` 进入 live model
- property panel 单选时显示 provenance hints
- `copy/offset` 不保留 imported color provenance
- editor-created / editor-promoted color 导出为显式 `TRUECOLOR`

## Node 合同验证
命令：

```bash
node --check tools/web_viewer/adapters/cadgf_document_adapter.js
node --check tools/web_viewer/state/documentState.js
node --check tools/web_viewer/ui/property_panel.js
git diff --check
node --test tools/web_viewer/tests/editor_commands.test.js
```

结果：
- `node --check` 全部通过
- `git diff --check` 通过
- `node --test tools/web_viewer/tests/editor_commands.test.js`:
  - `166/166 PASS`
  - 新增覆盖：
    - `cadgf adapter imports color provenance and exports explicit color edits`
    - `exportCadgfDocument emits explicit color provenance for editor-created entities`
    - `selection.copy clears imported assembly provenance on created entity` 扩展到 color provenance
    - `selection.offset clears imported assembly provenance on created entity` 扩展到 color provenance

## 浏览器验证
fixture：
- `build_fix/convert_cli_block_instances_smoke/document.json`

最小验证路径：
1. 本地启动静态服务：

```bash
python3 -m http.server 8124 --bind 127.0.0.1
```

2. 打开：

```text
http://127.0.0.1:8124/tools/web_viewer/?mode=editor&debug=1&cadgf=/build_fix/convert_cli_block_instances_smoke/document.json
```

3. 选中导入 line（entity id=1）后读取 property panel：

```json
{
  "summary": "1 selected (line)",
  "rows": [
    "Color Source: BYLAYER",
    "Color ACI: 8",
    "Space: Model",
    "Line Type: HIDDEN2",
    "Line Weight: 0.55",
    "Line Type Scale: 1.7"
  ],
  "colorValue": "#808080"
}
```

4. 将 `Layer ID` 从 `0` 改成 `1` 后再次读取 property panel：

```json
{
  "summary": "1 selected (line)",
  "rows": [
    "Color Source: TRUECOLOR",
    "Space: Model",
    "Line Type: HIDDEN2",
    "Line Weight: 0.55",
    "Line Type Scale: 1.7"
  ],
  "colorValue": "#808080",
  "entity": {
    "id": 1,
    "layerId": 1,
    "color": "#808080",
    "colorSource": "TRUECOLOR"
  }
}
```

结论：
- imported provenance 在单选 property panel 中可见
- layer 编辑后 provenance 被诚实提升为 explicit `TRUECOLOR`
- effective color 未丢失

## 备注
- 本轮未重跑 `tools/ci_editor_light.sh` 全链路，因为当前 full UI smoke 仍有独立的历史脆点，与这次 provenance 收口不是同一问题。
- 这轮验证重点是 contract 正确性，不是 full gate 稳态化。
