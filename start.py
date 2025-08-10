#!/usr/bin/env python3
"""
MonkeyOCR WebApp 启动脚本
同时启动前端和后端服务的跨平台启动脚本
"""

import sys
import time
import signal
import subprocess
import webbrowser
from pathlib import Path

# 配置
FRONTEND_PORT = 5173
BACKEND_PORT = 8001
FRONTEND_URL = f"http://localhost:{FRONTEND_PORT}"
BACKEND_URL = f"http://localhost:{BACKEND_PORT}"

# 全局进程列表，用于清理
processes = []

def print_banner():
    """打印启动横幅"""
    print("=" * 60)
    print("🐒 MonkeyOCR WebApp Launcher")
    print("=" * 60)
    print(f"前端地址: {FRONTEND_URL}")
    print(f"后端地址: {BACKEND_URL}")
    print("=" * 60)

def check_dependencies():
    """检查依赖是否安装"""
    print("📋 检查依赖...")
    
    # 检查Node.js
    try:
        result = subprocess.run(["node", "--version"], 
                              capture_output=True, text=True, check=True)
        print(f"✅ Node.js: {result.stdout.strip()}")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("❌ Node.js 未安装或不在PATH中")
        return False
    
    # 检查npm
    try:
        result = subprocess.run(["npm", "--version"], 
                              capture_output=True, text=True, check=True)
        print(f"✅ npm: {result.stdout.strip()}")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("❌ npm 未安装或不在PATH中")
        return False
    
    # 检查Python
    try:
        print(f"✅ Python: {sys.version.split()[0]}")
    except:
        print("❌ Python 版本检查失败")
        return False
    
    return True

def find_process_by_port(port):
    """查找占用端口的进程"""
    try:
        # 使用不同平台的命令查找端口占用
        if sys.platform.startswith('win'):
            # Windows: netstat
            cmd = ['netstat', '-ano']
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            lines = result.stdout.split('\n')
            
            for line in lines:
                if f':{port}' in line and 'LISTENING' in line:
                    parts = line.split()
                    if len(parts) >= 5:
                        pid = parts[-1]
                        return int(pid) if pid.isdigit() else None
        else:
            # Unix/Linux/macOS: lsof
            cmd = ['lsof', '-ti', f'tcp:{port}']
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            pids = result.stdout.strip().split('\n')
            if pids and pids[0]:
                return int(pids[0])
    except (subprocess.CalledProcessError, FileNotFoundError, ValueError):
        pass
    
    return None

def kill_process_by_pid(pid):
    """根据PID杀死进程 - 使用SIGKILL强制终止"""
    try:
        if sys.platform.startswith('win'):
            # Windows: taskkill with force flag
            subprocess.run(['taskkill', '/F', '/PID', str(pid)], 
                         capture_output=True, check=False)
        else:
            # Unix/Linux/macOS: 直接使用 SIGKILL (-9)
            import os
            os.kill(pid, signal.SIGKILL)
        return True
    except (OSError, ProcessLookupError):
        # 进程可能已经不存在了
        return True  # 返回True因为目标已达成(进程不存在)
    except Exception:
        return False

def check_and_free_ports():
    """检查端口占用并快速释放"""
    import socket
    import os
    
    def is_port_in_use(port):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            return s.connect_ex(('localhost', port)) == 0
    
    print("🔍 检查端口占用...")
    
    ports_to_check = [
        (FRONTEND_PORT, "前端"),
        (BACKEND_PORT, "后端")
    ]
    
    for port, service_name in ports_to_check:
        if is_port_in_use(port):
            print(f"⚠️  端口 {port} ({service_name}) 已被占用，立即清理...")
            
            # 使用更直接的方式杀死所有占用该端口的进程
            if sys.platform.startswith('win'):
                # Windows: 使用netstat找到进程并立即杀死
                try:
                    cmd = f'for /f "tokens=5" %a in (\'netstat -ano ^| findstr :{port}\') do taskkill /F /PID %a'
                    subprocess.run(cmd, shell=True, capture_output=True, check=False)
                except:
                    pass
            else:
                # Unix/Linux/macOS: 使用lsof找到所有进程并立即杀死
                try:
                    # 获取所有占用该端口的PID
                    result = subprocess.run(['lsof', '-ti', f'tcp:{port}'], 
                                          capture_output=True, text=True, check=False)
                    if result.stdout:
                        pids = result.stdout.strip().split('\n')
                        for pid_str in pids:
                            if pid_str:
                                try:
                                    pid = int(pid_str)
                                    os.kill(pid, signal.SIGKILL)
                                    print(f"✅ 已终止进程 PID: {pid}")
                                except (ValueError, OSError):
                                    pass
                except FileNotFoundError:
                    # lsof不可用，尝试使用fuser
                    try:
                        subprocess.run(['fuser', '-k', f'{port}/tcp'], 
                                     capture_output=True, check=False)
                    except:
                        pass
            
            # 短暂等待端口释放 (0.5秒应该够了)
            time.sleep(0.5)
            
            # 再次检查
            if is_port_in_use(port):
                # 如果还占用，再等0.5秒
                time.sleep(0.5)
                
                if is_port_in_use(port):
                    print(f"❌ 无法释放端口 {port} ({service_name})")
                    print(f"💡 建议：请手动终止占用进程: lsof -ti tcp:{port} | xargs kill -9")
                    return False
            
            print(f"✅ 端口 {port} 已成功释放")
        else:
            print(f"✅ {service_name}端口 {port} 可用")
    
    return True

def install_frontend_deps():
    """安装前端依赖"""
    frontend_dir = Path(__file__).parent / "frontend"
    node_modules = frontend_dir / "node_modules"
    
    if not node_modules.exists():
        print("📦 安装前端依赖...")
        try:
            subprocess.run(["npm", "install"], 
                         cwd=frontend_dir, check=True)
            print("✅ 前端依赖安装完成")
        except subprocess.CalledProcessError as e:
            print(f"❌ 前端依赖安装失败: {e}")
            return False
    else:
        print("✅ 前端依赖已存在")
    
    return True

def start_backend():
    """启动后端服务"""
    print("🚀 启动后端服务...")
    
    backend_dir = Path(__file__).parent / "backend"
    
    try:
        # 使用uvicorn启动FastAPI
        process = subprocess.Popen([
            sys.executable, "-m", "uvicorn", "main:app",
            "--reload",
            "--host", "0.0.0.0", 
            "--port", str(BACKEND_PORT)
        ], cwd=backend_dir)
        
        processes.append(process)
        print(f"✅ 后端服务已启动 (PID: {process.pid})")
        return process
        
    except Exception as e:
        print(f"❌ 后端启动失败: {e}")
        return None

def start_frontend():
    """启动前端服务"""
    print("🚀 启动前端服务...")
    
    frontend_dir = Path(__file__).parent / "frontend"
    
    try:
        # 使用npm dev启动Vite开发服务器
        process = subprocess.Popen([
            "npm", "run", "dev"
        ], cwd=frontend_dir)
        
        processes.append(process)
        print(f"✅ 前端服务已启动 (PID: {process.pid})")
        return process
        
    except Exception as e:
        print(f"❌ 前端启动失败: {e}")
        return None

def wait_for_service(url, service_name, max_attempts=30):
    """等待服务启动"""
    import requests
    
    print(f"⏳ 等待{service_name}启动...")
    
    for attempt in range(max_attempts):
        try:
            response = requests.get(url, timeout=2)
            if response.status_code < 500:
                print(f"✅ {service_name}已就绪")
                return True
        except requests.exceptions.RequestException:
            pass
        
        time.sleep(1)
        if attempt % 5 == 0 and attempt > 0:
            print(f"⏳ 仍在等待{service_name}... ({attempt}/{max_attempts})")
    
    print(f"❌ {service_name}启动超时")
    return False

def open_browser():
    """打开浏览器"""
    print("🌐 正在打开浏览器...")
    try:
        webbrowser.open(FRONTEND_URL)
        print("✅ 浏览器已打开")
    except Exception as e:
        print(f"⚠️  无法自动打开浏览器: {e}")
        print(f"请手动访问: {FRONTEND_URL}")

def cleanup():
    """清理进程"""
    print("\n🛑 正在停止服务...")
    
    for process in processes:
        if process and process.poll() is None:
            try:
                # 尝试优雅停止
                process.terminate()
                
                # 等待进程结束
                try:
                    process.wait(timeout=5)
                    print(f"✅ 进程 {process.pid} 已停止")
                except subprocess.TimeoutExpired:
                    # 强制杀死
                    process.kill()
                    process.wait()
                    print(f"🔨 强制停止进程 {process.pid}")
                    
            except Exception as e:
                print(f"⚠️  停止进程 {process.pid} 时出错: {e}")

def signal_handler(signum, frame):
    """信号处理器"""
    _ = frame  # 标记为故意未使用
    print(f"\n📨 收到信号 {signum}")
    cleanup()
    print("👋 再见!")
    sys.exit(0)

def main():
    """主函数"""
    # 设置信号处理器
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    print_banner()
    
    # 检查依赖
    if not check_dependencies():
        print("❌ 依赖检查失败，请安装所需依赖")
        return 1
    
    # 检查端口占用并自动清理
    if not check_and_free_ports():
        print("❌ 端口占用处理失败，请手动释放占用的端口")
        return 1
    
    # 安装前端依赖
    if not install_frontend_deps():
        print("❌ 前端依赖安装失败")
        return 1
    
    print("\n" + "=" * 60)
    print("🚀 启动服务...")
    print("=" * 60)
    
    # 启动后端
    backend_process = start_backend()
    if not backend_process:
        return 1
    
    # 等待后端启动
    if not wait_for_service(f"{BACKEND_URL}/health", "后端服务"):
        cleanup()
        return 1
    
    # 启动前端
    frontend_process = start_frontend()
    if not frontend_process:
        cleanup()
        return 1
    
    # 等待前端启动
    if not wait_for_service(FRONTEND_URL, "前端服务"):
        cleanup()
        return 1
    
    # 打开浏览器
    open_browser()
    
    print("\n" + "=" * 60)
    print("🎉 所有服务已启动完成!")
    print("=" * 60)
    print(f"前端: {FRONTEND_URL}")
    print(f"后端: {BACKEND_URL}")
    print("按 Ctrl+C 停止所有服务")
    print("=" * 60)
    
    try:
        # 保持运行，监控进程
        while True:
            # 检查进程是否还在运行
            for process in processes[:]:  # 使用副本避免修改过程中的问题
                if process.poll() is not None:
                    print(f"⚠️  进程 {process.pid} 意外退出")
                    processes.remove(process)
            
            if not processes:
                print("❌ 所有进程都已退出")
                break
                
            time.sleep(2)
            
    except KeyboardInterrupt:
        pass
    finally:
        cleanup()
    
    return 0

if __name__ == "__main__":
    sys.exit(main())