$ErrorActionPreference = 'Stop'
$authOrigin = 'https://arg-auth-683dc0f14848.yangyi42905341.workers.dev'
$siteOrigin = 'https://zhengzhou-police.pages.dev'
$project = 'zhengzhou-police'
$siteId = 'city-bureau'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$website = Join-Path $repo '市局官网'
$node = Join-Path $env:ProgramFiles 'nodejs\node.exe'
$wrangler = Join-Path $repo 'arg-auth\node_modules\wrangler\bin\wrangler.js'
$commit = 'cf1ead9ab0a71ecf5e4ca3ac81177e3de1b919bf'

function Convert-LegacyValue([string]$code, [string]$name) {
    $match = [regex]::Match($code, ('var\s+' + $name + '\s*=\s*String\.fromCharCode\(([^)]+)\)'))
    if (-not $match.Success) { throw '无法从原始网站版本读取原有账号信息，请联系协助处理。' }
    return -join ($match.Groups[1].Value.Split(',') | ForEach-Object { [char][int]$_.Trim() })
}
function Invoke-Admin([string]$path, [string]$method, $payload) {
    $params = @{ Uri = $authOrigin + $path; Method = $method; Headers = @{Origin=$authOrigin}; WebSession = $adminSession; TimeoutSec = 30 }
    if ($null -ne $payload) {
        $params.ContentType = 'application/json; charset=utf-8'
        $params.Body = [Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json -Compress))
    }
    return Invoke-RestMethod @params
}
function Invoke-Wrangler([string[]]$arguments, [string]$inputValue) {
    $start = New-Object System.Diagnostics.ProcessStartInfo
    $start.FileName = $node
    $start.WorkingDirectory = [IO.Path]::GetTempPath()
    $start.UseShellExecute = $false
    $start.RedirectStandardInput = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.Arguments = '"' + $wrangler + '" ' + (($arguments | ForEach-Object { '"' + $_.Replace('"','\"') + '"' }) -join ' ')
    $proc = [Diagnostics.Process]::Start($start)
    $errorTask = $proc.StandardError.ReadToEndAsync()
    if ($inputValue -and $arguments[0] -eq 'pages' -and $arguments[1] -eq 'secret' -and $arguments[2] -eq 'bulk') {
        # Wrangler loads the project before attaching its stdin reader. Wait for
        # its ready message so the pipe is not consumed by its startup code.
        $ready = $false
        while (-not $ready) {
            $lineTask = $proc.StandardOutput.ReadLineAsync()
            if (-not $lineTask.Wait(30000)) { throw '等待 Cloudflare 密钥配置超时，请重试。' }
            $line = $lineTask.Result
            if ($null -eq $line) { throw ('Cloudflare 密钥配置未启动：' + $errorTask.Result) }
            if ($line -match 'Creating the secrets for the Pages project') { $ready = $true }
        }
    }
    if ($inputValue) { $proc.StandardInput.WriteLine($inputValue) }
    $proc.StandardInput.Close()
    $outputTask = $proc.StandardOutput.ReadToEndAsync()
    $proc.WaitForExit()
    if ($proc.ExitCode -ne 0) { throw ('Cloudflare 操作失败：' + $errorTask.Result) }
    return $outputTask.Result
}
function Set-PagesKey([string]$jsonValue) {
    # A user-restricted Windows named pipe supplies the secret to Wrangler
    # without writing it to disk or relying on its stdin startup behavior.
    $pipeName = 'argcity' + [guid]::NewGuid().ToString('N')
    $pipeSecurity = New-Object System.IO.Pipes.PipeSecurity
    $pipeSecurity.SetAccessRuleProtection($true, $false)
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $rule = New-Object System.IO.Pipes.PipeAccessRule($currentUser, [System.IO.Pipes.PipeAccessRights]::FullControl, [Security.AccessControl.AccessControlType]::Allow)
    $pipeSecurity.AddAccessRule($rule)
    $server = New-Object System.IO.Pipes.NamedPipeServerStream($pipeName, [System.IO.Pipes.PipeDirection]::Out, 1, [System.IO.Pipes.PipeTransmissionMode]::Byte, [System.IO.Pipes.PipeOptions]::Asynchronous, 4096, 4096, $pipeSecurity)
    try {
        $pipePath = '\\.\pipe\' + $pipeName
        $start = New-Object System.Diagnostics.ProcessStartInfo
        $start.FileName=$node; $start.WorkingDirectory=[IO.Path]::GetTempPath(); $start.UseShellExecute=$false
        $start.RedirectStandardOutput=$true; $start.RedirectStandardError=$true
        $start.Arguments='"' + $wrangler + '" pages secret bulk "' + $pipePath + '" --project-name "' + $project + '"'
        $proc=[Diagnostics.Process]::Start($start)
        $outputTask=$proc.StandardOutput.ReadToEndAsync(); $errorTask=$proc.StandardError.ReadToEndAsync()
        $connected=$server.WaitForConnectionAsync()
        if (-not $connected.Wait(30000)) { throw '连接 Cloudflare 密钥配置超时，请检查登录状态。' }
        $writer=New-Object System.IO.StreamWriter($server,(New-Object System.Text.UTF8Encoding($false)))
        try { $writer.Write($jsonValue); $writer.Flush() } finally { $writer.Dispose() }
        $proc.WaitForExit()
        if ($proc.ExitCode -ne 0) { throw ('Cloudflare 密钥配置失败：' + $errorTask.Result) }
    } finally { $server.Dispose() }
}

try {
    if (-not (Test-Path -LiteralPath $node) -or -not (Test-Path -LiteralPath $wrangler)) { throw '未找到 Node.js 或部署工具，请先在 arg-auth 文件夹运行 npm install。' }
    $git = Get-Command git -ErrorAction SilentlyContinue
    if ($git) { $gitPath = $git.Source }
    else { $gitPath = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe' }
    if (-not (Test-Path -LiteralPath $gitPath)) { throw '未找到 Git，无法读取原始网站版本。' }
    $legacy = & $gitPath -C $repo show ($commit + ':市局官网/login.html')
    if ($LASTEXITCODE -ne 0) { throw '无法读取原始网站版本。' }
    $legacy = $legacy -join "`n"
    $player = Convert-LegacyValue $legacy 'U'
    $primary = Convert-LegacyValue $legacy 'P1'
    $secondary = Convert-LegacyValue $legacy 'P2'
    $answer = Convert-LegacyValue $legacy 'ANS'

    Write-Host '将原有账号和密码安全登记到验证服务，并连接市局 Pages 网站。'
    $adminName = Read-Host '管理员账号'
    $adminSecure = Read-Host '管理员密码（输入时不显示）' -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminSecure)
    try { $adminPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
    $body = [Text.Encoding]::UTF8.GetBytes((@{username=$adminName;password=$adminPassword} | ConvertTo-Json -Compress))
    Invoke-RestMethod -Uri ($authOrigin+'/api/admin/login') -Method Post -Headers @{Origin=$authOrigin} -ContentType 'application/json; charset=utf-8' -Body $body -SessionVariable adminSession -TimeoutSec 30 | Out-Null
    $adminPassword = $null; $body = $null
    Write-Host '管理员验证通过。'

    $sites = Invoke-Admin '/api/admin/sites' 'Get' $null
    $site = $sites.sites | Where-Object { $_.id -eq $siteId } | Select-Object -First 1
    if ($site -and ($site.origin -ne $siteOrigin -or $site.prefix -ne '/archive/' -or $site.destination -ne '/archive/index.html')) { throw '站点 ID 已被其他配置使用，未修改任何账号。' }
    if (-not $site) {
        Invoke-Admin '/api/admin/sites' 'Post' @{id=$siteId;name='狰州市公安局';origin=$siteOrigin;prefix='/archive/';destination='/archive/index.html'} | Out-Null
        $sites = Invoke-Admin '/api/admin/sites' 'Get' $null
        $site = $sites.sites | Where-Object { $_.id -eq $siteId } | Select-Object -First 1
    }
    if (-not $site -or -not $site.signing_key) { throw '无法获取站点接入密钥。' }
    Invoke-Admin '/api/admin/accounts' 'Post' @{site=$siteId;username=$player;password=$primary} | Out-Null
    Invoke-Admin '/api/admin/puzzle' 'Post' @{site=$siteId;username=$player;secondary=$secondary;answer=$answer} | Out-Null
    Write-Host '原有账号、二级密码和核验答案已登记。'

    if ($site.signing_key -isnot [string] -or $site.signing_key.Length -lt 32) { throw '站点密钥格式有误，已停止配置。' }
    $bindings = @{SITE_KEY=$site.signing_key} | ConvertTo-Json -Compress
    try { $checkedBindings = $bindings | ConvertFrom-Json }
    catch { throw '站点密钥配置格式有误，已停止配置。' }
    if (-not $checkedBindings.SITE_KEY) { throw '站点密钥配置为空，已停止配置。' }
    Set-PagesKey $bindings
    $bindings=$null; $checkedBindings=$null; $site=$null
    Write-Host 'Pages 安全配置完成，正在发布网站……'
    $deployment = Invoke-Wrangler @('pages','deploy',$website,'--project-name',$project,'--branch','main') $null
    Write-Host '发布完成。'
    Write-Host ('网站地址：' + $siteOrigin + '/')
    Invoke-Admin '/api/admin/logout' 'Post' @{} | Out-Null
} catch {
    Write-Host ('接入未完成：' + $_.Exception.Message) -ForegroundColor Red
    Write-Host '请保留这段错误信息发给协助人员，不要发送密码或密钥。'
    exit 1
}
