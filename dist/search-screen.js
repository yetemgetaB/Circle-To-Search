"use strict";var g=Object.defineProperty;var x=Object.getOwnPropertyDescriptor;var C=Object.getOwnPropertyNames;var O=Object.prototype.hasOwnProperty;var I=(e,t)=>{for(var r in t)g(e,r,{get:t[r],enumerable:!0})},N=(e,t,r,s)=>{if(t&&typeof t=="object"||typeof t=="function")for(let i of C(t))!O.call(e,i)&&i!==r&&g(e,i,{get:()=>t[i],enumerable:!(s=x(t,i))||s.enumerable});return e};var B=e=>N(g({},"__esModule",{value:!0}),e);var M={};I(M,{default:()=>F});module.exports=B(M);var n=require("@raycast/api");var y=require("util"),f=require("child_process"),l=require("os"),p=require("path"),a=require("fs"),h=(0,y.promisify)(f.exec);function S(e="circle_search",t=".png"){let r=Date.now(),s=Math.floor(Math.random()*1e4);return(0,p.join)((0,l.tmpdir)(),`${e}_${r}_${s}${t}`)}function $(e){try{(0,a.existsSync)(e)&&(0,a.unlinkSync)(e)}catch{}}var G=`
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
`;function A(){let e=[(0,p.resolve)(__dirname,"assets","windows-overlay.ps1"),(0,p.resolve)(__dirname,"..","assets","windows-overlay.ps1"),(0,p.resolve)(__dirname,"..","src","scripts","windows-overlay.ps1")];for(let r of e)if((0,a.existsSync)(r))return{path:r,isTemp:!1};let t=S("overlay",".ps1");return(0,a.writeFileSync)(t,G,"utf8"),{path:t,isTemp:!0}}async function D(){let e=S("snip"),t=(0,l.platform)()==="win32";try{if(t){let r=A(),s=`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${r.path}" -OutputPath "${e}"`;try{await h(s)}finally{r.isTemp&&$(r.path)}}else await h(`/usr/sbin/screencapture -i -r "${e}"`);return(0,a.existsSync)(e)&&(0,a.statSync)(e).size>0?e:null}catch{return $(e),null}}var u=require("fs"),d=require("path");async function E(e){let t=(0,u.readFileSync)(e),r=(0,d.basename)(e),s=new Blob([t],{type:"image/png"}),i=new FormData;i.append("reqtype","fileupload"),i.append("fileToUpload",s,r);let o=await fetch("https://catbox.moe/user/api.php",{method:"POST",body:i,signal:AbortSignal.timeout(12e3)});if(!o.ok)throw new Error(`Catbox returned HTTP ${o.status}`);let m=(await o.text()).trim();if(!m.startsWith("http"))throw new Error(`Catbox response invalid: ${m}`);return m}async function T(e){let t=(0,u.readFileSync)(e),r=(0,d.basename)(e),s=new Blob([t],{type:"image/png"}),i=new FormData;i.append("file",s,r);let o=await fetch("https://tmpfiles.org/api/v1/upload",{method:"POST",body:i,signal:AbortSignal.timeout(12e3)});if(!o.ok)throw new Error(`TmpFiles returned HTTP ${o.status}`);let m=await o.json();if(m.status==="success"&&m.data?.url)return m.data.url.replace("tmpfiles.org/","tmpfiles.org/dl/");throw new Error(`Unexpected TmpFiles response format: ${JSON.stringify(m)}`)}async function b(e){try{return await E(e)}catch(t){return console.warn("Primary upload failed, falling back to backup host:",t),await T(e)}}var c=require("@raycast/api"),w={google:{name:"Google Lens",getUrl:e=>`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(e)}`},bing:{name:"Bing Visual Search",getUrl:e=>`https://www.bing.com/images/search?view=detailv2&iss=sbi&FORM=SBIHRP&sbisrc=UrlPaste&q=imgurl:${encodeURIComponent(e)}`},yandex:{name:"Yandex Images",getUrl:e=>`https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(e)}`},tineye:{name:"TinEye",getUrl:e=>`https://tineye.com/search?url=${encodeURIComponent(e)}`},baidu:{name:"Baidu Visual Search",getUrl:e=>`https://graph.baidu.com/details?isPageLoad=1&carousel=0&entrance=GENERAL&image=${encodeURIComponent(e)}`}};function v(){return(0,c.getPreferenceValues)().searchEngine||"google"}async function P(e,t){let r=t||v();if(r==="all"){let i=Object.values(w).map(o=>(0,c.open)(o.getUrl(e)));return await Promise.all(i),"All Engines"}let s=w[r]||w.google;return await(0,c.open)(s.getUrl(e)),s.name}async function F(){await(0,n.closeMainWindow)(),await new Promise(t=>setTimeout(t,200));let e=null;try{if(e=await D(),!e)return;await(0,n.showHUD)("\u{1F50D} Searching...");let t=await b(e),r=await P(t);await(0,n.showHUD)(`\u2728 Opened in ${r}`)}catch(t){let r=t instanceof Error?t.message:"Failed to search image";await(0,n.showToast)({style:n.Toast.Style.Failure,title:"Search Failed",message:r})}finally{e&&$(e)}}
