Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

function Take-Screenshot($name) {
    Start-Sleep -Seconds 3
    $screen = [System.Windows.Forms.Screen]::PrimaryScreen
    $bmp = New-Object System.Drawing.Bitmap($screen.Bounds.Width, $screen.Bounds.Height)
    $gfx = [System.Drawing.Graphics]::FromImage($bmp)
    $gfx.CopyFromScreen(0, 0, 0, 0, $bmp.Size)
    $path = "C:\Users\pcboc\Downloads\tetst\$name.png"
    $bmp.Save($path)
    Write-Output "Screenshot: $path"
}

# Focus Electron
$procs = Get-Process -Name "RosaeFinity" -ErrorAction SilentlyContinue
foreach ($p in $procs) {
    if ($p.MainWindowHandle -ne [IntPtr]::Zero) {
        Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinAPI3 {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
        [WinAPI3]::SetForegroundWindow($p.MainWindowHandle)
        break
    }
}
Start-Sleep -Milliseconds 500

# Select all in email field and retype
[System.Windows.Forms.SendKeys]::SendWait("^a")
Start-Sleep -Milliseconds 100
[System.Windows.Forms.SendKeys]::SendWait("demo@rosaefinity.app")
Start-Sleep -Milliseconds 200

# Tab to password
[System.Windows.Forms.SendKeys]::SendWait("{TAB}")
Start-Sleep -Milliseconds 150

# Select all in password and retype
[System.Windows.Forms.SendKeys]::SendWait("^a")
Start-Sleep -Milliseconds 100
[System.Windows.Forms.SendKeys]::SendWait("demo123")
Start-Sleep -Milliseconds 200

# Tab through Remember Me checkbox to Sign In button, then Enter
[System.Windows.Forms.SendKeys]::SendWait("{TAB}")
Start-Sleep -Milliseconds 100
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Start-Sleep -Seconds 5

Take-Screenshot "deploy-screenshot-3-signed-in"
