#!/bin/bash

# Test Leaderboard Integration End-to-End
echo "🎮 Testing Tournament Leaderboard Integration"
echo "============================================"

# Check if dev server is running
if ! curl -s http://localhost:8080 > /dev/null; then
    echo "❌ Dev server not running. Start it with: npm run dev"
    exit 1
fi

echo "✅ Dev server is running"

# Test API endpoint
echo ""
echo "📡 Testing API endpoints..."

# Test GET leaderboard
echo -n "Testing GET /leaderboard/tetris... "
RESPONSE=$(curl -s -w "\n%{http_code}" https://heatherandwesley.solarsubmarine.com/api/leaderboard/tetris)
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" == "200" ]; then
    echo "✅ Success"
    echo "Response: $BODY" | head -c 100
    echo "..."
else
    echo "❌ Failed with HTTP $HTTP_CODE"
fi

# Test with some data
echo ""
echo "📊 Adding test data to leaderboard..."

# Create a test JWT token (you'll need to replace this with a valid token)
AUTH_TOKEN="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoidGVzdF91c2VyIiwidXNlcm5hbWUiOiJUZXN0IFVzZXIiLCJleHAiOjk5OTk5OTk5OTl9.test"

# Submit a test score
curl -s -X POST https://heatherandwesley.solarsubmarine.com/api/leaderboard \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "game": "tetris",
    "score": 12345,
    "character": "wesley"
  }' || echo "Note: Score submission requires valid auth token"

echo ""
echo ""
echo "🧪 Running Playwright test..."
if command -v npx &> /dev/null; then
    npx playwright test tests/e2e/playwright/test-leaderboard-quick.spec.ts --reporter=list
else
    echo "⚠️  Playwright not installed. Run: npm install -D @playwright/test"
fi

echo ""
echo "✨ Integration test complete!"
echo ""
echo "To manually test:"
echo "1. Go to http://localhost:8080"
echo "2. Select a character"
echo "3. Log in with test credentials"
echo "4. Navigate to Games tab"
echo "5. Click Tournament Leaderboard"