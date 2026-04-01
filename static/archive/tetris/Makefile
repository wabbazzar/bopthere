.PHONY: serve force-serve play device-test clean-cache start help

# Mobile-ready development server
serve:
	@echo "Starting Tetris Turbo Mobile server on http://localhost:8000"
	@echo "For mobile device testing, use your local IP address"
	@python3 -m http.server 8000 --bind 0.0.0.0 || python -m http.server 8000

# Force start server (kills existing server first)
force-serve:
	@echo "Stopping any existing servers..."
	@pkill -f "python.*http.server" || true
	@sleep 1
	@echo "Starting Tetris Turbo Mobile server on http://localhost:8000"
	@echo "For mobile device testing, use your local IP address"
	@python3 -m http.server 8000

# Open Tetris Turbo (auto-detects mobile/desktop)
play:
	@echo "Opening Tetris Turbo..."
	@open http://localhost:8000/ || xdg-open http://localhost:8000/

# Mobile device testing info
device-test:
	@echo "Connect mobile device and navigate to:"
	@echo "http://$(shell ifconfig | grep 'inet ' | grep -v 127.0.0.1 | head -1 | awk '{print $$2}' || echo 'localhost'):8000/"
	@echo ""
	@echo "Mobile features:"
	@echo "  • Touch controls + gesture recognition"
	@echo "  • PWA installation support"
	@echo "  • Offline gameplay capability"
	@echo "  • Haptic feedback (where supported)"

# Cache management
clean-cache:
	@echo "Browser cache clear: Ctrl+Shift+R (Win/Linux) or Cmd+Shift+R (Mac)"
	@echo "Mobile Safari: Settings > Safari > Clear History and Website Data"
	@echo "Chrome Mobile: Menu > History > Clear browsing data"

# Quick start
start: serve

# Help
help:
	@echo "Tetris Turbo Mobile Edition - Available commands:"
	@echo ""
	@echo "  make serve       - Start mobile-ready development server"
	@echo "  make force-serve - Force start server (kills existing first)"
	@echo "  make play        - Open Tetris Turbo (auto-detects mobile/desktop)"
	@echo "  make device-test - Show mobile device connection info"
	@echo "  make clean-cache - Cache clearing instructions"
	@echo "  make start       - Quick start (same as serve)"
	@echo ""
	@echo "Mobile features: Touch controls, gestures, PWA, offline play" 