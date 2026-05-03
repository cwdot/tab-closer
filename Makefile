.PHONY: build clean lint install-temp version

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
