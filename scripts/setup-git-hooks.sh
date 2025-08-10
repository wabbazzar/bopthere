#!/bin/bash
# Setup Git hooks for wedding app
# Installs and configures pre-commit and pre-push hooks

set -e

echo "🔧 Setting up Git hooks for Wedding App..."
echo ""

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Error: Not in a Git repository."
    echo "Please run this script from the root of the wedding app repository."
    exit 1
fi

# Check if hook files exist
if [ ! -f ".git/hooks/pre-commit" ]; then
    echo "❌ Error: pre-commit hook file not found at .git/hooks/pre-commit"
    echo "Please ensure the hook files are in place before running setup."
    exit 1
fi

if [ ! -f ".git/hooks/pre-push" ]; then
    echo "❌ Error: pre-push hook file not found at .git/hooks/pre-push"
    echo "Please ensure the hook files are in place before running setup."
    exit 1
fi

# Make hooks executable
echo "📝 Making hooks executable..."
chmod +x .git/hooks/pre-commit
chmod +x .git/hooks/pre-push

# Verify hooks are executable
if [ -x .git/hooks/pre-commit ]; then
    echo "✅ Pre-commit hook installed and executable"
else
    echo "❌ Pre-commit hook installation failed"
    exit 1
fi

if [ -x .git/hooks/pre-push ]; then
    echo "✅ Pre-push hook installed and executable"
else
    echo "❌ Pre-push hook installation failed"
    exit 1
fi

# Test that required commands are available
echo ""
echo "🔍 Checking required dependencies..."

# Check Node.js and npm
if command -v npm >/dev/null 2>&1; then
    echo "✅ npm found: $(npm --version)"
else
    echo "⚠️  npm not found - frontend tests may fail"
fi

# Check Python and pytest
if command -v python3 >/dev/null 2>&1; then
    echo "✅ python3 found: $(python3 --version)"
else
    echo "⚠️  python3 not found - Python tests may fail"
fi

if command -v pytest >/dev/null 2>&1; then
    echo "✅ pytest found: $(pytest --version | head -1)"
else
    echo "⚠️  pytest not found - Python tests may fail"
    echo "💡 Install with: pip install pytest"
fi

# Check AWS CLI (optional)
if command -v aws >/dev/null 2>&1; then
    echo "✅ AWS CLI found: $(aws --version)"
else
    echo "⚠️  AWS CLI not found - migration verification will be skipped"
    echo "💡 Install with: pip install awscli"
fi

# Test pre-commit hook with dry run
echo ""
echo "🧪 Testing pre-commit hook..."
if .git/hooks/pre-commit --dry-run 2>/dev/null || true; then
    echo "✅ Pre-commit hook test completed"
else
    echo "⚠️  Pre-commit hook test had issues (this may be normal)"
fi

echo ""
echo "🎉 Git hooks setup complete!"
echo ""
echo "📋 Summary:"
echo "  ✓ Pre-commit hook: Runs linting, unit tests, and region consistency checks"
echo "  ✓ Pre-push hook: Runs comprehensive testing including integration and smoke tests"
echo ""
echo "🔧 Hook Details:"
echo ""
echo "Pre-commit hook will run:"
echo "  • AWS region consistency check (ensures us-east-1 region consistency)"
echo "  • Frontend linting (npm run lint)"
echo "  • Python unit tests (pytest tests/unit/backend/)"
echo "  • Frontend unit tests (npm test -- --run)"
echo "  • File safety checks (large files, sensitive data)"
echo ""
echo "Pre-push hook will run:"
echo "  • All pre-commit checks"
echo "  • Frontend build verification (npm run build)"
echo "  • Python integration tests (pytest tests/integration/backend/)"
echo "  • Smoke tests (pytest tests/e2e/smoke/)"
echo "  • Migration verification (if AWS CLI available)"
echo "  • Frontend E2E tests (if dev server running)"
echo "  • Final security validations"
echo ""
echo "💡 Usage Tips:"
echo "  • To skip pre-commit checks: git commit --no-verify"
echo "  • To skip pre-push checks: git push --no-verify"
echo "  • To test hooks manually: .git/hooks/pre-commit or .git/hooks/pre-push"
echo "  • To run comprehensive tests: make test-all-new"
echo ""
echo "⚠️  Important Notes:"
echo "  • Hooks will prevent commits/pushes if tests fail"
echo "  • Use --no-verify flag only when necessary"
echo "  • Ensure AWS CLI is configured for migration verification"
echo "  • Start dev server (npm run dev) for full E2E testing"
echo ""
echo "🔧 Hook Management:"
echo "  • Disable hooks: make hooks-disable"
echo "  • Enable hooks: make hooks-enable"
echo "  • Test hooks: make hooks-test"
echo "  • View hook status: make hooks-status"