#!/bin/bash

docker buildx create --use --name multibuilder --driver docker-container --bootstrap
docker buildx build --platform linux/amd64,linux/arm64 --cache-from type=registry,ref=quantatrisk/monkeyocr-webapp:latest -t harbor.vect.one/quantatrisk/monkeyocr-webapp:latest --push .
docker buildx rm multibuilder