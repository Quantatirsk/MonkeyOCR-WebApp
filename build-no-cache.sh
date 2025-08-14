#!/bin/bash

BUILDER_NAME="multibuilder"
IMAGE_NAME="quantatrisk/monkeyocr-webapp"

echo "创建新的 builder..."
docker buildx create --use --name $BUILDER_NAME \
    --driver docker-container \
    --driver-opt image=moby/buildkit:buildx-stable-1 \
    --bootstrap


# 构建并推送（无缓存版本）
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --no-cache \
    -t $IMAGE_NAME:latest \
    --push .

# 不要删除 builder！
# docker buildx rm multibuilder
