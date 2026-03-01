# Replace user@host with your target
$userAtHost = "root@10.10.124.156"
$keyFile = "$env:USERPROFILE\.ssh\id_rsa.pub"

if (Test-Path $keyFile) {
    Get-Content $keyFile | ssh $userAtHost "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
}
