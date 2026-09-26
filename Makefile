all: target/debug/net.nosial.federationweb.ncc target/release/net.nosial.federationweb.ncc target/web_release/net.nosial.federationweb.ncc
target/debug/net.nosial.federationweb.ncc:
	ncc build --configuration debug --log-level debug
target/release/net.nosial.federationweb.ncc:
	ncc build --configuration release --log-level debug
target/web_release/net.nosial.federationweb.ncc:
	ncc build --configuration web_release --log-level debug

docker-build:
	docker build -t net.nosial.federationweb:1.0.0 .

docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-restart:
	docker compose down && docker compose up -d

docker-logs:
	docker compose logs -f

configure:
	ncc project stubs

clean:
	npm run clean
	rm -rf src/WebResources/css src/WebResources/vendor src/WebResources/js/app.js src/WebResources/js/nav.js
	rm -rf vendor target package-lock.json node_modules

.PHONY: all install clean docker-build docker-up docker-down docker-restart docker-logs configure