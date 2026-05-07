.PHONY: build clean lint install-temp version release

NAME := $(shell python3 -c "import json;print(json.load(open('manifest.json'))['name'].replace(' ','-').lower())")
VERSION := $(shell python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
XPI := dist/$(NAME)-$(VERSION).xpi

build: $(XPI)

$(XPI): manifest.json popup.html popup.css popup.js background.js $(wildcard icons/*)
	@bash scripts/package.sh

clean:
	rm -rf dist

lint:
	@python3 -m json.tool manifest.json > /dev/null && echo "manifest.json: ok"
	@command -v web-ext >/dev/null 2>&1 && web-ext lint --source-dir . || echo "(install web-ext for full linting: npm i -g web-ext)"

version:
	@echo "$(NAME) $(VERSION)"

install-temp:
	@echo "Open about:debugging#/runtime/this-firefox in Firefox,"
	@echo "click 'Load Temporary Add-on…' and select:"
	@echo "  $(CURDIR)/manifest.json"

TAG ?= v$(VERSION)
RELEASE_NOTES ?=

release:
	@if [ -z "$(SIGNED_XPI)" ]; then \
		echo "error: SIGNED_XPI is required"; \
		echo "usage: make release SIGNED_XPI=/path/to/signed.xpi [TAG=v$(VERSION)] [RELEASE_NOTES=notes.md]"; \
		exit 1; \
	fi
	@if [ ! -f "$(SIGNED_XPI)" ]; then \
		echo "error: signed xpi not found: $(SIGNED_XPI)"; exit 1; \
	fi
	@command -v gh >/dev/null || { echo "error: gh not installed"; exit 1; }
	@if [ -n "$$(git status --porcelain)" ]; then \
		echo "error: working tree is dirty; commit or stash before releasing"; exit 1; \
	fi
	@if git rev-parse "$(TAG)" >/dev/null 2>&1; then \
		echo "tag $(TAG) already exists; skipping tag creation"; \
	else \
		echo "creating tag $(TAG)"; \
		git tag -a "$(TAG)" -m "Release $(TAG)"; \
		git push origin "$(TAG)"; \
	fi
	@ASSET="$(NAME)-$(VERSION).xpi"; \
	TMP="$$(mktemp -d)"; \
	cp "$(SIGNED_XPI)" "$$TMP/$$ASSET"; \
	if gh release view "$(TAG)" >/dev/null 2>&1; then \
		echo "uploading $$ASSET to existing release $(TAG)"; \
		gh release upload "$(TAG)" "$$TMP/$$ASSET" --clobber; \
	else \
		echo "creating release $(TAG) with $$ASSET"; \
		if [ -n "$(RELEASE_NOTES)" ] && [ -f "$(RELEASE_NOTES)" ]; then \
			gh release create "$(TAG)" "$$TMP/$$ASSET" --title "$(TAG)" --notes-file "$(RELEASE_NOTES)"; \
		else \
			gh release create "$(TAG)" "$$TMP/$$ASSET" --title "$(TAG)" --generate-notes; \
		fi; \
	fi; \
	rm -rf "$$TMP"
