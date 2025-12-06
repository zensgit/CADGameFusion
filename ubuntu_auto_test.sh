#!/bin/bash
# CADGameFusion Qt Editor Automated Test Script for Ubuntu/Linux
# Requires: xdotool, imagemagick (import), optional: xvfb

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_PATH="./editor/qt/editor_qt"
TEST_DIR="test_results_$(date +%Y%m%d_%H%M%S)"
LOG_FILE="$TEST_DIR/test.log"

# Create test directory
mkdir -p "$TEST_DIR"
echo "Test results will be saved in: $TEST_DIR"

# Function to log messages
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

# Function to take screenshot
screenshot() {
    local name=$1
    local window_id=$2
    import -window "$window_id" "$TEST_DIR/$name.png"
    log "${GREEN}✓${NC} Screenshot saved: $name.png"
}

# Function to check window title
check_title() {
    local window_id=$1
    local expected=$2
    local title=$(xdotool getwindowname "$window_id")
    if [[ "$title" == *"$expected"* ]]; then
        log "${GREEN}✓${NC} Title check passed: $title"
        return 0
    else
        log "${RED}✗${NC} Title check failed. Expected: '$expected', Got: '$title'"
        return 1
    fi
}

# Start the application
log "${YELLOW}Starting CADGameFusion Qt Editor...${NC}"
$APP_PATH > "$TEST_DIR/app_output.log" 2>&1 &
APP_PID=$!
sleep 3

# Get window ID
WINDOW_ID=$(xdotool search --name "CADGameFusion" | head -1)
if [ -z "$WINDOW_ID" ]; then
    log "${RED}Failed to find application window!${NC}"
    exit 1
fi
log "${GREEN}✓${NC} Application started (PID: $APP_PID, Window: $WINDOW_ID)"

# Activate window
xdotool windowactivate "$WINDOW_ID"
xdotool windowraise "$WINDOW_ID"
sleep 1

# Test 1: Initial State
log "\n${YELLOW}Test 1: Initial State${NC}"
screenshot "01_initial_state" "$WINDOW_ID"
check_title "$WINDOW_ID" "untitled.cgf - CADGameFusion Editor"

# Test 2: Add Polyline (should add asterisk)
log "\n${YELLOW}Test 2: Add Polyline - Dirty State${NC}"
# Click Add Polyline button (adjust coordinates based on your UI)
xdotool mousemove --window "$WINDOW_ID" 135 105
xdotool click 1
sleep 1
screenshot "02_after_add_polyline" "$WINDOW_ID"
check_title "$WINDOW_ID" "untitled.cgf*"

# Test 3: Undo (should remove asterisk)
log "\n${YELLOW}Test 3: Undo - Clean State${NC}"
xdotool key --window "$WINDOW_ID" ctrl+z
sleep 1
screenshot "03_after_undo" "$WINDOW_ID"
check_title "$WINDOW_ID" "untitled.cgf - CADGameFusion Editor"

# Test 4: Redo (should add asterisk again)
log "\n${YELLOW}Test 4: Redo - Dirty Again${NC}"
xdotool key --window "$WINDOW_ID" ctrl+shift+z
sleep 1
screenshot "04_after_redo" "$WINDOW_ID"
check_title "$WINDOW_ID" "untitled.cgf*"

# Test 5: Triangulate
log "\n${YELLOW}Test 5: Triangulate${NC}"
# Click Triangulate button
xdotool mousemove --window "$WINDOW_ID" 235 105
xdotool click 1
sleep 1
screenshot "05_after_triangulate" "$WINDOW_ID"

# Test 6: Multiple Polylines for Multi-select
log "\n${YELLOW}Test 6: Multiple Polylines${NC}"
# Clear first
xdotool key --window "$WINDOW_ID" ctrl+n
sleep 0.5
xdotool key --window "$WINDOW_ID" Tab  # Dismiss dialog if any
xdotool key --window "$WINDOW_ID" Return
sleep 1

# Add 3 polylines
for i in {1..3}; do
    xdotool mousemove --window "$WINDOW_ID" 135 105
    xdotool click 1
    sleep 0.5
done
screenshot "06_three_polylines" "$WINDOW_ID"

# Test 7: Select one polyline
log "\n${YELLOW}Test 7: Single Selection${NC}"
xdotool mousemove --window "$WINDOW_ID" 300 300  # Click on canvas
xdotool click 1
sleep 1
screenshot "07_single_selection" "$WINDOW_ID"

# Test 8: Multi-select with Shift
log "\n${YELLOW}Test 8: Multi Selection${NC}"
xdotool keydown shift
xdotool mousemove --window "$WINDOW_ID" 350 350
xdotool click 1
xdotool mousemove --window "$WINDOW_ID" 400 400
xdotool click 1
xdotool keyup shift
sleep 1
screenshot "08_multi_selection" "$WINDOW_ID"

# Test 9: Help -> About Core
log "\n${YELLOW}Test 9: About Core Dialog${NC}"
xdotool key --window "$WINDOW_ID" alt+h
sleep 0.5
xdotool key a
sleep 1
screenshot "09_about_core" root  # Capture whole screen for dialog
xdotool key --window "$WINDOW_ID" Return  # Close dialog

# Test 10: Boolean (should show CLIPPER2 message)
log "\n${YELLOW}Test 10: Boolean Operation${NC}"
xdotool mousemove --window "$WINDOW_ID" 320 105  # Boolean button
xdotool click 1
sleep 1
screenshot "10_boolean_result" "$WINDOW_ID"

# Test 11: Offset (should show CLIPPER2 message)
log "\n${YELLOW}Test 11: Offset Operation${NC}"
xdotool mousemove --window "$WINDOW_ID" 392 105  # Offset button
xdotool click 1
sleep 1
screenshot "11_offset_result" "$WINDOW_ID"

# Test 12: Save As
log "\n${YELLOW}Test 12: Save As Dialog${NC}"
xdotool key --window "$WINDOW_ID" ctrl+shift+s
sleep 1
screenshot "12_save_dialog" root
xdotool key --window "$WINDOW_ID" Escape  # Cancel save

# Clean up
log "\n${YELLOW}Cleaning up...${NC}"
kill $APP_PID 2>/dev/null || true

# Generate summary report
log "\n${YELLOW}Generating summary report...${NC}"
cat > "$TEST_DIR/SUMMARY.md" << EOF
# Automated Test Summary

**Date**: $(date)
**Test Directory**: $TEST_DIR

## Test Results

| Test | Description | Screenshot |
|------|-------------|------------|
| 1 | Initial State | 01_initial_state.png |
| 2 | Add Polyline (Dirty) | 02_after_add_polyline.png |
| 3 | Undo (Clean) | 03_after_undo.png |
| 4 | Redo (Dirty) | 04_after_redo.png |
| 5 | Triangulate | 05_after_triangulate.png |
| 6 | Multiple Polylines | 06_three_polylines.png |
| 7 | Single Selection | 07_single_selection.png |
| 8 | Multi Selection | 08_multi_selection.png |
| 9 | About Core Dialog | 09_about_core.png |
| 10 | Boolean Operation | 10_boolean_result.png |
| 11 | Offset Operation | 11_offset_result.png |
| 12 | Save Dialog | 12_save_dialog.png |

## Log Files
- Application output: app_output.log
- Test log: test.log

EOF

log "${GREEN}✓${NC} Summary report generated: $TEST_DIR/SUMMARY.md"
log "${GREEN}✓${NC} All tests completed!"
log "\nView results: cd $TEST_DIR && ls -la"