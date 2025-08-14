#!/bin/bash

BUILDER_NAME="multibuilder"
IMAGE_NAME="quantatrisk/monkeyocr-webapp"

# 检查 builder 是否存在
if ! docker buildx ls | grep -q $BUILDER_NAME; then
    echo "创建新的 builder..."
    docker buildx create --use --name $BUILDER_NAME \
        --driver docker-container \
        --driver-opt image=moby/buildkit:buildx-stable-1 \
        --bootstrap
else
    echo "使用现有 builder..."
    docker buildx use $BUILDER_NAME
fi

# 构建并推送，使用 registry 缓存
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --cache-from type=registry,ref=$IMAGE_NAME:buildcache \
    --cache-from type=registry,ref=$IMAGE_NAME:latest \
    --cache-to type=registry,ref=$IMAGE_NAME:buildcache,mode=max \
    -t $IMAGE_NAME:latest \
    --push .

# 不要删除 builder！
# docker buildx rm multibuilder
