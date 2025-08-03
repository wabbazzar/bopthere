#!/bin/bash

# Leaderboard Navigation Debug Test Runner
# This script runs the comprehensive Playwright test to debug the leaderboard navigation issue

set -e

echo "🔍 Leaderboard Navigation Debug Test Runner"
echo "=========================================="

# Check if development server is running
echo "📡 Checking if development server is running..."
if curl -s http://localhost:5173 > /dev/null; then
    echo "✅ Development server is running on http://localhost:5173"
else
    echo "❌ Development server is not running!"
    echo "Please start it with: npm run dev"
    echo "Then run this script again."
    exit 1
fi

# Check if API is accessible
echo "🌐 Checking API accessibility..."
API_URL="https://4q7jj56io8.execute-api.us-east-1.amazonaws.com/prod"
if curl -s "${API_URL}/leaderboard/tetris" > /dev/null; then
    echo "✅ API is accessible at ${API_URL}"
else
    echo "⚠️  API might not be accessible - test will still run but may have limited functionality"
fi

# Ensure debug directory exists
echo "📁 Creating debug directory..."
mkdir -p debug

# Install Playwright if needed
echo "🎭 Checking Playwright installation..."
if ! npx playwright --version > /dev/null 2>&1; then
    echo "Installing Playwright..."
    npx playwright install chromium
fi

# Run the debug test
echo "🚀 Running leaderboard navigation debug test..."
echo ""

# Run with detailed output
npx playwright test tests/e2e/playwright/test-leaderboard-navigation.spec.ts \
    --headed \
    --max-failures=1 \
    --output=test-results \
    --reporter=line

echo ""
echo "📊 Test Results:"
echo "================"

# Check if test passed
if [ $? -eq 0 ]; then
    echo "✅ Test completed successfully"
else
    echo "❌ Test encountered issues (expected - this helps debug the problem)"
fi

# Show debug output locations
echo ""
echo "🗂️  Debug Output:"
echo "=================="
echo "Screenshots: debug/*.png"
echo "Test results: test-results/"
echo "Console logs: Check terminal output above"

echo ""
echo "📝 Next Steps:"
echo "=============="
echo "1. Review the debug screenshots in debug/ directory"
echo "2. Check the console logs above for detailed debugging info"
echo "3. Review the README in tests/e2e/playwright/README.md for fix recommendations"
echo "4. Implement the recommended fix"
echo "5. Re-run this script to verify the fix"

echo ""
echo "🔧 Recommended Fix:"
echo "=================="
echo "The issue is that LeaderboardDisplay expects theme.fonts but CharacterContext doesn't provide it."
echo "See tests/e2e/playwright/README.md for detailed fix options."