Add-Type -AssemblyName System.Drawing

$src = "D:\Akatsuki Pvt Ltd\vipmovies\public\m-image\VIP Movies.jpg"
$destDir = "D:\Akatsuki Pvt Ltd\vipmovies\public"

$img = [System.Drawing.Image]::FromFile($src)
$srcCrop = New-Object System.Drawing.Rectangle(190, 130, 870, 830)

function Make-Icon {
    param(
        [System.Drawing.Image]$sourceImg,
        [System.Drawing.Rectangle]$cropRect,
        [string]$destPath,
        [int]$width,
        [int]$height,
        [bool]$isIco = $false
    )
    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(7, 7, 11))
    $g.FillRectangle($bgBrush, 0, 0, $width, $height)
    $bgBrush.Dispose()

    $destRect = New-Object System.Drawing.Rectangle(0, 0, $width, $height)
    $g.DrawImage($sourceImg, $destRect, $cropRect.X, $cropRect.Y, $cropRect.Width, $cropRect.Height, [System.Drawing.GraphicsUnit]::Pixel)
    
    if ($isIco) {
        $icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
        $fs = [System.IO.File]::OpenWrite($destPath)
        $icon.Save($fs)
        $fs.Close()
        $icon.Dispose()
    } else {
        $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    
    $g.Dispose()
    $bmp.Dispose()
    Write-Output "Created: $destPath ($width x $height)"
}

Make-Icon -sourceImg $img -cropRect $srcCrop -destPath "$destDir\favicon-16x16.png" -width 16 -height 16
Make-Icon -sourceImg $img -cropRect $srcCrop -destPath "$destDir\favicon-32x32.png" -width 32 -height 32
Make-Icon -sourceImg $img -cropRect $srcCrop -destPath "$destDir\favicon-48x48.png" -width 48 -height 48
Make-Icon -sourceImg $img -cropRect $srcCrop -destPath "$destDir\favicon.png" -width 64 -height 64
Make-Icon -sourceImg $img -cropRect $srcCrop -destPath "$destDir\favicon.ico" -width 48 -height 48 -isIco $true
Make-Icon -sourceImg $img -cropRect $srcCrop -destPath "$destDir\apple-touch-icon.png" -width 180 -height 180
Make-Icon -sourceImg $img -cropRect $srcCrop -destPath "$destDir\shortcut-icon.png" -width 192 -height 192
Make-Icon -sourceImg $img -cropRect $srcCrop -destPath "$destDir\icon-512.png" -width 512 -height 512

$img.Dispose()
Write-Output "All icons successfully created!"
