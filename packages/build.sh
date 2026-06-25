#!/bin/bash

# Build and test script for the arcana-core packages.
# Builds every library (dependencies first), then runs their test suites.

# Don't exit on error - we want to continue and show a summary.
set +e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "Building and Testing Packages"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BUILD_COUNT=0
BUILD_PASS=0
BUILD_FAIL=0
TEST_COUNT=0
TEST_PASS=0
TEST_FAIL=0

run_build() {
    local project_name="$1"
    local project_path="$2"

    BUILD_COUNT=$((BUILD_COUNT + 1))
    echo -e "${BLUE}[BUILD $BUILD_COUNT] Building: $project_name${NC}"
    echo -e "${BLUE}  Path: $project_path${NC}"
    echo ""

    if (cd "$project_path" && npm install --silent --no-package-lock && npm run build); then
        echo ""
        echo -e "${GREEN}✓ BUILD PASS: $project_name${NC}"
        BUILD_PASS=$((BUILD_PASS + 1))
        echo ""
        return 0
    else
        echo ""
        echo -e "${RED}✗ BUILD FAIL: $project_name${NC}"
        BUILD_FAIL=$((BUILD_FAIL + 1))
        echo ""
        return 1
    fi
}

run_test() {
    local test_name="$1"
    local test_path="$2"

    TEST_COUNT=$((TEST_COUNT + 1))
    echo -e "${YELLOW}[TEST $TEST_COUNT] Running: $test_name${NC}"
    echo -e "${YELLOW}  Path: $test_path${NC}"
    echo ""

    if (cd "$test_path" && npm install --silent --no-package-lock && npm test); then
        echo ""
        echo -e "${GREEN}✓ TEST PASS: $test_name${NC}"
        TEST_PASS=$((TEST_PASS + 1))
        echo ""
        return 0
    else
        echo ""
        echo -e "${RED}✗ TEST FAIL: $test_name${NC}"
        TEST_FAIL=$((TEST_FAIL + 1))
        echo ""
        return 1
    fi
}

# Step 1: Build libraries (dependencies first)
echo "=========================================="
echo "Step 1: Building Libraries"
echo "=========================================="
echo ""

run_build "@arcanahq/core" "core"
run_build "@arcanahq/cardgames" "cardgames"
run_build "@arcanahq/sdk" "sdk"
run_build "@arcanahq/sdk-integrations" "sdk-integrations"

# Step 2: Run test suites
echo "=========================================="
echo "Step 2: Running Tests"
echo "=========================================="
echo ""

run_test "@arcanahq/core" "core"
run_test "@arcanahq/cardgames" "cardgames"
run_test "@arcanahq/sdk" "sdk"

# Summary
echo "=========================================="
echo "Build and Test Summary"
echo "=========================================="
echo ""
echo "Builds:"
echo -e "  Total: $BUILD_COUNT"
echo -e "  ${GREEN}Passed: $BUILD_PASS${NC}"
if [ $BUILD_FAIL -gt 0 ]; then
    echo -e "  ${RED}Failed: $BUILD_FAIL${NC}"
else
    echo -e "  ${GREEN}Failed: $BUILD_FAIL${NC}"
fi
echo ""
echo "Tests:"
echo -e "  Total: $TEST_COUNT"
echo -e "  ${GREEN}Passed: $TEST_PASS${NC}"
if [ $TEST_FAIL -gt 0 ]; then
    echo -e "  ${RED}Failed: $TEST_FAIL${NC}"
else
    echo -e "  ${GREEN}Failed: $TEST_FAIL${NC}"
fi
echo ""

# Exit with error if any quality gate failed
if [ $BUILD_FAIL -gt 0 ] || [ $TEST_FAIL -gt 0 ]; then
    echo -e "${RED}Some quality gates failed!${NC}"
    exit 1
else
    echo -e "${GREEN}All quality gates passed!${NC}"
    exit 0
fi
