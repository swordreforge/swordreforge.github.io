package com.wasmimageprocessor.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.nio.charset.StandardCharsets
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private var serverThread: Thread? = null
    private var serverSocket: ServerSocket? = null
    private var serverPort = 0
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private lateinit var filePickerLauncher: ActivityResultLauncher<Array<String>>
    
    companion object {
        private const val TAG = "WasmApp"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        Log.d(TAG, "=== MainActivity.onCreate() started ===")
        
        // 注册文件选择器
        filePickerLauncher = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
            if (uri != null && filePathCallback != null) {
                // 持久化权限
                contentResolver.takePersistableUriPermission(
                    uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
                filePathCallback?.onReceiveValue(arrayOf(uri))
                filePathCallback = null
            } else if (filePathCallback != null) {
                filePathCallback?.onReceiveValue(null)
                filePathCallback = null
            }
        }
        
        webView = WebView(this)
        setContentView(webView)

        Log.d(TAG, "WebView created and set as content view")

        // 配置WebView
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            allowFileAccess = true
            allowContentAccess = true
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false
            setSupportMultipleWindows(true)
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            
            // 启用 cross-origin isolation 支持
            @Suppress("DEPRECATION")
            setAllowFileAccessFromFileURLs(false)
            @Suppress("DEPRECATION")
            setAllowUniversalAccessFromFileURLs(false)
            
            // 启用下载
            setAllowFileAccess(true)
            setAllowContentAccess(true)
        }
        
        Log.d(TAG, "WebView settings configured")

        // 设置下载监听器
        webView.setDownloadListener { url, userAgent, contentDisposition, mimeType, contentLength ->
            Log.d(TAG, "Download requested: $url")
            Log.d(TAG, "MIME type: $mimeType")
            
            // 检查是否是 data URI（base64 编码的图片）
            if (url.startsWith("data:")) {
                Log.d(TAG, "Data URI detected, handling locally")
                
                try {
                    // 解析 data URI
                    val commaIndex = url.indexOf(',')
                    if (commaIndex == -1) {
                        Log.e(TAG, "Invalid data URI format")
                        return@setDownloadListener
                    }
                    
                    val header = url.substring(0, commaIndex)
                    val data = url.substring(commaIndex + 1)
                    
                    // 提取 MIME 类型
                    val dataMimeType = header.substringAfter("data:").substringBefore(";")
                    val isBase64 = header.contains(";base64")
                    
                    // 解码数据
                    val imageData = if (isBase64) {
                        android.util.Base64.decode(data, android.util.Base64.DEFAULT)
                    } else {
                        data.toByteArray()
                    }
                    
                    Log.d(TAG, "Image data size: ${imageData.size} bytes")
                    
                    // 生成文件名
                    val timestamp = System.currentTimeMillis()
                    val extension = when {
                        dataMimeType.startsWith("image/png") -> ".png"
                        dataMimeType.startsWith("image/jpeg") -> ".jpg"
                        dataMimeType.startsWith("image/webp") -> ".webp"
                        else -> ".png"
                    }
                    val fileName = "image_$timestamp$extension"
                    
                    // 保存到下载目录
                    val downloadDir = android.os.Environment.getExternalStoragePublicDirectory(
                        android.os.Environment.DIRECTORY_DOWNLOADS
                    )
                    val file = java.io.File(downloadDir, fileName)
                    
                    // Android 10+ 需要使用 MediaStore API
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                        val contentValues = android.content.ContentValues().apply {
                            put(android.provider.MediaStore.Images.Media.DISPLAY_NAME, fileName)
                            put(android.provider.MediaStore.Images.Media.MIME_TYPE, dataMimeType)
                            // 使用 Pictures 目录而不是 Download 目录
                            put(android.provider.MediaStore.Images.Media.RELATIVE_PATH, 
                                android.os.Environment.DIRECTORY_PICTURES + "/WASMProcessor")
                            put(android.provider.MediaStore.Images.Media.IS_PENDING, 1)
                        }
                        
                        val uri = contentResolver.insert(
                            android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                            contentValues
                        )
                        
                        uri?.let {
                            contentResolver.openOutputStream(it).use { output ->
                                output?.write(imageData)
                            }
                            
                            contentValues.clear()
                            contentValues.put(android.provider.MediaStore.Images.Media.IS_PENDING, 0)
                            contentResolver.update(it, contentValues, null, null)
                            
                            Log.d(TAG, "Image saved via MediaStore: $uri")
                            
                            // 显示通知
                            showDownloadNotification(fileName, true)
                        }
                    } else {
                        // Android 9 及以下
                        file.parentFile?.mkdirs()
                        java.io.FileOutputStream(file).use { it.write(imageData) }
                        
                        Log.d(TAG, "Image saved to: ${file.absolutePath}")
                        
                        // 通知媒体扫描器
                        val scanIntent = android.content.Intent(
                            android.content.Intent.ACTION_MEDIA_SCANNER_SCAN_FILE
                        )
                        scanIntent.data = android.net.Uri.fromFile(file)
                        sendBroadcast(scanIntent)
                        
                        // 显示通知
                        showDownloadNotification(fileName, true)
                    }
                    
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to save data URI", e)
                    showDownloadNotification(null, false)
                }
                
                return@setDownloadListener
            }
            
            // 处理普通 URL 下载
            try {
                // 创建下载请求
                val request = android.app.DownloadManager.Request(android.net.Uri.parse(url))
                request.setMimeType(mimeType)
                request.addRequestHeader("User-Agent", userAgent)
                request.setDescription("正在下载...")
                request.setTitle(contentDisposition ?: "下载文件")
                
                // 设置下载目录
                request.setDestinationInExternalFilesDir(
                    this@MainActivity,
                    android.os.Environment.DIRECTORY_DOWNLOADS,
                    url.substringAfterLast("/")
                )
                
                // 显示通知
                request.setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                
                // 允许在漫游和移动网络下载
                request.setAllowedNetworkTypes(
                    android.app.DownloadManager.Request.NETWORK_WIFI or android.app.DownloadManager.Request.NETWORK_MOBILE
                )
                
                // 执行下载
                val downloadManager = getSystemService(android.content.Context.DOWNLOAD_SERVICE) as android.app.DownloadManager
                val downloadId = downloadManager.enqueue(request)
                
                Log.d(TAG, "Download started with ID: $downloadId")
                
                // 监听下载完成
                Thread {
                    val query = android.app.DownloadManager.Query().setFilterById(downloadId)
                    var finished = false
                    while (!finished) {
                        val cursor = downloadManager.query(query)
                        if (cursor.moveToFirst()) {
                            val statusIndex = cursor.getColumnIndex(android.app.DownloadManager.COLUMN_STATUS)
                            val status = cursor.getInt(statusIndex)
                            if (status == android.app.DownloadManager.STATUS_SUCCESSFUL || 
                                status == android.app.DownloadManager.STATUS_FAILED) {
                                finished = true
                                Log.d(TAG, "Download completed with status: $status")
                            }
                        }
                        cursor.close()
                        Thread.sleep(500)
                    }
                }.start()
                
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start download", e)
            }
        }

        // 设置 WebViewClient
        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                Log.d(TAG, "=== Page Started Loading ===")
                Log.d(TAG, "URL: $url")
            }
            
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                Log.d(TAG, "=== Page Finished Loading ===")
                Log.d(TAG, "URL: $url")
                
                view?.evaluateJavascript("""
                    (function() {
                        console.log('=== JavaScript Environment ===');
                        console.log('URL:', window.location.href);
                        console.log('Protocol:', window.location.protocol);
                        console.log('Host:', window.location.host);
                        console.log('Port:', window.location.port);
                        console.log('crossOriginIsolated:', window.crossOriginIsolated);
                        console.log('SharedArrayBuffer:', typeof SharedArrayBuffer !== 'undefined');
                        console.log('Web Workers:', typeof Worker !== 'undefined');
                        console.log('Service Worker:', 'serviceWorker' in navigator);
                        console.log('============================');
                        
                        // 测试文件访问
                        fetch('/pkg/photon_wasm.js').then(r => {
                            console.log('pkg/photon_wasm.js fetch success:', r.status);
                        }).catch(e => {
                            console.error('pkg/photon_wasm.js fetch failed:', e);
                        });
                        
                        return 'OK';
                    })();
                """.trimIndent()) { result ->
                    Log.d(TAG, "JavaScript evaluation result: $result")
                }
            }
            
            override fun onReceivedError(view: WebView?, request: android.webkit.WebResourceRequest?, error: android.webkit.WebResourceError?) {
                super.onReceivedError(view, request, error)
                Log.e(TAG, "=== WebView Error ===")
                Log.e(TAG, "Request URL: ${request?.url}")
                Log.e(TAG, "Error code: ${error?.errorCode}")
                Log.e(TAG, "Error description: ${error?.description}")
            }
        }

        // 设置 WebChromeClient 以捕获控制台输出和处理文件选择
        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
                val logLevel = when (consoleMessage.messageLevel()) {
                    ConsoleMessage.MessageLevel.ERROR -> "ERROR"
                    ConsoleMessage.MessageLevel.WARNING -> "WARN"
                    ConsoleMessage.MessageLevel.LOG -> "LOG"
                    ConsoleMessage.MessageLevel.DEBUG -> "DEBUG"
                    else -> "INFO"
                }
                Log.d(TAG, "[Console $logLevel] ${consoleMessage.sourceId()}:${consoleMessage.lineNumber()} - ${consoleMessage.message()}")
                return true
            }
            
            // 处理文件选择
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams
            ): Boolean {
                Log.d(TAG, "File chooser requested")
                this@MainActivity.filePathCallback = filePathCallback
                
                // 创建文件选择器的 MIME 类型过滤器
                val acceptTypes = fileChooserParams.acceptTypes
                val mimeTypes = if (acceptTypes.isNotEmpty()) {
                    acceptTypes
                } else {
                    arrayOf("image/*")
                }
                
                // 启动文件选择器
                try {
                    filePickerLauncher.launch(mimeTypes)
                    return true
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to launch file picker", e)
                    filePathCallback?.onReceiveValue(null)
                    this@MainActivity.filePathCallback = null
                    return false
                }
            }
        }
        
        Log.d(TAG, "WebView clients configured")
        
        // 请求通知权限（Android 13+）
        requestNotificationPermission()

        // 启动本地服务器并加载应用
        startLocalServer()
    }

    private fun startLocalServer() {
        try {
            Log.d(TAG, "=== Starting Local Server ===")
            
            // 查找可用端口
            serverSocket = ServerSocket(0)
            serverPort = serverSocket!!.localPort
            
            Log.d(TAG, "Server port: $serverPort")
            Log.d(TAG, "Server socket: ${serverSocket?.localSocketAddress}")
            
            // 启动服务器线程
            serverThread = Thread {
                Log.d(TAG, "Server thread started, waiting for connections...")
                val executor = Executors.newCachedThreadPool()
                var requestCount = 0

                while (!serverSocket!!.isClosed) {
                    try {
                        val client = serverSocket!!.accept()
                        requestCount++
                        Log.d(TAG, "=== Request #$requestCount ===")
                        Log.d(TAG, "Client: ${client.inetAddress}")

                        executor.execute {
                            handleRequest(client, requestCount)
                        }
                    } catch (e: IOException) {
                        if (!serverSocket!!.isClosed) {
                            Log.e(TAG, "Server accept error", e)
                        }
                    }
                }
                Log.d(TAG, "Server thread stopped")
            }.apply {
                isDaemon = true
                start()
            }

            // 等待服务器线程完全启动
            Thread.sleep(100)

            // 加载应用 - 使用根路径
            val url = "http://localhost:$serverPort/"
            Log.d(TAG, "Loading URL: $url")
            webView.loadUrl(url)
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start local server", e)
            // 回退到 file:// 协议
            Log.d(TAG, "Falling back to file:// protocol")
            loadFromFileSystem()
        }
    }

    private fun handleRequest(client: Socket, requestId: Int) {
        try {
            Log.d(TAG, "Handling request #$requestId")
            val input = client.getInputStream()
            val output = client.getOutputStream()

            // 读取请求行（超时 2 秒）
            client.soTimeout = 2000
            val buffer = ByteArray(1024)
            val bytesRead = input.read(buffer)
            
            if (bytesRead <= 0) {
                Log.w(TAG, "Request #$requestId: No data received")
                client.close()
                return
            }
            
            val requestString = String(buffer, 0, bytesRead, StandardCharsets.UTF_8)
            val requestLine = requestString.lines().firstOrNull() ?: ""
            
            Log.d(TAG, "Request #$requestId: $requestLine")
            
            // 解析请求路径
            val parts = requestLine.split(" ")
            if (parts.size < 2) {
                Log.w(TAG, "Request #$requestId: Invalid request format")
                sendErrorResponse(output, 400, "Bad Request")
                client.close()
                return
            }
            
            val path = parts[1]
            Log.d(TAG, "Request #$requestId path: $path")

            // 移除查询参数和哈希片段
            val cleanPath = path.split("?")[0].split("#")[0]

            // 处理路径 - 以 index.html 为根目录
            val filePath = when {
                cleanPath == "/" || cleanPath == "/index.html" -> "index.html"
                cleanPath.startsWith("/") -> cleanPath.substring(1)
                else -> cleanPath
            }

            Log.d(TAG, "Request #$requestId asset path: $filePath")
            
            try {
                // 从 assets 读取文件
                val inputStream = assets.open(filePath)
                val content = inputStream.readBytes()
                inputStream.close()
                
                Log.d(TAG, "Request #$requestId: File loaded, size: ${content.size} bytes")
                
                // 确定内容类型
                val contentType = when {
                    filePath.endsWith(".html") -> "text/html; charset=utf-8"
                    filePath.endsWith(".js") -> "application/javascript; charset=utf-8"
                    filePath.endsWith(".css") -> "text/css; charset=utf-8"
                    filePath.endsWith(".wasm") -> "application/wasm"
                    filePath.endsWith(".json") -> "application/json; charset=utf-8"
                    else -> "application/octet-stream"
                }
                
                // 构建响应 - 添加 COOP/COEP 头
                val headers = StringBuilder()
                headers.append("HTTP/1.1 200 OK\r\n")
                headers.append("Content-Type: $contentType\r\n")
                headers.append("Cross-Origin-Embedder-Policy: require-corp\r\n")
                headers.append("Cross-Origin-Opener-Policy: same-origin\r\n")
                headers.append("Cross-Origin-Resource-Policy: cross-origin\r\n")
                headers.append("Content-Length: ${content.size}\r\n")
                headers.append("Connection: close\r\n")
                headers.append("\r\n")
                
                output.write(headers.toString().toByteArray(StandardCharsets.UTF_8))
                output.write(content)
                output.flush()
                
                Log.d(TAG, "Request #$requestId: Response sent successfully")
                
            } catch (e: Exception) {
                Log.e(TAG, "Request #$requestId: File not found or error", e)
                sendErrorResponse(output, 404, "Not Found: $filePath")
            }
            
            client.close()
        } catch (e: Exception) {
            Log.e(TAG, "Request #$requestId: Handle request error", e)
            try {
                client.close()
            } catch (e2: Exception) {
                Log.e(TAG, "Request #$requestId: Error closing socket", e2)
            }
        }
    }

    private fun sendErrorResponse(output: java.io.OutputStream, code: Int, message: String) {
        try {
            val body = "<html><body><h1>$code</h1><p>$message</p></body></html>"
            val headers = StringBuilder()
            headers.append("HTTP/1.1 $code Error\r\n")
            headers.append("Content-Type: text/html; charset=utf-8\r\n")
            headers.append("Content-Length: ${body.toByteArray(StandardCharsets.UTF_8).size}\r\n")
            headers.append("Connection: close\r\n")
            headers.append("\r\n")
            
            output.write(headers.toString().toByteArray(StandardCharsets.UTF_8))
            output.write(body.toByteArray(StandardCharsets.UTF_8))
            output.flush()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send error response", e)
        }
    }

    private fun loadFromFileSystem() {
        Log.d(TAG, "Loading from file system: file:///android_asset/index.html")
        webView.loadUrl("file:///android_asset/index.html")
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "=== MainActivity.onDestroy() ===")
        // 停止服务器
        try {
            serverSocket?.close()
            Log.d(TAG, "Server socket closed")
        } catch (e: Exception) {
            Log.e(TAG, "Error closing server socket", e)
        }
        serverThread?.interrupt()
        Log.d(TAG, "Server thread interrupted")
    }
    
    private fun showDownloadNotification(fileName: String?, success: Boolean) {
        val channelId = "download_channel"
        val notificationId = System.currentTimeMillis().toInt()
        
        try {
            val notificationManager = getSystemService(NotificationManager::class.java)
            
            // 创建通知渠道（Android 8.0+）
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    channelId,
                    "下载通知",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "图片下载完成通知"
                    enableLights(true)
                    enableVibration(true)
                    setSound(null, null) // 静音
                }
                
                notificationManager.createNotificationChannel(channel)
            }
            
            // 构建通知
            val notification = NotificationCompat.Builder(this, channelId)
                .setContentTitle(if (success) "下载成功" else "下载失败")
                .setContentText(if (success) "文件已保存: $fileName" else "下载过程中出现错误")
                .setSmallIcon(android.R.drawable.stat_sys_download_done)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_PROGRESS)
                .setTimeoutAfter(3000) // 3秒后自动消失
                .setAutoCancel(true)
                .build()
            
            // 显示通知
            notificationManager.notify(notificationId, notification)
            
            // 3秒后取消通知
            Handler(android.os.Looper.getMainLooper()).postDelayed({
                notificationManager.cancel(notificationId)
                Log.d(TAG, "Notification cancelled after 3 seconds")
            }, 3000)
            
            Log.d(TAG, "Notification shown: $fileName, success=$success")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to show notification", e)
        }
    }
    
    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    this,
                    android.Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(android.Manifest.permission.POST_NOTIFICATIONS),
                    1001
                )
                Log.d(TAG, "Requesting POST_NOTIFICATIONS permission")
            } else {
                Log.d(TAG, "POST_NOTIFICATIONS permission already granted")
            }
        }
    }
    
    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 1001) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Log.d(TAG, "POST_NOTIFICATIONS permission granted")
            } else {
                Log.d(TAG, "POST_NOTIFICATIONS permission denied")
            }
        }
    }
}
