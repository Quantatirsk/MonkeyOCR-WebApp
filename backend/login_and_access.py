#!/usr/bin/env python3
"""
登录并访问私有文件
"""
import asyncio
import aiohttp
import getpass

BASE_URL = "http://localhost:8001"
TASK_ID = "38442560-1308-4574-afe4-00f98ea3edc9"

async def login_and_access():
    """登录并访问文件"""
    print("\n" + "="*60)
    print("登录并访问私有文件")
    print("="*60)
    
    # 文件所有者信息
    print("\n文件所有者信息:")
    print("- Username: Pengzhi27")
    print("- Email: pengzhia@qq.com")
    print("- User ID: 3")
    
    print("\n请输入登录信息:")
    username_or_email = input("用户名或邮箱 (Pengzhi27 或 pengzhia@qq.com): ")
    password = getpass.getpass("密码: ")
    
    async with aiohttp.ClientSession() as session:
        # 1. 登录
        print("\n1. 尝试登录...")
        login_data = {
            "email_or_username": username_or_email,
            "password": password
        }
        
        async with session.post(f"{BASE_URL}/api/auth/login", json=login_data) as response:
            if response.status == 200:
                auth_data = await response.json()
                access_token = auth_data["tokens"]["access_token"]
                user = auth_data["user"]
                print(f"   ✅ 登录成功!")
                print(f"   User ID: {user['id']}")
                print(f"   Username: {user['username']}")
                
                # 2. 使用令牌访问文件
                headers = {"Authorization": f"Bearer {access_token}"}
                
                print(f"\n2. 使用认证令牌访问文件...")
                print(f"   URL: {BASE_URL}/api/files/{TASK_ID}/original")
                
                async with session.get(
                    f"{BASE_URL}/api/files/{TASK_ID}/original",
                    headers=headers
                ) as file_response:
                    print(f"   状态码: {file_response.status}")
                    
                    if file_response.status == 200:
                        content_type = file_response.headers.get('content-type')
                        content_length = file_response.headers.get('content-length')
                        print(f"   ✅ 文件访问成功!")
                        print(f"   Content-Type: {content_type}")
                        print(f"   Content-Length: {content_length} bytes")
                        print(f"\n   您现在可以通过以下方式访问文件:")
                        print(f"   1. 在浏览器中使用: {BASE_URL}/api/files/{TASK_ID}/original")
                        print(f"   2. 在请求头中添加: Authorization: Bearer {access_token[:20]}...")
                    elif file_response.status == 403:
                        print(f"   ❌ 访问被拒绝 (可能不是文件所有者)")
                    else:
                        error = await file_response.text()
                        print(f"   ❌ 错误: {error}")
                
                # 3. 获取用户的所有任务
                print(f"\n3. 获取您的所有任务...")
                async with session.get(f"{BASE_URL}/api/tasks", headers=headers) as tasks_response:
                    if tasks_response.status == 200:
                        tasks_data = await tasks_response.json()
                        tasks = tasks_data.get("data", [])
                        print(f"   找到 {len(tasks)} 个任务:")
                        for task in tasks[:5]:  # 显示前5个
                            print(f"   - {task['id'][:8]}... | {task['filename']} | public={task['is_public']}")
                
            else:
                error = await response.text()
                print(f"   ❌ 登录失败: {error}")
                print(f"\n   可能的原因:")
                print(f"   1. 密码错误")
                print(f"   2. 用户不存在")
                print(f"   3. 账号被禁用")

async def test_anonymous_alternative():
    """提供替代方案"""
    print("\n" + "="*60)
    print("替代方案：创建新的匿名任务")
    print("="*60)
    
    print("\n如果您没有原始账号密码，可以:")
    print("1. 上传新文件作为匿名用户（所有人可访问）")
    print("2. 注册新账号并上传文件")
    print("3. 联系文件所有者 Pengzhi27 分享文件")

async def main():
    print("\n" + "="*60)
    print("私有文件访问解决方案")
    print("="*60)
    
    print("\n选择操作:")
    print("1. 登录并访问文件（需要知道密码）")
    print("2. 查看替代方案")
    
    choice = input("\n请选择 (1 或 2): ")
    
    if choice == "1":
        await login_and_access()
    else:
        await test_anonymous_alternative()

if __name__ == "__main__":
    asyncio.run(main())