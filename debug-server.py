#!/usr/bin/env python3
import subprocess

# 直接通过git拉取最新代码然后运行远程调试
def main():
    server = "ubuntu@49.234.30.246"
    password = "Abcd.1234"
    
    # 构造远程命令
    commands = [
        "cd /home/ubuntu/english-listening-trainer",
        "git pull origin main",
        "python3 -m kokoro_local.selftest --config kokoro_local/configs/gpu.yaml --format json --skip-on-missing-model"
    ]
    
    remote_cmd = " && ".join(commands)
    
    # 使用subprocess.run with input来处理密码
    process = subprocess.Popen(
        ["ssh", server, remote_cmd],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    try:
        stdout, stderr = process.communicate(input=f"{password}\n", timeout=60)
        print("STDOUT:")
        print(stdout)
        if stderr:
            print("STDERR:")
            print(stderr)
    except subprocess.TimeoutExpired:
        process.kill()
        print("Command timed out")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
