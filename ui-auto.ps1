Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

function Take-Screenshot($name) {
    Start-Sleep -Seconds 2
    $screen = [System.Windows.Forms.Screen]::PrimaryScreen
    $bmp = New-Object System.Drawing.Bitmap($screen.Bounds.Width, $screen.Bounds.Height)
    $gfx = [System.Drawing.Graphics]::FromImage($bmp)
    $gfx.CopyFromScreen(0, 0, 0, 0, $bmp.Size)
    $path = "C:\Users\pcboc\Downloads\tetst\$name.png"
    $bmp.Save($path)
    Write-Output "Screenshot: $path"
}

# Find and focus Electron window
$procs = Get-Process -Name "RosaeFinity" -ErrorAction SilentlyContinue
if (-not $procs) { $procs = Get-Process -Name "electron" -ErrorAction SilentlyContinue }
$found = $false
foreach ($p in $procs) {
    if ($p.MainWindowHandle -ne [IntPtr]::Zero) {
        Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinAPI2 {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
        [WinAPI2]::SetForegroundWindow($p.MainWindowHandle)
        $found = $true
        Write-Output "Focused Electron window"
        break
    }
}
if (-not $found) { Write-Output "No focused window found" }

Start-Sleep -Milliseconds 500

# Click in the email field area (center of the form, roughly x=480, y=310 on a 1920x1080 screen)
$screen = [System.Windows.Forms.Screen]::PrimaryScreen
$sx = $screen.Bounds.Width
$sy = $screen.Bounds.Height
$emailX = [int]($sx * 0.50)
$emailY = [int]($sy * 0.56)

# Click email field
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($emailX, $emailY)
Start-Sleep -Milliseconds 200
[System.Windows.Forms.SendKeys]::SendWait("^{a}")
Start-Sleep -Milliseconds 100
[System.Windows.Forms.SendKeys]::SendWait("demo@rosaefinity.app")
Start-Sleep -Milliseconds 300

# Tab to password field
[System.Windows.Forms.SendKeys]::SendWait("{TAB}")
Start-Sleep -Milliseconds 200

# Type password
[System.Windows.Forms.SendKeys]::SendWait("demo123")
Start-Sleep -Milliseconds 300

# Press Enter to submit
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Start-Sleep -Seconds 4

Take-Screenshot "deploy-screenshot-2-after-login"
