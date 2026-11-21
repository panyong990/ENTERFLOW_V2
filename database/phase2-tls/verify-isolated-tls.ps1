$ErrorActionPreference = 'Stop'
# MySQL STARTTLS only: SSLRequest, TLS handshake, then EOF; no credentials/SQL.
$opensslPath = 'C:/Program Files/Git/usr/bin/openssl.exe'
if (-not (Test-Path -LiteralPath $opensslPath)) { throw 'Local OpenSSL executable unavailable' }
foreach ($identity in @(@('-verify_ip','127.0.0.1'), @('-verify_hostname','localhost'))) {
    $probe = New-Object System.Diagnostics.Process
    $probe.StartInfo.FileName = $opensslPath
    $probe.StartInfo.Arguments = 's_client -starttls mysql -connect 127.0.0.1:62286 -CAfile backend/certs/local/phase2/ca.pem -verify_return_error ' + ($identity -join ' ') + ' -brief -no_ign_eof'
    $probe.StartInfo.UseShellExecute = $false
    $probe.StartInfo.CreateNoWindow = $true
    $probe.StartInfo.RedirectStandardInput = $true
    $probe.StartInfo.RedirectStandardOutput = $true
    $probe.StartInfo.RedirectStandardError = $true
    [void]$probe.Start()
    $probe.StandardInput.Close()
    $output = $probe.StandardOutput.ReadToEndAsync()
    $diagnostic = $probe.StandardError.ReadToEndAsync()
    if (-not $probe.WaitForExit(15000)) { $probe.Kill(); throw 'TLS probe timed out' }
    $output.GetAwaiter().GetResult()
    $diagnostic.GetAwaiter().GetResult()
    $exitCode = $probe.ExitCode
    $probe.Dispose()
    if ($exitCode -ne 0) { throw "TLS identity probe failed with exit $exitCode" }
}
