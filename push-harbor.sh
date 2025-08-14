#!/bin/bash

BUILDER_NAME="multibuilder"
HARBOR_IMAGE="harbor.vect.one/quantatrisk/monkeyocr-webapp"
DOCKERHUB_IMAGE="quantatrisk/monkeyocr-webapp"

# 检查并复用 builder
if ! docker buildx ls | grep -q "^$BUILDER_NAME "; then
    echo "创建新的 builder..."
    docker buildx create --use --name $BUILDER_NAME \
        --driver docker-container \
        --bootstrap
else
    echo "使用现有 builder..."
    docker buildx use $BUILDER_NAME
fi

# 构建并推送到 Harbor
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --cache-from type=registry,ref=$DOCKERHUB_IMAGE:latest \
    --cache-from type=registry,ref=$HARBOR_IMAGE:latest \
    --cache-from type=registry,ref=$HARBOR_IMAGE:buildcache \
    --cache-to type=registry,ref=$HARBOR_IMAGE:buildcache,mode=max \
    -t $HARBOR_IMAGE:latest \
    --push .

# 不要删除 builder！
# docker buildx rm multibuilder
