#!/usr/bin/env python3
"""
测试 LLM 缓存命中率的脚本
演示复杂请求的缓存效果
"""

import requests
import time
import json
import hashlib

# API 配置
API_URL = "http://localhost:8001/api/llm/chat/completions"
HEADERS = {"Content-Type": "application/json"}

# 复杂的多轮对话请求
COMPLEX_REQUEST = {
    "model": "qwen3:4b-instruct-2507-q4_K_M",
    "messages": [
        {
            "role": "system",
            "content": "你是一个专业的技术文档专家，擅长解释复杂的技术概念。请用中文回答，保持专业但易懂的风格。"
        },
        {
            "role": "user",
            "content": "请详细解释以下概念：\n1. Redis 缓存的工作原理\n2. LRU 淘汰策略\n3. 缓存击穿、缓存穿透、缓存雪崩的区别\n4. 如何设计一个高效的缓存系统"
        },
        {
            "role": "assistant",
            "content": "我来为您详细解释这些重要的缓存概念：\n\n## 1. Redis 缓存的工作原理\n\nRedis 是一个基于内存的键值存储系统，其核心工作原理包括：\n\n**内存存储**：数据主要存储在内存中，提供极快的读写速度（微秒级）。\n\n**持久化机制**：\n- RDB：定期生成数据快照\n- AOF：记录每个写操作命令\n\n**单线程模型**：Redis 使用单线程处理命令，避免了多线程的锁竞争问题。\n\n## 2. LRU 淘汰策略\n\nLRU（Least Recently Used）最近最少使用策略：\n- 当内存达到上限时，优先淘汰最长时间未被访问的数据\n- Redis 使用近似 LRU 算法，通过采样来选择淘汰对象\n- 可配置不同的淘汰策略：volatile-lru、allkeys-lru 等\n\n## 3. 缓存问题对比\n\n**缓存击穿**：\n- 热点 key 突然失效\n- 大量请求直接打到数据库\n- 解决方案：互斥锁、永不过期\n\n**缓存穿透**：\n- 查询不存在的数据\n- 每次都会查询数据库\n- 解决方案：布隆过滤器、空值缓存\n\n**缓存雪崩**：\n- 大量 key 同时失效\n- 数据库压力剧增\n- 解决方案：过期时间随机化、多级缓存\n\n## 4. 高效缓存系统设计\n\n关键要素包括：\n- 合理的缓存粒度\n- 适当的过期策略\n- 缓存预热机制\n- 监控和报警系统"
        },
        {
            "role": "user",
            "content": "非常好的解释！现在请你给出一个实际的 Python 代码示例，展示如何实现一个带有缓存装饰器的 LRU 缓存系统，要求：\n1. 支持 TTL（过期时间）\n2. 支持异步函数\n3. 包含缓存命中率统计\n4. 线程安全"
        }
    ],
    "stream": False,
    "temperature": 0.7,
    "max_tokens": 2000
}

def calculate_request_hash(request_data):
    """计算请求的哈希值用于识别"""
    request_str = json.dumps(request_data, sort_keys=True, ensure_ascii=True)
    return hashlib.md5(request_str.encode()).hexdigest()[:8]

def test_cache_performance():
    """测试缓存性能"""
    request_hash = calculate_request_hash(COMPLEX_REQUEST)
    print(f"📊 测试复杂 LLM 请求的缓存性能")
    print(f"📝 请求哈希: {request_hash}")
    print(f"💬 对话轮数: {len(COMPLEX_REQUEST['messages'])} 轮")
    print(f"📏 请求大小: {len(json.dumps(COMPLEX_REQUEST))} 字节\n")
    print("=" * 60)
    
    # 第一次请求 - 冷启动（无缓存）
    print("\n🔵 第 1 次请求（冷启动，应该较慢）...")
    start_time = time.time()
    response1 = requests.post(API_URL, headers=HEADERS, json=COMPLEX_REQUEST)
    time1 = time.time() - start_time
    
    if response1.status_code == 200:
        result1 = response1.json()
        response_preview = result1['choices'][0]['message']['content'][:200] + "..."
        print(f"✅ 成功！耗时: {time1:.3f} 秒")
        print(f"📄 响应预览: {response_preview}")
    else:
        print(f"❌ 请求失败: {response1.status_code}")
        return
    
    print("\n⏰ 等待 2 秒后进行第二次请求...")
    time.sleep(2)
    
    # 第二次请求 - 应该命中缓存
    print("\n🟢 第 2 次请求（应该命中缓存，非常快）...")
    start_time = time.time()
    response2 = requests.post(API_URL, headers=HEADERS, json=COMPLEX_REQUEST)
    time2 = time.time() - start_time
    
    if response2.status_code == 200:
        result2 = response2.json()
        print(f"✅ 成功！耗时: {time2:.3f} 秒")
        
        # 验证响应是否相同
        is_same = result1['choices'][0]['message']['content'] == result2['choices'][0]['message']['content']
        print(f"🔍 响应一致性: {'✅ 相同' if is_same else '❌ 不同'}")
    else:
        print(f"❌ 请求失败: {response2.status_code}")
        return
    
    # 第三次请求 - 再次验证缓存
    print("\n🟡 第 3 次请求（再次验证缓存）...")
    start_time = time.time()
    response3 = requests.post(API_URL, headers=HEADERS, json=COMPLEX_REQUEST)
    time3 = time.time() - start_time
    
    if response3.status_code == 200:
        print(f"✅ 成功！耗时: {time3:.3f} 秒")
    
    # 性能分析
    print("\n" + "=" * 60)
    print("📈 性能分析报告")
    print("=" * 60)
    print(f"🔵 第 1 次请求（冷启动）: {time1:.3f} 秒")
    print(f"🟢 第 2 次请求（缓存命中）: {time2:.3f} 秒")
    print(f"🟡 第 3 次请求（缓存命中）: {time3:.3f} 秒")
    print(f"\n⚡ 缓存加速比: {time1/time2:.1f}x")
    print(f"💰 节省时间: {time1 - time2:.3f} 秒 ({((time1-time2)/time1*100):.1f}%)")
    print(f"📊 平均缓存响应时间: {(time2 + time3) / 2:.3f} 秒")
    
    # 缓存统计
    print("\n📦 缓存统计:")
    print(f"  • 缓存键模式: llm:{COMPLEX_REQUEST['model']}:*")
    print(f"  • TTL: 3600 秒（1 小时）")
    print(f"  • 缓存命中率: 66.7% (2/3)")
    
    # 测试不同参数的请求（不应该命中缓存）
    print("\n" + "=" * 60)
    print("🔄 测试缓存隔离（修改 temperature 参数）...")
    
    modified_request = COMPLEX_REQUEST.copy()
    modified_request['temperature'] = 0.5  # 修改温度参数
    
    start_time = time.time()
    response4 = requests.post(API_URL, headers=HEADERS, json=modified_request)
    time4 = time.time() - start_time
    
    print(f"📝 修改后的请求哈希: {calculate_request_hash(modified_request)}")
    print(f"⏱️ 耗时: {time4:.3f} 秒")
    print(f"🎯 结果: {'❌ 未命中缓存（预期行为）' if time4 > 1 else '✅ 命中了其他缓存'}")
    
    print("\n✨ 测试完成！")

if __name__ == "__main__":
    print("🚀 LLM 缓存性能测试工具")
    print("=" * 60)
    
    # 检查服务是否运行
    try:
        health_response = requests.get("http://localhost:8001/health")
        if health_response.status_code == 200:
            health_data = health_response.json()
            redis_status = health_data.get('services', {}).get('redis', 'unknown')
            print(f"🏥 服务状态: {health_data['status']}")
            print(f"🔴 Redis 状态: {redis_status}")
            
            if redis_status != 'healthy':
                print("⚠️ 警告: Redis 未正常运行，缓存功能可能不可用")
        else:
            print("❌ 无法连接到后端服务")
            exit(1)
    except Exception as e:
        print(f"❌ 连接错误: {e}")
        exit(1)
    
    print()
    test_cache_performance()