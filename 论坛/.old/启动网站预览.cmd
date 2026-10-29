@echo off
setlocal
chcp 65001 >nul
set "FORUM_PREVIEW_LAUNCHER=%~f0"
set "FORUM_PREVIEW_FOLDER=%~dp0"
if not "%~1"=="" set "FORUM_PREVIEW_PORT=%~1"
powershell.exe -NoLogo -NoProfile -Command "$text=[IO.File]::ReadAllText($env:FORUM_PREVIEW_LAUNCHER,[Text.Encoding]::UTF8);$marker=[char]35+' FORUM_PREVIEW_POWERSHELL';& ([scriptblock]::Create($text.Substring($text.LastIndexOf($marker)+$marker.Length)))"
set "FORUM_PREVIEW_EXIT=%ERRORLEVEL%"
if not "%FORUM_PREVIEW_EXIT%"=="0" pause
exit /b %FORUM_PREVIEW_EXIT%
# FORUM_PREVIEW_POWERSHELL
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
$siteFolder = [IO.Path]::GetFullPath($env:FORUM_PREVIEW_FOLDER)
if (Test-Path -LiteralPath (Join-Path $siteFolder 'index.html')) {
    $siteRoot = $siteFolder
} elseif (Test-Path -LiteralPath (Join-Path $siteFolder 'dist/index.html')) {
    $siteRoot = Join-Path $siteFolder 'dist'
} else {
    Write-Host '没有找到网站文件。请先完整解压网站包，再双击此文件。' -ForegroundColor Yellow
    exit 1
}
$siteRoot = [IO.Path]::GetFullPath($siteRoot).TrimEnd([IO.Path]::DirectorySeparatorChar)
$sitePrefix = $siteRoot + [IO.Path]::DirectorySeparatorChar
$previewPort = 4178
if ($env:FORUM_PREVIEW_PORT) {
    if (-not [int]::TryParse($env:FORUM_PREVIEW_PORT, [ref]$previewPort) -or $previewPort -lt 1024 -or $previewPort -gt 65535) {
        Write-Host '端口须为 1024 至 65535 的数字。' -ForegroundColor Yellow
        exit 1
    }
}
$siteUrl = 'http://127.0.0.1:' + $previewPort + '/'
$fingerprintAlgorithm = [Security.Cryptography.SHA256]::Create()
try { $siteFingerprint = [BitConverter]::ToString($fingerprintAlgorithm.ComputeHash([Text.Encoding]::UTF8.GetBytes($siteRoot.ToLowerInvariant()))).Replace('-', '') }
finally { $fingerprintAlgorithm.Dispose() }
$listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, $previewPort)
try {
    $listener.Start(128)
} catch {
    try {
        $existing = Invoke-WebRequest -Uri $siteUrl -UseBasicParsing -TimeoutSec 3
        if ($existing.Headers['X-Forum-Preview-Root'] -eq $siteFingerprint) {
            Write-Host ('此目录的网站已在运行：' + $siteUrl) -ForegroundColor Green
            if ($env:FORUM_PREVIEW_NO_BROWSER -ne '1') { Start-Process $siteUrl }
            exit 0
        }
    } catch { }
    Write-Host ('端口 ' + $previewPort + ' 已被其他程序占用。请关闭原有预览，或通过命令行指定其他端口。') -ForegroundColor Yellow
    Write-Host '示例：启动网站预览.cmd 4188'
    Write-Host '注意：更换端口会使用另一份浏览器本地资料库；迁移数据请先导出整库 ZIP。'
    exit 1
}
$mimeTypes = @{
    '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
    '.js' = 'application/javascript; charset=utf-8'; '.json' = 'application/json; charset=utf-8'
    '.txt' = 'text/plain; charset=utf-8'; '.md' = 'text/markdown; charset=utf-8'
    '.csv' = 'text/csv; charset=utf-8'; '.svg' = 'image/svg+xml'; '.png' = 'image/png'
    '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.gif' = 'image/gif'; '.webp' = 'image/webp'
    '.ico' = 'image/x-icon'; '.zip' = 'application/zip'
}
function Send-PreviewResponse($stream, $status, $reason, $contentType, [byte[]]$body, $headOnly) {
    $header = "HTTP/1.1 $status $reason`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`nX-Content-Type-Options: nosniff`r`nX-Forum-Preview-Root: $siteFingerprint`r`n`r`n"
    $headerBytes = [Text.Encoding]::ASCII.GetBytes($header)
    $stream.Write($headerBytes, 0, $headerBytes.Length)
    if (-not $headOnly -and $body.Length) { $stream.Write($body, 0, $body.Length) }
    $stream.Flush()
}
Write-Host ''
Write-Host '狰州论坛已启动，无需安装 Node.js、Python 或数据库。' -ForegroundColor Green
Write-Host ('网站首页：' + $siteUrl)
Write-Host ('管理登录：' + $siteUrl + 'login.html')
Write-Host '保留此窗口即可持续使用；关闭窗口或按 Ctrl+C 停止。'
Write-Host '本站仅监听本机。编辑与导入在浏览器中完成，不会改写网站原始文件。'
Write-Host '其他电脑需要原有资料时，请在管理窗口导入之前导出的整库 ZIP。'
Write-Host ''
if ($env:FORUM_PREVIEW_NO_BROWSER -ne '1') {
    try { Start-Process $siteUrl } catch { Write-Host '未能自动打开浏览器，请手动打开上方网址。' -ForegroundColor Yellow }
}
try {
    while ($true) {
        $client = $null
        $stream = $null
        $reader = $null
        try {
            $client = $listener.AcceptTcpClient()
            $client.ReceiveTimeout = 4000
            $client.SendTimeout = 10000
            $stream = $client.GetStream()
            $reader = New-Object IO.StreamReader($stream, [Text.Encoding]::ASCII, $false, 4096, $true)
            $line = $reader.ReadLine()
            if (-not $line) { continue }
            if ($line.Length -gt 8192) { throw 'Request too long' }
            $parts = $line.Split(' ')
            if ($parts.Length -ne 3) { throw 'Invalid request' }
            $requestMethod = $parts[0]
            $requestPath = $parts[1]
            $headOnly = $requestMethod -eq 'HEAD'
            $headers = @{}
            $headerLength = 0
            for ($i = 0; $i -lt 100; $i++) {
                $headerLine = $reader.ReadLine()
                if ([string]::IsNullOrEmpty($headerLine)) { break }
                $headerLength += $headerLine.Length
                if ($headerLength -gt 32768) { throw 'Headers too long' }
                $colon = $headerLine.IndexOf(':')
                if ($colon -gt 0) { $headers[$headerLine.Substring(0, $colon).Trim().ToLowerInvariant()] = $headerLine.Substring($colon + 1).Trim() }
            }
            if ($headers['host'] -notin @("127.0.0.1:$previewPort", "localhost:$previewPort")) {
                Send-PreviewResponse $stream 403 'Forbidden' 'text/plain; charset=utf-8' ([Text.Encoding]::UTF8.GetBytes('只允许从本机预览地址访问。')) $headOnly
                continue
            }
            if ($requestMethod -notin @('GET', 'HEAD')) {
                Send-PreviewResponse $stream 405 'Method Not Allowed' 'text/plain; charset=utf-8' ([Text.Encoding]::UTF8.GetBytes('此程序只提供静态预览，不提供管理后端。')) $headOnly
                continue
            }
            $decodedPath = [Uri]::UnescapeDataString(($requestPath -split '\?', 2)[0])
            if (-not $decodedPath.StartsWith('/')) { throw 'Invalid path' }
            if ($decodedPath.EndsWith('/')) { $decodedPath += 'index.html' }
            $relativePath = $decodedPath.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
            $targetPath = [IO.Path]::GetFullPath([IO.Path]::Combine($siteRoot, $relativePath))
            if (-not $targetPath.StartsWith($sitePrefix, [StringComparison]::OrdinalIgnoreCase)) {
                Send-PreviewResponse $stream 403 'Forbidden' 'text/plain; charset=utf-8' ([Text.Encoding]::UTF8.GetBytes('路径不允许访问。')) $headOnly
                continue
            }
            if (-not [IO.File]::Exists($targetPath)) {
                Send-PreviewResponse $stream 404 'Not Found' 'text/plain; charset=utf-8' ([Text.Encoding]::UTF8.GetBytes('页面未找到。请确认网站包已完整解压。')) $headOnly
                continue
            }
            $extension = [IO.Path]::GetExtension($targetPath).ToLowerInvariant()
            $contentType = $mimeTypes[$extension]
            if (-not $contentType) { $contentType = 'application/octet-stream' }
            Send-PreviewResponse $stream 200 'OK' $contentType ([IO.File]::ReadAllBytes($targetPath)) $headOnly
        } catch {
            if ($stream -and $client -and $client.Connected) {
                try { Send-PreviewResponse $stream 400 'Bad Request' 'text/plain; charset=utf-8' ([Text.Encoding]::UTF8.GetBytes('请求无效或连接已关闭。')) $false } catch { }
            }
        } finally {
            if ($reader) { $reader.Dispose() }
            if ($stream) { $stream.Dispose() }
            if ($client) { $client.Close() }
        }
    }
} finally { $listener.Stop() }
