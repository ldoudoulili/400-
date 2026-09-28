# 打包辅助：对 node.exe 副本做两项修改
# 1) 移除 Authenticode 数字签名（清空 PE 证书表目录项）——SEA 注入后签名失效会导致无法运行
# 2) 把子系统由 Console 改为 Windows GUI——双击运行时不弹黑色命令行窗口
import struct, sys

path = sys.argv[1]
with open(path, 'rb') as f:
    data = f.read()

e_lfanew = struct.unpack_from('<I', data, 0x3C)[0]
opt = e_lfanew + 24
magic = struct.unpack_from('<H', data, opt)[0]

if magic == 0x10B:   # PE32
    dd_start = opt + 96
    subsystem = opt + 60
elif magic == 0x20B: # PE32+ (x64)
    dd_start = opt + 112
    subsystem = opt + 68
else:
    print("未知 PE magic: 0x%X" % magic); sys.exit(1)

# 1) 清证书表目录项 (DataDirectory[4])
cert = dd_start + 4 * 8
va, size = struct.unpack_from('<II', data, cert)
print("证书表: VA=%d Size=%d" % (va, size))

# 2) 当前子系统
sub = struct.unpack_from('<H', data, subsystem)[0]
print("当前子系统: %d (3=Console, 2=GUI)" % sub)

with open(path, 'r+b') as f:
    f.seek(cert); f.write(b'\x00' * 8)          # 清证书表
    f.seek(subsystem); f.write(struct.pack('<H', 2))  # 设为 GUI

print("完成：签名已移除，子系统已改为 GUI(2)。")
