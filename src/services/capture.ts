import { promisify } from "util";
import { exec as execCb } from "child_process";
import { platform, tmpdir } from "os";
import { join, resolve } from "path";
import { existsSync, statSync, unlinkSync, writeFileSync } from "fs";

const exec = promisify(execCb);

export function getTempFilePath(prefix = "circle_search", ext = ".png"): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return join(tmpdir(), `${prefix}_${timestamp}_${random}${ext}`);
}

export function cleanupFile(filePath: string): void {
  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  } catch {
    // Ignore cleanup errors
  }
}

const EMBEDDED_WINDOWS_OVERLAY_SCRIPT = `
param (
    [Parameter(Mandatory=$true)]
    [string]$OutputPath
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

[System.Windows.Forms.Application]::EnableVisualStyles()

$virtualScreen = [System.Windows.Forms.SystemInformation]::VirtualScreen
$left = $virtualScreen.Left
$top = $virtualScreen.Top
$width = $virtualScreen.Width
$height = $virtualScreen.Height

$captureBmp = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($captureBmp)
$graphics.CopyFromScreen($left, $top, 0, 0, (New-Object System.Drawing.Size $width, $height))
$graphics.Dispose()

$displayBmp = New-Object System.Drawing.Bitmap $width, $height
$displayG = [System.Drawing.Graphics]::FromImage($displayBmp)
$displayG.DrawImage($captureBmp, 0, 0, $width, $height)
$darkBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(140, 0, 0, 0))
$displayG.FillRectangle($darkBrush, 0, 0, $width, $height)
$darkBrush.Dispose()
$displayG.Dispose()

$form = New-Object System.Windows.Forms.Form
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
$form.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
$form.Location = New-Object System.Drawing.Point $left, $top
$form.Size = New-Object System.Drawing.Size $width, $height
$form.TopMost = $true
$form.ShowInTaskbar = $false

# Sleek minimalist precision cursor (1px ring with center point)
$cursorBmp = New-Object System.Drawing.Bitmap 32, 32
$cg = [System.Drawing.Graphics]::FromImage($cursorBmp)
$cg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

$cOuterDark = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(180, 0, 0, 0)), 2.5
$cg.DrawEllipse($cOuterDark, 7, 7, 18, 18)
$cOuterDark.Dispose()

$cOuterLight = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 255, 255, 255)), 1.5
$cg.DrawEllipse($cOuterLight, 7, 7, 18, 18)
$cOuterLight.Dispose()

$cCenterDot = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
$cg.FillEllipse($cCenterDot, 14, 14, 4, 4)
$cCenterDot.Dispose()

$cg.Dispose()

$hIcon = $cursorBmp.GetHicon()
$customCursor = New-Object System.Windows.Forms.Cursor $hIcon
$form.Cursor = $customCursor

$formType = $form.GetType()
$pi = $formType.GetProperty("DoubleBuffered", [System.Reflection.BindingFlags]"Instance,NonPublic")
if ($pi) {
    $pi.SetValue($form, $true, $null)
}

$points = New-Object System.Collections.Generic.List[System.Drawing.Point]
$script:isDrawing = $false
$script:saved = $false

$darkPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(200, 30, 30, 30)), 2.0
$darkPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

$lightPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(240, 255, 255, 255)), 1.0
$lightPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

$form.add_Paint({
    param($sender, $e)
    $e.Graphics.DrawImage($displayBmp, 0, 0)

    if ($points.Count -gt 2) {
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddLines($points.ToArray())
        $path.CloseFigure()

        $state = $e.Graphics.Save()
        $e.Graphics.SetClip($path)
        $e.Graphics.DrawImage($captureBmp, 0, 0)
        $e.Graphics.Restore($state)

        $e.Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $e.Graphics.DrawPath($darkPen, $path)
        $e.Graphics.DrawPath($lightPen, $path)

        $path.Dispose()
    } elseif ($points.Count -eq 2) {
        $e.Graphics.DrawLine($darkPen, $points[0], $points[1])
        $e.Graphics.DrawLine($lightPen, $points[0], $points[1])
    }
})

$form.add_MouseDown({
    param($sender, $e)
    if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
        $script:isDrawing = $true
        $points.Clear()
        $points.Add($e.Location)
        $form.Invalidate()
    }
})

$form.add_MouseMove({
    param($sender, $e)
    if ($script:isDrawing) {
        $points.Add($e.Location)
        $form.Invalidate()
    }
})

$form.add_MouseUp({
    param($sender, $e)
    if ($script:isDrawing) {
        $script:isDrawing = $false
        if ($points.Count -ge 3) {
            $minX = $width
            $minY = $height
            $maxX = 0
            $maxY = 0

            foreach ($pt in $points) {
                if ($pt.X -lt $minX) { $minX = $pt.X }
                if ($pt.Y -lt $minY) { $minY = $pt.Y }
                if ($pt.X -gt $maxX) { $maxX = $pt.X }
                if ($pt.Y -gt $maxY) { $maxY = $pt.Y }
            }

            $cropX = [Math]::Max(0, $minX)
            $cropY = [Math]::Max(0, $minY)
            $cropW = [Math]::Min($width - $cropX, $maxX - $minX)
            $cropH = [Math]::Min($height - $cropY, $maxY - $minY)

            if ($cropW -gt 10 -and $cropH -gt 10) {
                $resultBmp = New-Object System.Drawing.Bitmap $cropW, $cropH, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
                $resG = [System.Drawing.Graphics]::FromImage($resultBmp)
                $resG.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
                $resG.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))

                $path = New-Object System.Drawing.Drawing2D.GraphicsPath
                $path.AddLines($points.ToArray())
                $path.CloseFigure()

                $matrix = New-Object System.Drawing.Drawing2D.Matrix
                $matrix.Translate(-$cropX, -$cropY)
                $path.Transform($matrix)
                $matrix.Dispose()

                $resG.SetClip($path)

                $destRect = New-Object System.Drawing.Rectangle 0, 0, $cropW, $cropH
                $srcRect = New-Object System.Drawing.Rectangle $cropX, $cropY, $cropW, $cropH
                $resG.DrawImage($captureBmp, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

                $path.Dispose()
                $resG.Dispose()

                $outDir = [System.IO.Path]::GetDirectoryName($OutputPath)
                if (-not [string]::IsNullOrEmpty($outDir) -and -not [System.IO.Directory]::Exists($outDir)) {
                    [System.IO.Directory]::CreateDirectory($outDir) | Out-Null
                }

                $resultBmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
                $resultBmp.Dispose()
                $script:saved = $true
            }
        }
        $form.Close()
    }
})

$form.add_KeyDown({
    param($sender, $e)
    if ($e.KeyCode -eq [System.Windows.Forms.Keys]::Escape) {
        $form.Close()
    }
})

[void]$form.ShowDialog()

$captureBmp.Dispose()
$displayBmp.Dispose()
$darkPen.Dispose()
$lightPen.Dispose()
$customCursor.Dispose()
$cursorBmp.Dispose()
$form.Dispose()

if ($script:saved) {
    exit 0
} else {
    exit 1
}
`;

function getWindowsOverlayScriptPath(): { path: string; isTemp: boolean } {
  const candidatePaths = [
    resolve(__dirname, "assets", "windows-overlay.ps1"),
    resolve(__dirname, "..", "assets", "windows-overlay.ps1"),
    resolve(__dirname, "..", "src", "scripts", "windows-overlay.ps1"),
  ];

  for (const candidate of candidatePaths) {
    if (existsSync(candidate)) {
      return { path: candidate, isTemp: false };
    }
  }

  const tempScriptPath = getTempFilePath("overlay", ".ps1");
  writeFileSync(tempScriptPath, EMBEDDED_WINDOWS_OVERLAY_SCRIPT, "utf8");
  return { path: tempScriptPath, isTemp: true };
}

/**
 * Initiates an interactive screen capture:
 * - Dims the screen with a precision reticle cursor.
 * - Draws a thin closed contour and dynamically illuminates the inside in normal brightness (spotlight cutout).
 * - Crops the enclosed region on release with true 100% transparent background outside the shape.
 *
 * Returns the path to the saved PNG, or null if the user cancelled (e.g. pressed Esc).
 */
export async function captureInteractiveArea(): Promise<string | null> {
  const outputPath = getTempFilePath("snip");
  const isWindows = platform() === "win32";

  try {
    if (isWindows) {
      const scriptInfo = getWindowsOverlayScriptPath();
      const psCommand = `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${scriptInfo.path}" -OutputPath "${outputPath}"`;

      try {
        await exec(psCommand);
      } finally {
        if (scriptInfo.isTemp) {
          cleanupFile(scriptInfo.path);
        }
      }
    } else {
      await exec(`/usr/sbin/screencapture -i -r "${outputPath}"`);
    }

    if (existsSync(outputPath)) {
      const stats = statSync(outputPath);
      if (stats.size > 0) {
        return outputPath;
      }
    }
    return null;
  } catch {
    cleanupFile(outputPath);
    return null;
  }
}

/**
 * Instantly captures the entire screen without interaction.
 */
export async function captureFullScreen(): Promise<string | null> {
  const outputPath = getTempFilePath("fullscreen");
  const isWindows = platform() === "win32";

  try {
    if (isWindows) {
      const psScript = `
        Add-Type -AssemblyName System.Windows.Forms, System.Drawing;
        $bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen;
        $bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height;
        $g = [System.Drawing.Graphics]::FromImage($bmp);
        $g.CopyFromScreen($bounds.Left, $bounds.Top, 0, 0, $bounds.Size);
        $bmp.Save('${outputPath.replace(/\\/g, "\\\\")}', [System.Drawing.Imaging.ImageFormat]::Png);
        $g.Dispose();
        $bmp.Dispose();
      `;
      await exec(`powershell.exe -NoProfile -Command "${psScript.replace(/\r?\n/g, " ")}"`);
    } else {
      await exec(`/usr/sbin/screencapture -x "${outputPath}"`);
    }

    if (existsSync(outputPath) && statSync(outputPath).size > 0) {
      return outputPath;
    }
    return null;
  } catch {
    cleanupFile(outputPath);
    return null;
  }
}

/**
 * Extracts any image data currently present in the clipboard.
 */
export async function getClipboardImage(): Promise<string | null> {
  const outputPath = getTempFilePath("clipboard");
  const isWindows = platform() === "win32";

  try {
    if (isWindows) {
      const psScript = `
        Add-Type -AssemblyName System.Windows.Forms;
        $img = [System.Windows.Forms.Clipboard]::GetImage();
        if ($img) {
          $img.Save('${outputPath.replace(/\\/g, "\\\\")}', [System.Drawing.Imaging.ImageFormat]::Png);
          $img.Dispose();
          exit 0;
        } else {
          exit 1;
        }
      `;
      await exec(`powershell.exe -NoProfile -Command "${psScript.replace(/\r?\n/g, " ")}"`);
    } else {
      const osaScript = `
        set pngPath to POSIX file "${outputPath}"
        try
          set imgData to the clipboard as «class PNGf»
          set fileRef to open for access pngPath with write permission
          write imgData to fileRef
          close access fileRef
        on error
          try
            close access fileRef
          end try
          error "No image in clipboard"
        end try
      `;
      await exec(`osascript -e '${osaScript.replace(/\r?\n/g, " ")}'`);
    }

    if (existsSync(outputPath) && statSync(outputPath).size > 0) {
      return outputPath;
    }
    return null;
  } catch {
    cleanupFile(outputPath);
    return null;
  }
}
