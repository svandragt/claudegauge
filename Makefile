PLUGIN_ID := com.vandragt.claudegauge.sdPlugin
PLUGINS_DIR := $(HOME)/.config/opendeck/plugins
DEST := $(PLUGINS_DIR)/$(PLUGIN_ID)

.PHONY: help install uninstall reinstall icons deps test usage logs clean restart

help:
	@echo "Targets:"
	@echo "  deps        - install devbox env + npm deps"
	@echo "  icons       - regenerate gauge SVG and PNG icons"
	@echo "  test        - run usage.js once and print percentages"
	@echo "  install     - copy plugin into OpenDeck plugins dir"
	@echo "  uninstall   - remove plugin from OpenDeck plugins dir"
	@echo "  reinstall   - uninstall + install + restart OpenDeck"
	@echo "  restart     - kill any running OpenDeck and relaunch"
	@echo "  logs        - tail plugin.log"
	@echo "  clean       - remove node_modules and generated icons"

deps:
	devbox install
	devbox run -- npm install --no-audit --no-fund

icons:
	devbox run -- node -e "const {renderGauge}=require('./render.js'); const u=renderGauge({weeklyPct:0.4,sessionPct:0.7}); require('fs').writeFileSync('actions/gauge.svg', Buffer.from(u.split(',')[1],'base64'));"
	convert -background none actions/gauge.svg -resize 144x144 actions/gauge.png
	convert -background none actions/gauge.svg -resize 288x288 actions/gauge@2x.png
	convert -background none actions/gauge.svg -resize 144x144 icon.png
	convert -background none actions/gauge.svg -resize 288x288 icon@2x.png

test usage:
	devbox run -- node usage.js

install:
	mkdir -p "$(PLUGINS_DIR)"
	rm -rf "$(DEST)"
	cp -r . "$(DEST)"
	@echo "Installed to $(DEST)"

uninstall:
	rm -rf "$(DEST)"
	@echo "Removed $(DEST)"

restart:
	-pkill -x opendeck || true
	sleep 1
	(setsid /usr/bin/opendeck --hide >/dev/null 2>&1 < /dev/null &) || true
	@echo "OpenDeck restarted"

reinstall: uninstall install restart

logs:
	tail -f "$(DEST)/plugin.log"

clean:
	rm -rf node_modules actions/gauge.png actions/gauge@2x.png actions/gauge.svg icon.png icon@2x.png
