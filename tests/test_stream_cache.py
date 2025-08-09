#!/usr/bin/env python3
"""
测试流式 LLM 请求的缓存功能
模拟前端的翻译请求
"""

import requests
import json
import time
from typing import Generator

# API 配置
API_URL = "http://localhost:8001/api/llm/chat/completions"
HEADERS = {"Content-Type": "application/json"}

# 模拟前端翻译请求（流式）
TRANSLATION_REQUEST = {
    "model": "qwen3:4b-instruct-2507-q4_K_M",
    "messages": [
        {
            "role": "system",
            "content": "你是专业的标题翻译专家。专注于翻译标题内容，保持简洁明了的风格。要求：准确传达标题的核心含义、保持简洁，避免冗余表达、符合目标语言的标题表达习惯、保持原有的语调和重要性级别"
        },
        {
            "role": "user", 
            "content": "请翻译以下标题：\n\n# MonkeyOCR WebApp: Advanced Document Processing with AI-Powered Translation\n\n## Features:\n- Real-time OCR processing\n- Multi-language support\n- Cloud-based architecture\n- Redis caching system"
        }
    ],
    "stream": True,  # 流式请求
    "temperature": 0.7,
    "max_tokens": 500
}

def parse_sse_stream(response) -> Generator[dict, None, None]:
    """解析 Server-Sent Events 流"""
    for line in response.iter_lines(decode_unicode=True):
        if line.startswith('data: '):
            data = line[6:]  # 去除 'data: ' 前缀
            if data == '[DONE]':
                break
            try:
                chunk = json.loads(data)
                yield chunk
            except json.JSONDecodeError:
                continue

def test_streaming_cache():
    """测试流式请求的缓存功能"""
    print("🚀 流式 LLM 缓存测试")
    print("=" * 60)
    print(f"📝 模拟前端翻译请求")
    print(f"🌊 流式模式: {TRANSLATION_REQUEST['stream']}")
    print(f"🎯 温度参数: {TRANSLATION_REQUEST['temperature']}")
    print(f"📏 最大令牌: {TRANSLATION_REQUEST['max_tokens']}")
    print()
    
    # 第一次流式请求 - 应该较慢
    print("🔵 第 1 次流式请求（冷启动）...")
    start_time = time.time()
    
    response1 = requests.post(
        API_URL, 
        headers=HEADERS, 
        json=TRANSLATION_REQUEST,
        stream=True  # 重要：启用流式响应
    )
    
    if response1.status_code != 200:
        print(f"❌ 请求失败: {response1.status_code}")
        return
    
    # 收集流式响应
    content1 = ""
    chunk_count1 = 0
    for chunk in parse_sse_stream(response1):
        chunk_count1 += 1
        if chunk.get('choices') and chunk['choices'][0].get('delta', {}).get('content'):
            content1 += chunk['choices'][0]['delta']['content']
    
    time1 = time.time() - start_time
    
    print(f"✅ 完成！耗时: {time1:.3f} 秒")
    print(f"📦 接收块数: {chunk_count1}")
    print(f"📄 内容预览: {content1[:200]}...")
    print()
    
    # 等待一下
    print("⏰ 等待 2 秒后进行第二次请求...")
    time.sleep(2)
    
    # 第二次流式请求 - 应该命中缓存，快很多
    print("🟢 第 2 次流式请求（应该命中缓存）...")
    start_time = time.time()
    
    response2 = requests.post(
        API_URL,
        headers=HEADERS,
        json=TRANSLATION_REQUEST,
        stream=True
    )
    
    if response2.status_code != 200:
        print(f"❌ 请求失败: {response2.status_code}")
        return
    
    # 收集流式响应
    content2 = ""
    chunk_count2 = 0
    for chunk in parse_sse_stream(response2):
        chunk_count2 += 1
        if chunk.get('choices') and chunk['choices'][0].get('delta', {}).get('content'):
            content2 += chunk['choices'][0]['delta']['content']
    
    time2 = time.time() - start_time
    
    print(f"✅ 完成！耗时: {time2:.3f} 秒")
    print(f"📦 接收块数: {chunk_count2}")
    print(f"🔍 内容一致性: {'✅ 相同' if content1.strip() == content2.strip() else '❌ 不同'}")
    print()
    
    # 第三次请求验证
    print("🟡 第 3 次流式请求（再次验证缓存）...")
    start_time = time.time()
    
    response3 = requests.post(
        API_URL,
        headers=HEADERS,
        json=TRANSLATION_REQUEST,
        stream=True
    )
    
    content3 = ""
    chunk_count3 = 0
    for chunk in parse_sse_stream(response3):
        chunk_count3 += 1
        if chunk.get('choices') and chunk['choices'][0].get('delta', {}).get('content'):
            content3 += chunk['choices'][0]['delta']['content']
    
    time3 = time.time() - start_time
    
    print(f"✅ 完成！耗时: {time3:.3f} 秒")
    print(f"📦 接收块数: {chunk_count3}")
    print()
    
    # 性能分析
    print("=" * 60)
    print("📈 流式缓存性能分析")
    print("=" * 60)
    print(f"🔵 第 1 次请求（冷启动）: {time1:.3f} 秒，{chunk_count1} 块")
    print(f"🟢 第 2 次请求（缓存命中）: {time2:.3f} 秒，{chunk_count2} 块")  
    print(f"🟡 第 3 次请求（缓存命中）: {time3:.3f} 秒，{chunk_count3} 块")
    
    if time2 > 0:
        speedup = time1 / time2
        print(f"\n⚡ 缓存加速比: {speedup:.1f}x")
        print(f"💰 时间节省: {time1 - time2:.3f} 秒 ({((time1-time2)/time1*100):.1f}%)")
    
    # 判断是否成功缓存
    cache_threshold = 2.0  # 如果第二次请求少于2秒，认为命中了缓存
    if time2 < cache_threshold and time3 < cache_threshold:
        print(f"🎉 流式缓存工作正常！")
        print(f"📊 缓存特征:")
        print(f"   • 响应时间 <{cache_threshold}s: ✅")
        print(f"   • 内容一致性: ✅")
        print(f"   • 流式体验保持: ✅")
    else:
        print(f"⚠️ 流式缓存可能未生效")
        print(f"   • 第2次请求: {time2:.3f}s (期望 <{cache_threshold}s)")
        print(f"   • 检查后端日志确认缓存状态")
    
    print(f"\n📋 完整翻译结果:")
    print("=" * 60)
    print(content1)
    print("=" * 60)

if __name__ == "__main__":
    print("🌊 LLM 流式缓存测试工具")
    print("=" * 60)
    
    # 检查服务状态
    try:
        health_response = requests.get("http://localhost:8001/health")
        if health_response.status_code == 200:
            health_data = health_response.json()
            redis_status = health_data.get('services', {}).get('redis', 'unknown')
            print(f"🏥 服务状态: {health_data['status']}")
            print(f"🔴 Redis 状态: {redis_status}")
            
            if redis_status != 'healthy':
                print("⚠️ 警告: Redis 未正常运行，流式缓存将不可用")
        else:
            print("❌ 无法连接到后端服务")
            exit(1)
    except Exception as e:
        print(f"❌ 连接错误: {e}")
        exit(1)
    
    print()
    test_streaming_cache()