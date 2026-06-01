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

clean:
	rm -f target/debug/net.nosial.federationweb.ncc
	rm -f target/release/net.nosial.federationweb.ncc
	rm -f target/web_release/net.nosial.federationweb.ncc

.PHONY: all install clean docker-build docker-up docker-down docker-restart docker-logs