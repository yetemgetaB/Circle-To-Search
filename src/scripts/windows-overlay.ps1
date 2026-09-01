param (
    [Parameter(Mandatory=$true)]
    [string]$OutputPath
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

[System.Windows.Forms.Application]::EnableVisualStyles()

# Capture virtual screen across all monitors
$virtualScreen = [System.Windows.Forms.SystemInformation]::VirtualScreen
$left = $virtualScreen.Left
$top = $virtualScreen.Top
$width = $virtualScreen.Width
$height = $virtualScreen.Height

$captureBmp = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($captureBmp)
$graphics.CopyFromScreen($left, $top, 0, 0, (New-Object System.Drawing.Size $width, $height))
$graphics.Dispose()

# Create dark dimmed overlay bitmap for the outside
$displayBmp = New-Object System.Drawing.Bitmap $width, $height
$displayG = [System.Drawing.Graphics]::FromImage($displayBmp)
$displayG.DrawImage($captureBmp, 0, 0, $width, $height)
$darkBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(140, 0, 0, 0))
$displayG.FillRectangle($darkBrush, 0, 0, $width, $height)
$darkBrush.Dispose()
$displayG.Dispose()

# Create fullscreen overlay form
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

# Enable double buffering
$formType = $form.GetType()
$pi = $formType.GetProperty("DoubleBuffered", [System.Reflection.BindingFlags]"Instance,NonPublic")
if ($pi) {
    $pi.SetValue($form, $true, $null)
}

$points = New-Object System.Collections.Generic.List[System.Drawing.Point]
$script:isDrawing = $false
$script:saved = $false

# Thin crisp outline pens
$darkPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(200, 30, 30, 30)), 2.0
$darkPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

$lightPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(240, 255, 255, 255)), 1.0
$lightPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

$form.add_Paint({
    param($sender, $e)
    # 1. Draw the dimmed screen
    $e.Graphics.DrawImage($displayBmp, 0, 0)

    # 2. If drawing a shape, illuminate the inside to normal color and draw thin closed outline
    if ($points.Count -gt 2) {
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddLines($points.ToArray())
        $path.CloseFigure()

        # Clip and draw the original bright un-dimmed screenshot inside the closed shape
        $state = $e.Graphics.Save()
        $e.Graphics.SetClip($path)
        $e.Graphics.DrawImage($captureBmp, 0, 0)
        $e.Graphics.Restore($state)

        # Draw thin crisp closed outline
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

            # Exact tight bounding box without padding
            $cropX = [Math]::Max(0, $minX)
            $cropY = [Math]::Max(0, $minY)
            $cropW = [Math]::Min($width - $cropX, $maxX - $minX)
            $cropH = [Math]::Min($height - $cropY, $maxY - $minY)

            if ($cropW -gt 10 -and $cropH -gt 10) {
                # Create true background-less 32-bit transparent ARGB bitmap
                $resultBmp = New-Object System.Drawing.Bitmap $cropW, $cropH, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
                $resG = [System.Drawing.Graphics]::FromImage($resultBmp)
                $resG.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
                $resG.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))

                # Create freehand clipping path in local cropped coordinates
                $path = New-Object System.Drawing.Drawing2D.GraphicsPath
                $path.AddLines($points.ToArray())
                $path.CloseFigure()

                $matrix = New-Object System.Drawing.Drawing2D.Matrix
                $matrix.Translate(-$cropX, -$cropY)
                $path.Transform($matrix)
                $matrix.Dispose()

                # Set shape clipping mask so outside pixels are completely background-less / 100% transparent
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
